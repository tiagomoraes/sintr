import { randomUUID } from "node:crypto";
import type { LanguageModelV4CallOptions } from "@ai-sdk/provider";
import { createLogger, type Logger } from "@sintr/core";
import type { CapturePorts } from "../src/ports";
import type { ProposalState, SintrUIMessage, SintrUIMessageChunk } from "../src/shapes";

export function user(text: string): SintrUIMessage {
  return { id: randomUUID(), role: "user", parts: [{ type: "text", text }] };
}

export function assistant(text: string, extra: SintrUIMessage["parts"] = []): SintrUIMessage {
  return { id: randomUUID(), role: "assistant", parts: [{ type: "text", text }, ...extra] };
}

interface StoredProposal {
  kind: "entry" | "checkin";
  payload: Record<string, unknown>;
  status: "proposed" | "saved" | "discarded";
  recordId: string | null;
}

/** In-memory ports: what the driver would have written, and nothing else. */
export function memoryPorts() {
  const proposals = new Map<string, StoredProposal>();
  const confirmed: string[] = [];
  let counter = 0;
  const ports: CapturePorts = {
    async createProposal(input) {
      const id = `proposal-${(counter += 1)}`;
      proposals.set(id, {
        kind: input.kind,
        payload: { ...input.payload },
        status: "proposed",
        recordId: null,
      });
      return { id };
    },
    async discardProposal(id) {
      proposals.get(id)!.status = "discarded";
    },
    async pendingProposal() {
      const pending = [...proposals.entries()].filter(([, p]) => p.status === "proposed").at(-1);
      return pending ? { id: pending[0], kind: pending[1].kind } : null;
    },
    async confirmProposal(id) {
      const proposal = proposals.get(id)!;
      proposal.status = "saved";
      proposal.recordId = `record-of-${id}`;
      confirmed.push(id);
      return { recordId: proposal.recordId };
    },
    async proposalStates() {
      return new Map(
        [...proposals.entries()].map(([id, p]) => [
          id,
          { kind: p.kind, status: p.status, recordId: p.recordId, edited: false } satisfies ProposalState,
        ]),
      );
    },
    async recentContext() {
      return { days: 7, entries: [], checkins: [] };
    },
  };
  return { ports, proposals, confirmed };
}

/** A logger whose lines are kept, to check that no content reaches them. */
export function capturedLogger(): { log: Logger; lines: string[] } {
  const lines: string[] = [];
  return { log: createLogger({ level: "debug", write: (_level, line) => lines.push(line) }), lines };
}

export async function collect(stream: ReadableStream<SintrUIMessageChunk>) {
  const chunks: SintrUIMessageChunk[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  const text = chunks
    .filter((c): c is Extract<SintrUIMessageChunk, { type: "text-delta" }> => c.type === "text-delta")
    .map((c) => c.delta)
    .join("");
  return { chunks, text, types: chunks.map((c) => c.type) };
}

/** The system instructions a model call received. */
export function instructionsOf(call: LanguageModelV4CallOptions): string {
  return call.prompt
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
}

export function toolNamesOf(call: LanguageModelV4CallOptions): string[] {
  return (call.tools ?? []).map((tool) => tool.name).sort();
}

/** The tool results the model saw on a call, as plain values. */
export function toolResultsOf(call: LanguageModelV4CallOptions): unknown[] {
  return call.prompt.flatMap((m) =>
    m.role === "tool"
      ? m.content
          .filter((p) => p.type === "tool-result")
          .map((p) => (p.output.type === "json" || p.output.type === "text" ? p.output.value : null))
      : [],
  );
}
