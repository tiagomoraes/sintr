/**
 * A deterministic, offline language model: the fake provider of every test.
 * It never touches the network. `scriptedModel` answers each call from a
 * script and records what it was asked; `rehearsalModel` is the scripted
 * assistant the app runs with SINTR_FAKE_AGENT=1 (end-to-end tests).
 */
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4Prompt,
  LanguageModelV4StreamPart,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";

export interface ScriptedReply {
  text?: string;
  toolCalls?: { toolName: string; input: unknown }[];
  /** Thrown instead of answering, to simulate a provider failure. */
  error?: unknown;
}

/** What a script sees of one call, already taken apart. */
export interface CallView {
  index: number;
  instructions: string;
  /** The person's messages, oldest first. */
  userTexts: string[];
  /** Tool results of the latest step, if the last message is one. */
  toolResults: { toolName: string; output: unknown }[];
  /** Names of the tools offered on this call. */
  tools: string[];
  options: LanguageModelV4CallOptions;
}

export type Script = (view: CallView) => ScriptedReply;

const USAGE: LanguageModelV4Usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 10, text: 10, reasoning: undefined },
};

function view(prompt: LanguageModelV4Prompt, index: number, options: LanguageModelV4CallOptions): CallView {
  const instructions = prompt
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const userTexts = prompt
    .filter((m) => m.role === "user")
    .map((m) =>
      m.content
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("\n"),
    );
  const lastMessage = prompt.at(-1);
  const toolResults =
    lastMessage?.role === "tool"
      ? lastMessage.content
          .filter((p) => p.type === "tool-result")
          .map((p) => ({
            toolName: p.toolName,
            output: p.output.type === "json" || p.output.type === "text" ? p.output.value : null,
          }))
      : [];
  const tools = (options.tools ?? []).map((tool) => tool.name);
  return { index, instructions, userTexts, toolResults, tools, options };
}

export interface ScriptedModel extends LanguageModelV4 {
  /** Every call the model received, in order. */
  readonly calls: LanguageModelV4CallOptions[];
}

/**
 * A model that answers from `script`: a function of the call, or a list of
 * replies used in order (the last one repeats).
 */
export function scriptedModel(script: Script | ScriptedReply[], modelId = "scripted"): ScriptedModel {
  const calls: LanguageModelV4CallOptions[] = [];
  let counter = 0;
  const answer = (options: LanguageModelV4CallOptions): ScriptedReply => {
    const index = calls.length;
    calls.push(options);
    const reply = Array.isArray(script)
      ? (script[Math.min(index, script.length - 1)] ?? {})
      : script(view(options.prompt, index, options));
    if (reply.error !== undefined) {
      throw reply.error instanceof Error ? reply.error : new Error("scripted failure");
    }
    return reply;
  };
  const content = (reply: ScriptedReply): LanguageModelV4Content[] => [
    ...(reply.text ? [{ type: "text" as const, text: reply.text }] : []),
    ...(reply.toolCalls ?? []).map((call) => ({
      type: "tool-call" as const,
      toolCallId: `call-${(counter += 1)}`,
      toolName: call.toolName,
      input: JSON.stringify(call.input),
    })),
  ];
  const finishReason = (reply: ScriptedReply) =>
    reply.toolCalls?.length
      ? { unified: "tool-calls" as const, raw: "tool_calls" }
      : { unified: "stop" as const, raw: "stop" };

  return {
    specificationVersion: "v4",
    provider: "sintr-scripted",
    modelId,
    supportedUrls: {},
    calls,
    async doGenerate(options) {
      const reply = answer(options);
      return { content: content(reply), finishReason: finishReason(reply), usage: USAGE, warnings: [] };
    },
    async doStream(options) {
      const reply = answer(options);
      const parts: LanguageModelV4StreamPart[] = [{ type: "stream-start", warnings: [] }];
      for (const item of content(reply)) {
        if (item.type === "text") {
          const id = `text-${(counter += 1)}`;
          parts.push({ type: "text-start", id });
          // A few deltas, as a real stream would send them.
          for (const piece of item.text.match(/\S+\s*|\s+/gu) ?? []) {
            parts.push({ type: "text-delta", id, delta: piece });
          }
          parts.push({ type: "text-end", id });
        } else if (item.type === "tool-call") {
          parts.push(item);
        }
      }
      parts.push({ type: "finish", usage: USAGE, finishReason: finishReason(reply) });
      return {
        stream: new ReadableStream<LanguageModelV4StreamPart>({
          start(controller) {
            for (const part of parts) controller.enqueue(part);
            controller.close();
          },
        }),
      };
    },
  };
}

