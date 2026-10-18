import type { CheckinInput, EntryInput, ProposalKind, UserScope } from "@sintr/core";
import type { ProposalState, RecentContext } from "./shapes";

/**
 * What the driver may do with the person's data, and nothing more. The app
 * passes `scopePorts(scope, conversationId)`; tests pass an in-memory fake.
 */
export interface CapturePorts {
  createProposal(
    input: { kind: "entry"; payload: EntryInput } | { kind: "checkin"; payload: CheckinInput },
  ): Promise<{ id: string }>;
  discardProposal(id: string): Promise<void>;
  /** The most recent draft still waiting for the person. */
  pendingProposal(): Promise<{ id: string; kind: ProposalKind } | null>;
  /** The person's explicit yes, given in words ("salva"). */
  confirmProposal(id: string): Promise<{ recordId: string }>;
  proposalStates(): Promise<Map<string, ProposalState>>;
  recentContext(): Promise<RecentContext>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_DAYS = 7;

function dayIn(date: Date, timezone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
}

/** The ports of one conversation, bound to one person's scope. */
export function scopePorts(
  scope: UserScope,
  conversationId: string,
  person: { timezone: string },
  now: () => Date = () => new Date(),
): CapturePorts {
  return {
    async createProposal(input) {
      const proposal = await scope.proposals.create({ conversationId, ...input });
      return { id: proposal.id };
    },

    async discardProposal(id) {
      await scope.proposals.discard(id);
    },

    async pendingProposal() {
      const pending = await scope.proposals.latestPending(conversationId);
      return pending ? { id: pending.id, kind: pending.kind } : null;
    },

    async confirmProposal(id) {
      const { record } = await scope.proposals.confirm(id);
      return { recordId: record.id };
    },

    async proposalStates() {
      const proposals = await scope.proposals.list(conversationId);
      return new Map(
        proposals.map((p) => [
          p.id,
          { kind: p.kind, status: p.status, recordId: p.recordId, edited: p.edited } satisfies ProposalState,
        ]),
      );
    },

    /** Minimal on purpose: dates, titles, emotions and scales, never full text. */
    async recentContext() {
      const from = new Date(now().getTime() - RECENT_DAYS * DAY_MS);
      const [entries, checkins] = await Promise.all([
        scope.entries.list({ from, limit: 10 }),
        scope.checkins.list({ from, limit: 14 }),
      ]);
      return {
        days: RECENT_DAYS,
        entries: entries.map((entry) => ({
          day: dayIn(entry.occurredAt, person.timezone),
          title: entry.title ?? (entry.situation ? entry.situation.slice(0, 120) : null),
          emotions: entry.emotions ?? [],
        })),
        checkins: checkins.map((checkin) => ({
          day: dayIn(checkin.occurredAt, person.timezone),
          mood: checkin.mood,
          energy: checkin.energy,
          anxiety: checkin.anxiety,
          sleepHours: checkin.sleepHours,
        })),
      };
    },
  };
}
