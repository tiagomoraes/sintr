/**
 * Conversation messages: how they are stored (sealed by the core), how the
 * driver reads them, and what the model is shown.
 */
import type { Message, MessageRole } from "@sintr/core";
import { convertToModelMessages, type ModelMessage, type ToolSet } from "ai";
import type { ProposalState, SintrUIMessage } from "./shapes";

/** The stored form: the message parts, as JSON, inside the sealed column. */
interface Stored {
  v: 1;
  parts: SintrUIMessage["parts"];
}

export function serializeMessage(message: SintrUIMessage): { role: MessageRole; content: string } {
  const stored: Stored = { v: 1, parts: message.parts };
  return { role: message.role, content: JSON.stringify(stored) };
}

/** A stored row as a UI message. Rows that are plain text become one text part. */
export function parseStoredMessage(row: Pick<Message, "id" | "role" | "content">): SintrUIMessage | null {
  if (row.role !== "user" && row.role !== "assistant") return null;
  let parts: SintrUIMessage["parts"] = [{ type: "text", text: row.content }];
  try {
    const parsed = JSON.parse(row.content) as Partial<Stored> | null;
    if (parsed && parsed.v === 1 && Array.isArray(parsed.parts)) parts = parsed.parts;
  } catch {
    // Not JSON: an older plain-text row.
  }
  return { id: row.id, role: row.role, parts };
}

export function textOf(message: SintrUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

/** Everything the person typed in this conversation, message by message. */
export function personTexts(messages: readonly SintrUIMessage[]): string[] {
  return messages
    .filter((m) => m.role === "user")
    .map(textOf)
    .filter((text) => text.length > 0);
}

/** Once the diary stopped for a crisis, it stays stopped in this conversation. */
export function isInCrisis(messages: readonly SintrUIMessage[]): boolean {
  return messages.some((m) => m.role === "assistant" && m.parts.some((part) => part.type === "data-crisis"));
}

export function hasContent(message: SintrUIMessage): boolean {
  return message.parts.some(
    (part) => part.type !== "step-start" && (part.type !== "text" || part.text.trim().length > 0),
  );
}

/** How many earlier messages the model sees. Older ones stay stored. */
export const HISTORY_LIMIT = 40;

/**
 * What the model sees: the recent messages, with every draft's current
 * status (saved, edited, discarded) written into its tool result, so the
 * model never claims a save that did not happen. In crisis mode only text
 * is kept, and no tools are offered.
 */
export async function toModelMessages(
  messages: readonly SintrUIMessage[],
  options: { states: ReadonlyMap<string, ProposalState>; textOnly: boolean; tools?: ToolSet },
): Promise<ModelMessage[]> {
  const recent = messages.slice(-HISTORY_LIMIT);
  const prepared = recent.map((message) => ({
    ...message,
    parts: message.parts.flatMap((part): SintrUIMessage["parts"] => {
      if (part.type === "text") return [part];
      if (options.textOnly) return [];
      if (
        (part.type === "tool-propose_entry" || part.type === "tool-propose_checkin") &&
        part.state === "output-available" &&
        part.output.ok
      ) {
        const state = options.states.get(part.output.proposalId);
        const output = {
          ...part.output,
          status: state?.status ?? "proposed",
          editedByPerson: state?.edited ?? false,
        };
        // The model's view only: the stored part keeps its original output.
        return [{ ...part, output }];
      }
      return [part];
    }),
  }));
  return convertToModelMessages(
    prepared.filter((message) => message.parts.length > 0),
    {
      ...(options.tools ? { tools: options.tools } : {}),
      ignoreIncompleteToolCalls: true,
      // Data parts (crisis, proposal updates) are for the screen, not the model.
      convertDataPart: () => undefined,
    },
  );
}