/* The rehearsal assistant */

function firstSentence(text: string): string {
  return (text.split(/(?<=[.!?])\s/u)[0] ?? text).replace(/[.!?]+$/u, "").trim();
}

/** "I thought: ..." or a quoted sentence; otherwise the first sentence. */
function thoughtIn(text: string): string {
  const quoted = /["“]([^"”]+)["”]/u.exec(text);
  if (quoted?.[1]) return quoted[1].trim();
  const said = /(?:thought|pensei|pense|pensé)\s*:?\s*(?:that\s+|que\s+)?([^.!?\n]+)/iu.exec(text);
  if (said?.[1]) return said[1].trim();
  return firstSentence(text);
}

/** "anxiety 80, shame 60" as emotions with the numbers the person gave. */
function emotionsIn(text: string): { name: string; intensity: number }[] {
  return [...text.matchAll(/(\p{L}[\p{L}'-]*)\s*:?\s*(\d{1,3})(?![\d.,]\d)/gu)]
    .map((m) => ({ name: m[1]!, intensity: Number(m[2]) }))
    .filter((e) => e.intensity <= 100);
}

function checkinIn(text: string): Record<string, number> | null {
  const read = (pattern: RegExp) => {
    const match = pattern.exec(text);
    return match?.[1] ? Number(match[1].replace(",", ".")) : undefined;
  };
  const values: Record<string, number | undefined> = {
    mood: read(/\b(?:mood|humor|ánimo|animo)\s*:?\s*(\d)\b/iu),
    energy: read(/\b(?:energy|energia|energía)\s*:?\s*(\d)\b/iu),
    anxiety: read(/\b(?:anxiety|ansiedade|ansiedad)\s*:?\s*(\d)\b/iu),
    sleepHours: read(/\b(?:slept|sleep|dormi|dormí)\s*:?\s*(\d{1,2}(?:[.,]\d)?)/iu),
  };
  const given = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)) as Record<
    string,
    number
  >;
  return Object.keys(given).length > 0 ? given : null;
}

/**
 * The scripted assistant behind SINTR_FAKE_AGENT. It follows the capture
 * flow closely enough to exercise the whole app: it acknowledges and asks
 * one question, then drafts the entry from the person's own sentences, and
 * drafts a check-in when the message reads like one.
 */
export const rehearsalScript: Script = (call) => {
  if (call.instructions.includes("the diary is paused")) {
    return {
      text: "I am still here with you. Please talk to a person now: in Brazil CVV answers on 188, free and at any hour, and SAMU on 192 in an emergency. When you are ready to write again, you can start a new conversation.",
    };
  }
  const result = call.toolResults[0];
  if (result) {
    const output = result.output as { ok?: boolean } | null;
    if (result.toolName.startsWith("propose_") && output?.ok) {
      return {
        text: "Here is the draft, in your words. You can confirm it, change anything, or tell me what to fix.",
      };
    }
    if (result.toolName.startsWith("propose_")) {
      return { text: "I could not keep that draft as it was. Could you tell me again, in your own words?" };
    }
  }
  if (call.instructions.includes("it is now saved")) {
    return { text: "Saved. It is in your diary now, and you can change it there whenever you want." };
  }
  const users = call.userTexts;
  const latest = users.at(-1) ?? "";
  const checkin = call.tools.includes("propose_checkin") ? checkinIn(latest) : null;
  if (checkin) return { toolCalls: [{ toolName: "propose_checkin", input: checkin }] };
  if (users.length <= 1 || !call.tools.includes("propose_entry")) {
    return {
      text: "Thank you for telling me. That sounds like a hard moment.\n\nWhat went through your mind right then, in the words you heard it? And how strong was the feeling, from 0 to 100?",
    };
  }
  const later = users.slice(1).join("\n");
  const draft = {
    situation: users[0],
    thoughts: [thoughtIn(later)],
    emotions: emotionsIn(later),
  };
  return {
    text: "Thank you. I put it together with your words.",
    toolCalls: [{ toolName: "propose_entry", input: draft }],
  };
};

export function rehearsalModel(): ScriptedModel {
  return scriptedModel(rehearsalScript, "rehearsal");
}
