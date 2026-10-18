/**
 * The embedded agent (milestone F1). Interfaces only: nothing here runs yet.
 *
 * The capture conversation follows the pack's SKILL.md: a short, supportive
 * exchange that turns a difficult moment into a thought record in the
 * person's exact words. It is provider-agnostic: self-host brings its own
 * key (or a local Ollama), the SaaS uses zero-data-retention routes.
 *
 * Rules the driver will follow:
 * - the person's words are kept verbatim; nothing is paraphrased or translated;
 * - no diagnosis and no clinical claims;
 * - when a message suggests acute risk, journaling stops and the
 *   conversation points to human help (CVV 188, SAMU 192);
 * - message content never reaches logs.
 */
import type { EntryInput, MessageRole } from "@sintr/core";

export type ProviderId = "anthropic" | "openai" | "google" | "openrouter" | "ollama";

/** Bring your own key (self-host) or a managed route (SaaS). */
export interface ProviderConfig {
  readonly provider: ProviderId;
  readonly model: string;
  /** Absent for a local Ollama endpoint. Never logged. */
  readonly apiKey?: string;
  readonly baseUrl?: string;
}

export interface CrisisResource {
  readonly name: string;
  readonly number: string;
  readonly where: string;
}

export interface Turn {
  readonly role: Extract<MessageRole, "user" | "assistant">;
  readonly content: string;
}

/** What a capture session emits while the person talks. */
export type CaptureEvent =
  | { readonly type: "message"; readonly text: string }
  /** A proposed entry, shown for confirmation before anything is saved. */
  | { readonly type: "entry_draft"; readonly entry: EntryInput }
  /** Journaling stops; only human help is offered. */
  | { readonly type: "crisis"; readonly resources: readonly CrisisResource[] }
  | { readonly type: "done" };

export interface CaptureContext {
  /** The person's language, for the conversation (their words stay as they are). */
  readonly language: string;
  readonly timezone: string;
  readonly history: readonly Turn[];
}

export interface CaptureSession {
  send(text: string): AsyncIterable<CaptureEvent>;
  close(): Promise<void>;
}

export interface CaptureDriver {
  start(context: CaptureContext): Promise<CaptureSession>;
}

export type CreateCaptureDriver = (provider: ProviderConfig) => CaptureDriver;
