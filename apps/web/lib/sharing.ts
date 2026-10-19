import type { NoticeView, PracticeCard, SeatUse } from "@sintr/core";
import type { Messages } from "@/messages";

/**
 * The sentences of sharing, on both sides of a link, built from the page's
 * words (`sharing` and `practice` in the catalog). Plain and exact: what the
 * therapist can see is said the same way everywhere, and nothing here
 * promises more than the code does.
 */

/** "Clínica Horizonte, CRP 06/1234", or null when the professional showed neither. */
export function practiceDetails(card: Pick<PracticeCard, "practiceName" | "registration">): string | null {
  const parts = [card.practiceName, card.registration].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(", ") : null;
}

/** The professional's name, with the practice when there is one: "Dr. Marina Costa (Clínica Horizonte)". */
export function practiceWho(card: Pick<PracticeCard, "professionalName" | "practiceName">): string {
  return card.practiceName ? `${card.professionalName} (${card.practiceName})` : card.professionalName;
}

/** The name a person chose, or a neutral label the practice can tell apart: "Patient 3". */
export function patientLabel(
  patient: { personName: string | null; number: number | null },
  t: Messages,
): string {
  if (patient.personName) return patient.personName;
  return patient.number ? t.practice.patient(patient.number) : t.practice.aPatient;
}

/** "3 active patients. 4 of 10 seats in use, 1 of them waiting for an acceptance." */
export function seatsLine(use: SeatUse, t: Messages): string {
  const seats = t.practice.seats;
  const patients = seats.active(use.active);
  if (use.seats === null) return `${patients} ${seats.unlimited}`;
  return `${patients} ${seats.inUse(use.active + use.held, use.seats, use.held)}`;
}

/** The plans sintr names itself; any other is a name someone gave a grant, shown as given. */
const BUILT_IN_PLANS = { "Self-hosted": "selfHosted", Free: "free", Practice: "practice" } as const;

/** A practice's plan, in the page's words when it is one of the built-in ones. */
export function practicePlanName(plan: string, t: Messages): string {
  return Object.hasOwn(BUILT_IN_PLANS, plan)
    ? t.practice.plans[BUILT_IN_PLANS[plan as keyof typeof BUILT_IN_PLANS]]
    : plan;
}

/** A notice, worded for the side it was written for. */
export function noticeText(notice: NoticeView, t: Messages): string {
  if (notice.side === "person") {
    const words = t.sharing.notices;
    const who = notice.practice?.professionalName ?? words.someone;
    switch (notice.kind) {
      case "link_pending":
        return words.pending(who);
      case "link_ended":
        return words.ended(who);
      case "link_declined":
        return words.declined(who);
      default:
        return words.other(who);
    }
  }
  const words = t.practice.notices;
  const who = patientLabel(notice, t);
  switch (notice.kind) {
    case "link_active":
      return words.active(who);
    case "link_declined":
      return words.declined;
    case "link_ended":
      return words.ended;
    case "report_shared":
      return words.shared(who);
    default:
      return words.other(who);
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
