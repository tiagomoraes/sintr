import "server-only";
import {
  metered,
  parseStoredMessage,
  resolveAssistant,
  type AssistantProblem,
  type Metered,
  type SintrUIMessage,
} from "@sintr/agent";
import type { PersonPlan, Proposal, ProviderKind, UserScope } from "@sintr/core";
import type { LanguageModel } from "ai";
import type { ProposalView } from "@/lib/proposals";
import { runtime } from "./runtime";

/**
 * The model behind this person's conversation: their own key if they saved
 * one, otherwise the house assistant with its monthly meter. With
 * SINTR_FAKE_AGENT (tests) the same choice is made, and only the call is
 * replaced by the offline rehearsal model.
 */
export async function assistantFor(
  scope: UserScope,
): Promise<
  { ok: true; model: LanguageModel; metered: Metered | null } | { ok: false; problem: AssistantProblem }
> {
  const resolved = await resolveAssistant(scope, runtime().config);
  if (!resolved.ok) return { ok: false, problem: resolved.problem };
  return {
    ok: true,
    model: resolved.model,
    metered: resolved.source === "house" ? metered(scope, "assistantMessages") : null,
  };
}

/** This month's messages with the house assistant: used, the plan's limit (null for none), and when it starts again. */
export interface MessageMeter {
  used: number;
  limit: number | null;
  next: string;
}

/**
 * What the screens say about the assistant, never a key: the person's own
 * provider, the house assistant within their plan, or none yet (a self-host
 * without a house assistant, before the person brings a key).
 */
export type AssistantState =
  | { kind: "own"; provider: ProviderKind; model: string; house: boolean }
  | { kind: "house"; name: string; plan: PersonPlan; messages: MessageMeter }
  | { kind: "none" };

export async function assistantState(scope: UserScope): Promise<AssistantState> {
  const { house } = runtime().config;
  const settings = await scope.agentSettings.get();
  if (settings.provider && settings.model) {
    return { kind: "own", provider: settings.provider, model: settings.model, house: house !== null };
  }
  if (!house) return { kind: "none" };
  const month = await scope.plans.current();
  return {
    kind: "house",
    name: house.name,
    plan: month.plan,
    messages: {
      used: month.used.assistantMessages,
      limit: month.plan.allowance.assistantMessages,
      next: month.period.next,
    },
  };
}

export async function loadMessages(scope: UserScope, conversationId: string): Promise<SintrUIMessage[]> {
  const rows = await scope.conversations.messages(conversationId);
  return rows.map(parseStoredMessage).filter((message): message is SintrUIMessage => message !== null);
}

export function proposalView(proposal: Proposal): ProposalView {
  return {
    kind: proposal.kind,
    status: proposal.status,
    recordId: proposal.recordId,
    edited: proposal.edited,
    payload: proposal.payload,
  };
}

/** First words of the first message, as the conversation's (sealed) title. */
export function titleFrom(text: string): string {
  const flat = text.replace(/\s+/gu, " ").trim();
  if (flat.length <= 80) return flat;
  const cut = flat.slice(0, 80);
  const space = cut.lastIndexOf(" ");
  return `${space > 40 ? cut.slice(0, space) : cut}...`;
}
