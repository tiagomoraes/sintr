import { tool } from "ai";
import { z } from "zod";
import { checkCheckinDraft, checkEntryDraft } from "./checks";
import type { CapturePorts } from "./ports";
import {
  CheckinDraft,
  EntryDraft,
  checkinInputFromDraft,
  entryInputFromDraft,
  type ProposeResult,
  type RecentContext,
} from "./shapes";

export interface ToolContext {
  ports: CapturePorts;
  /** The person's own messages in this conversation, for the word checks. */
  personTexts: readonly string[];
  /** The person's time zone, for a time the model writes without an offset. */
  timezone: string;
  /** Drafts stored during this turn, so a crisis can withdraw them. */
  proposedThisTurn: string[];
  onCrisis(language: string | undefined): void;
}

/**
 * The tools of the capture conversation. None of them writes a record:
 * propose_* store a draft the person must confirm, recent_context reads a
 * minimal summary, and signal_crisis stops the diary.
 */
export function captureTools(context: ToolContext) {
  return {
    propose_entry: tool({
      description:
        "Show the person a draft of the thought record, for them to confirm, edit or discard. Saves nothing. Include only what the person actually said.",
      inputSchema: EntryDraft,
      execute: async (draft): Promise<ProposeResult<EntryDraft>> => {
        const checked = checkEntryDraft(draft, context.personTexts, context);
        if (!checked.ok) return checked;
        const proposal = await context.ports.createProposal({
          kind: "entry",
          payload: entryInputFromDraft(checked.draft),
        });
        context.proposedThisTurn.push(proposal.id);
        return { ok: true, proposalId: proposal.id, draft: checked.draft };
      },
    }),

    propose_checkin: tool({
      description:
        "Show the person a draft of a quick check-in (mood, energy and anxiety from 0 to 5, sleep), with exactly what they gave. Saves nothing.",
      inputSchema: CheckinDraft,
      execute: async (draft): Promise<ProposeResult<CheckinDraft>> => {
        const checked = checkCheckinDraft(draft, context.personTexts, context);
        if (!checked.ok) return checked;
        const proposal = await context.ports.createProposal({
          kind: "checkin",
          payload: checkinInputFromDraft(checked.draft),
        });
        context.proposedThisTurn.push(proposal.id);
        return { ok: true, proposalId: proposal.id, draft: checked.draft };
      },
    }),

    recent_context: tool({
      description:
        "A short summary of the person's last seven days (dates, entry titles, emotions with intensities, check-in values). Use only when it helps.",
      inputSchema: z.object({}),
      execute: async (): Promise<RecentContext> => context.ports.recentContext(),
    }),

    signal_crisis: tool({
      description:
        "Call at once, writing nothing else, if the person signals acute risk: suicide, wanting to die, self-harm, or harming someone else. sintr stops the diary and shows them human help.",
      inputSchema: z.object({
        language: z
          .string()
          .max(20)
          .optional()
          .describe("The language the person is writing in, such as pt-BR."),
      }),
      execute: async ({ language }): Promise<{ stopped: true }> => {
        context.onCrisis(language);
        return { stopped: true };
      },
    }),
  };
}

export type CaptureTools = ReturnType<typeof captureTools>;
