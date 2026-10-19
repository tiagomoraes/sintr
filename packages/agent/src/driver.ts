import { randomUUID } from "node:crypto";
import type { Logger, ProposalKind } from "@sintr/core";
import {
  createUIMessageStream,
  hasToolCall,
  isStepCount,
  streamText,
  toUIMessageStream,
  type LanguageModel,
  type UIMessageStreamWriter,
} from "ai";
import type { Metered } from "./assistant";
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
  /**
   * The house assistant's monthly meter. Absent for a person's own key,
   * which is never counted. A message that signals risk never touches it.
   */
  metered?: Metered;
}

type Writer = UIMessageStreamWriter<SintrUIMessage>;

function writeText(writer: Writer, text: string): void {
  const id = randomUUID();
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: text });
  writer.write({ type: "text-end", id });
}

/**
 * The person's message as a draft entry, word for word, when the assistant
 * cannot answer it: capture never waits for a plan. Null if it could not be
 * stored; the message itself is kept in the conversation either way.
 */
async function keepWords(
  turn: CaptureTurn,
  text: string,
): Promise<{ proposalId: string; draft: { situation: string; occurredAt: string } } | null> {
  const draft = { situation: text, occurredAt: (turn.now ?? new Date()).toISOString() };
  try {
    const { id } = await turn.ports.createProposal({ kind: "entry", payload: draft });
    return { proposalId: id, draft };
  } catch (error) {
    turn.log.warn("agent.keep_failed", { error });
    return null;
  }
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
 *
 * On the house assistant, one unit of the person's monthly meter is taken
 * right before the model runs and given back if the reply fails. When the
 * month's messages are used, the model does not run, and nothing is lost:
 * the person's words are kept and offered back as a draft entry, a "salva"
 * still saves, and a paused conversation still gets the help lines.
 */
export function runCaptureTurn(turn: CaptureTurn): ReadableStream<SintrUIMessageChunk> {
  const messages = turn.message ? [...turn.history, turn.message] : [...turn.history];
  const last = messages.at(-1);
  const text = last?.role === "user" ? textOf(last) : "";
  const { log, person } = turn;
  const started = Date.now();
  // A failed reply is not stored: the person's message is, and they can retry.
  let keepReply = true;

  return createUIMessageStream<SintrUIMessage>({
    originalMessages: messages,
    generateId: randomUUID,
    onError: (error) => {
      log.warn("agent.turn_failed", { error });
      return "assistant_unavailable";
    },
    onEnd: async ({ responseMessage }) => {
      if (keepReply && turn.onResponse && hasContent(responseMessage)) await turn.onResponse(responseMessage);
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

      // Only a new message can say yes: retrying a failed reply to "salva"
      // must not confirm the next older draft.
      let turnNote: string | undefined;
      let saved: ProposalKind | null = null;
      if (!inCrisis && turn.message && text && isSaveCommand(text)) {
        const pending = await turn.ports.pendingProposal();
        if (pending) {
          try {
            const { recordId } = await turn.ports.confirmProposal(pending.id);
            writer.write({
              type: "data-proposal",
              id: `proposal-${pending.id}`,
              data: { proposalId: pending.id, status: "saved", recordId },
            });
            saved = pending.kind;
            turnNote = `the person told you to save their ${pending.kind === "entry" ? "entry" : "check-in"} draft, and it is now saved. Acknowledge it in one short line and do not propose it again.`;
          } catch (error) {
            log.warn("agent.save_failed", { error });
          }
        }
      }

      if (turn.metered) {
        const taken = await turn.metered.take();
        if (!taken.ok) {
          if (inCrisis) {
            // The diary stays paused, and the help lines never depend on a plan.
            writeText(writer, crisisMessage(crisisLanguage(person.language)));
          } else {
            writer.write({
              type: "data-limit",
              id: "limit",
              data: {
                used: taken.used,
                limit: taken.limit,
                next: taken.period.next,
                kept: saved || !text || isSaveCommand(text) ? null : await keepWords(turn, text),
                saved,
              },
            });
          }
          log.info("agent.turn_done", { durationMs: Date.now() - started, code: "limit_reached" });
          writer.write({ type: "finish" });
          return;
        }
        if (taken.limit !== null) {
          writer.write({
            type: "data-usage",
            data: { used: taken.used, limit: taken.limit, next: taken.period.next },
            transient: true,
          });
        }
      }

      try {
        const signal: { crisis: { language: string | undefined } | null } = { crisis: null };
        const proposedThisTurn: string[] = [];
        const tools = inCrisis
          ? undefined
          : captureTools({
              ports: turn.ports,
              personTexts: personTexts(messages),
              timezone: person.timezone,
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
          onError: ({ error }) =>
            log.warn("agent.model_error", { code: describeProviderError(error), error }),
        });

        let failed = false;
        const chunks = toUIMessageStream({
          stream: result.stream,
          ...(tools ? { tools } : {}),
          sendStart: false,
          sendFinish: false,
          // Also called for a refused tool input or a failing tool, which the
          // model can recover from; only an `error` chunk fails the turn.
          onError: (error) => describeProviderError(error),
        }) as ReadableStream<SintrUIMessageChunk>;
        const reader = chunks.getReader();
        for (;;) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          if (chunk.type === "error") {
            failed = true;
            // In crisis mode a failure must not leave the person without the numbers.
            if (inCrisis) continue;
          }
          writer.write(chunk);
        }

        const withdraw = async () => {
          for (const id of proposedThisTurn) {
            await turn.ports.discardProposal(id).catch(() => undefined);
          }
        };
        if (failed && !inCrisis) {
          // Drafts of a reply that is not kept would wait unseen; withdraw them.
          keepReply = false;
          await withdraw();
        }
        // A reply that failed is not counted against the month.
        if (failed) await turn.metered?.giveBack();
        if (signal.crisis) {
          // A stopped diary is always stored, so the next turn stays stopped.
          keepReply = true;
          await withdraw();
          log.info("agent.crisis", { code: "assistant" });
          writeCrisis(writer, "assistant", crisisLanguage(signal.crisis.language ?? person.language));
        } else if (inCrisis && failed) {
          writeText(writer, crisisMessage(crisisLanguage(person.language)));
        }
        log.info("agent.turn_done", { durationMs: Date.now() - started, code: failed ? "failed" : "ok" });
        writer.write({ type: "finish" });
      } catch (error) {
        // Whatever broke before the reply, the month is not charged for it,
        // and a paused conversation still gets the help lines.
        await turn.metered?.giveBack();
        if (!inCrisis) throw error;
        log.warn("agent.turn_failed", { error });
        writeText(writer, crisisMessage(crisisLanguage(person.language)));
        writer.write({ type: "finish" });
      }
    },
  });
}
