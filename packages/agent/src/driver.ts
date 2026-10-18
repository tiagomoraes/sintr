import { randomUUID } from "node:crypto";
import type { Logger } from "@sintr/core";
import {
  createUIMessageStream,
  hasToolCall,
  isStepCount,
  streamText,
  toUIMessageStream,
  type LanguageModel,
  type UIMessageStreamWriter,
} from "ai";
import { crisisLanguage, crisisMessage, screenForRisk, type CrisisLanguage } from "./crisis";
import { smoothDashes } from "./dashes";
import { hasContent, isInCrisis, personTexts, textOf, toModelMessages } from "./messages";
import type { CapturePorts } from "./ports";
import { capturePrompt, crisisPrompt } from "./prompt";
import { describeProviderError } from "./providers";
import type { SintrDataParts, SintrUIMessage, SintrUIMessageChunk } from "./shapes";
import { captureTools } from "./tools";
import { isSaveCommand } from "./words";

/** Enough for: read context, propose, fix a refused draft, then reply. */
export const MAX_STEPS = 5;

export interface CaptureTurn {
  model: LanguageModel;
  /** The stored conversation before this turn, oldest first. */
  history: readonly SintrUIMessage[];
  /** The person's new message. Absent when retrying after a failed reply. */
  message?: SintrUIMessage;
  person: { language: string; timezone: string };
  ports: CapturePorts;
  /** The redacting logger: codes and counts only. */
  log: Logger;
  now?: Date;
  abortSignal?: AbortSignal;
  /** Chunks to send before anything else, such as a new conversation's id. */
  prelude?: readonly SintrUIMessageChunk[];
  /** Persist the assistant's reply. Not called for an empty reply. */
  onResponse?(message: SintrUIMessage): Promise<void> | void;
}

type Writer = UIMessageStreamWriter<SintrUIMessage>;

function writeText(writer: Writer, text: string): void {
  const id = randomUUID();
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: text });
  writer.write({ type: "text-end", id });
}

/** Stop the diary: the fixed message, then the help lines on screen. */
function writeCrisis(writer: Writer, source: SintrDataParts["crisis"]["source"], language: CrisisLanguage) {
  writeText(writer, crisisMessage(language));
  writer.write({ type: "data-crisis", id: "crisis", data: { source } });
}

/**
 * One turn of the capture conversation, as a UI message stream:
 *
 * 1. A message that signals acute risk stops the diary before any model is
 *    called: a fixed, warm message and the crisis lines. From then on the
 *    conversation stays in crisis mode: the model may only answer with
 *    warmth and help, with no tools; if it fails, the fixed message is sent.
 * 2. An explicit "salva" confirms the latest draft, deterministically. The
 *    model never decides that the person said yes.
 * 3. Otherwise the model talks, and may only propose drafts. Drafts are
 *    checked against the person's words before they are stored, and none
 *    becomes a record until the person confirms it.
 */
export function runCaptureTurn(turn: CaptureTurn): ReadableStream<SintrUIMessageChunk> {
  const messages = turn.message ? [...turn.history, turn.message] : [...turn.history];
  const last = messages.at(-1);
  const text = last?.role === "user" ? textOf(last) : "";
  const { log, person } = turn;
  const started = Date.now();

  return createUIMessageStream<SintrUIMessage>({
    originalMessages: messages,
    generateId: randomUUID,
    onError: (error) => {
      log.warn("agent.turn_failed", { error });
      return "assistant_unavailable";
    },
    onEnd: async ({ responseMessage }) => {
      if (turn.onResponse && hasContent(responseMessage)) await turn.onResponse(responseMessage);
    },
    execute: async ({ writer }) => {
      writer.write({ type: "start", messageId: randomUUID() });
      for (const chunk of turn.prelude ?? []) writer.write(chunk);
      const inCrisis = isInCrisis(turn.history);

      if (!inCrisis && text) {
        const screening = screenForRisk(text);
        if (screening.risk) {
          log.info("agent.crisis", { code: `screen_${screening.kind}` });
          writeCrisis(writer, "screen", screening.language);
          writer.write({ type: "finish" });
          return;
        }
      }

      let turnNote: string | undefined;
      if (!inCrisis && text && isSaveCommand(text)) {
        const pending = await turn.ports.pendingProposal();
        if (pending) {
          try {
            const { recordId } = await turn.ports.confirmProposal(pending.id);
            writer.write({
              type: "data-proposal",
              id: `proposal-${pending.id}`,
              data: { proposalId: pending.id, status: "saved", recordId },
            });
            turnNote = `the person told you to save their ${pending.kind === "entry" ? "entry" : "check-in"} draft, and it is now saved. Acknowledge it in one short line and do not propose it again.`;
          } catch (error) {
            log.warn("agent.save_failed", { error });
          }
        }
      }

      const signal: { crisis: { language: string | undefined } | null } = { crisis: null };
      const proposedThisTurn: string[] = [];
      const tools = inCrisis
        ? undefined
        : captureTools({
            ports: turn.ports,
            personTexts: personTexts(messages),
            proposedThisTurn,
            onCrisis: (language) => {
              signal.crisis = { language };
            },
          });
      const states = inCrisis ? new Map() : await turn.ports.proposalStates();

      const result = streamText({
        model: turn.model,
        instructions: inCrisis
          ? crisisPrompt()
          : capturePrompt({ ...person, now: turn.now ?? new Date(), ...(turnNote ? { turnNote } : {}) }),
        messages: await toModelMessages(messages, {
          states,
          textOnly: inCrisis,
          ...(tools ? { tools } : {}),
        }),
        ...(tools ? { tools, stopWhen: [isStepCount(MAX_STEPS), hasToolCall("signal_crisis")] } : {}),
        experimental_transform: smoothDashes(),
        maxRetries: 1,
        timeout: { totalMs: 180_000 },
        ...(turn.abortSignal ? { abortSignal: turn.abortSignal } : {}),
        telemetry: { isEnabled: false },
        // The default writes the whole error, request included, to the console.
        onError: ({ error }) => log.warn("agent.model_error", { code: describeProviderError(error), error }),
      });

      let failed = false;
      const chunks = toUIMessageStream({
        stream: result.stream,
        ...(tools ? { tools } : {}),
        sendStart: false,
        sendFinish: false,
        onError: (error) => {
          failed = true;
          return describeProviderError(error);
        },
      }) as ReadableStream<SintrUIMessageChunk>;
      for await (const chunk of chunks) {
        if (chunk.type === "error") {
          failed = true;
          // In crisis mode a failure must not leave the person without the numbers.
          if (inCrisis) continue;
        }
        writer.write(chunk);
      }

      if (signal.crisis) {
        for (const id of proposedThisTurn) {
          await turn.ports.discardProposal(id).catch(() => undefined);
        }
        log.info("agent.crisis", { code: "assistant" });
        writeCrisis(writer, "assistant", crisisLanguage(signal.crisis.language ?? person.language));
      } else if (inCrisis && failed) {
        writeText(writer, crisisMessage(crisisLanguage(person.language)));
      }
      log.info("agent.turn_done", { durationMs: Date.now() - started, code: failed ? "failed" : "ok" });
      writer.write({ type: "finish" });
    },
  });
}
