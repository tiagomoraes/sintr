import "server-only";
import {
  ProviderSetupError,
  createLanguageModel,
  parseStoredMessage,
  type SintrUIMessage,
} from "@sintr/agent";
import { rehearsalModel } from "@sintr/agent/testing";
import type { Proposal, UserScope } from "@sintr/core";
import type { LanguageModel } from "ai";
import type { ProposalView } from "@/lib/proposals";
import { runtime } from "./runtime";

export type AssistantProblem = "not_configured" | ProviderSetupError["code"];

/**
 * The model behind this person's conversation: their own provider and key.
 * With SINTR_FAKE_AGENT (tests) the settings are still required, and only
 * the call is replaced by the offline rehearsal model.
 */
export async function assistantFor(
  scope: UserScope,
): Promise<{ model: LanguageModel; rehearsal: boolean } | { problem: AssistantProblem }> {
  const { config } = runtime();
  const credentials = await scope.agentSettings.credentials();
  if (!credentials) return { problem: "not_configured" };
  if (config.fakeAgent) return { model: rehearsalModel(), rehearsal: true };
  try {
    return { model: createLanguageModel(credentials, { mode: config.mode }), rehearsal: false };
  } catch (error) {
    if (error instanceof ProviderSetupError) return { problem: error.code };
    throw error;
  }
}

/** Is there an assistant to talk to? */
export async function assistantReady(scope: UserScope): Promise<boolean> {
  return (await scope.agentSettings.credentials()) !== null;
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
