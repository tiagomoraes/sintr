import type { ProposalKind, ProposalStatus } from "@sintr/core";

/** A draft as the conversation shows it: its decision, and what it holds. */
export interface ProposalView {
  kind: ProposalKind;
  status: ProposalStatus;
  recordId: string | null;
  edited: boolean;
  /** The stored draft (the person's edited version once they saved it). */
  payload: Record<string, unknown> | null;
}
