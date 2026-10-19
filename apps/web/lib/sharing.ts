import type { NoticeView, PracticeCard, SeatUse, ShareMode } from "@sintr/core";

/**
 * The words of sharing, on both sides of a link. Plain and exact: what the
 * therapist can see is said the same way everywhere, and nothing here
 * promises more than the code does.
 */

/** The one sentence that says what a link allows. */
export const SCOPE_SENTENCE = "Your therapist can read the reports you approve; nothing else.";

/** What never travels through a link, whatever the person chooses. */
export const NEVER_SHARED = "Never your entries, check-ins, conversations or drafts.";

/** The other two promises of a practice's invite, said the same way wherever it is answered. */
export const EACH_REPORT =
  "You choose for each report, unless you decide otherwise. Nothing goes to them until you approve it.";
export const STOP_ANY_TIME = "You can stop at any time, and they lose access at once.";

export const MODE_COPY: Record<ShareMode, { label: string; sentence: string }> = {
  ask: {
    label: "Ask me each time",
    sentence: "Each time you approve a report, you choose whether it goes to them.",
  },
  auto: {
    label: "Send what I approve",
    sentence: "Every report you approve goes to them as you approve it.",
  },
};

/** "Clínica Horizonte, CRP 06/1234", or null when the professional showed neither. */
export function practiceDetails(card: Pick<PracticeCard, "practiceName" | "registration">): string | null {
  const parts = [card.practiceName, card.registration].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(", ") : null;
}

/** The professional's name, with the practice when there is one: "Dr. Marina Costa (Clínica Horizonte)". */
export function practiceWho(card: Pick<PracticeCard, "professionalName" | "practiceName">): string {
  return card.practiceName ? `${card.professionalName} (${card.practiceName})` : card.professionalName;
}

/** The name a person chose, or a neutral label the practice can tell apart. */
export function patientLabel(patient: { personName: string | null; number: number | null }): string {
  if (patient.personName) return patient.personName;
  return patient.number ? `Patient ${patient.number}` : "A patient";
}

/** "3 active patients. 4 of 10 seats in use, 1 of them waiting for an acceptance." */
export function seatsLine(use: SeatUse): string {
  const patients = `${use.active} active ${use.active === 1 ? "patient" : "patients"}.`;
  if (use.seats === null) return `${patients} Unlimited seats.`;
  const inUse = use.active + use.held;
  const held = use.held ? `, ${use.held} of them waiting for an acceptance` : "";
  return `${patients} ${inUse} of ${use.seats} ${use.seats === 1 ? "seat" : "seats"} in use${held}.`;
}

/** A notice, worded for the side it was written for. */
export function noticeText(notice: NoticeView): string {
  if (notice.side === "person") {
    const who = notice.practice?.professionalName ?? "Your therapist's practice";
    switch (notice.kind) {
      case "link_pending":
        return `${who} accepted your invite. Confirm it to start sharing.`;
      case "link_ended":
        return `${who} ended the link. They no longer see your reports.`;
      case "link_declined":
        return `${who} withdrew from your invite. Nothing was shared.`;
      default:
        return `${who} updated the link.`;
    }
  }
  const who = notice.personName ?? (notice.number ? `Patient ${notice.number}` : "A patient");
  switch (notice.kind) {
    case "link_active":
      return `${who} linked with your practice.`;
    case "link_declined":
      return "A person you accepted chose not to link. Nothing was shared.";
    case "link_ended":
      return "A patient ended their link with your practice. Their reports are no longer here.";
    case "report_shared":
      return `${who} shared a report with you.`;
    default:
      return `${who} updated their link.`;
  }
}

/** The path a code opens. */
export function joinPath(code: string): string {
  return `/join/${encodeURIComponent(code)}`;
}

const FORTNIGHT = 14 * 24 * 60 * 60 * 1000;

/** One side's notices of the last two weeks, at most five, newest first. */
export function recentNotices(
  notices: readonly NoticeView[],
  side: NoticeView["side"],
  options: { skip?: NoticeView["kind"] } = {},
  now: number = Date.now(),
): NoticeView[] {
  return notices
    .filter((n) => n.side === side && n.kind !== options.skip && now - n.createdAt.getTime() < FORTNIGHT)
    .slice(0, 5);
}
