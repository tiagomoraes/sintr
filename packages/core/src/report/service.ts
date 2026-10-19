/**
 * What can happen to a report, on one person's scope: read it as a page,
 * approve it, change its words, send it, and tell the person it is ready.
 * The shells (the web app, the worker) call these; none of them sends
 * anything on its own initiative, and every send is the person's approval
 * of that one report to that one address, recorded before it leaves.
 */
import { REPORT_SEND_CONSENT_VERSION, type Report, type TherapySettings } from "../domain";
import { EmailError, isEmailAddress, reportEmail, reportReadyEmail, type EmailTransport } from "../email";
import { InvalidStateError, NotFoundError, ValidationError } from "../errors";
import type { Logger } from "../log";
import type { UserScope } from "../repositories";
import { checkReport, type ReportCheck } from "./check";
import { collectDigest, reportLedger } from "./collect";
import { MOMENT_PROSE, ReportContent, parseContent, serializeContent, type ReportLanguage } from "./content";
import { digestNumbers, type DigestNumbers } from "./digest";
import { reportDocument } from "./document";
import { formatSession } from "./format";
import { calendarWeek, type ReportPeriod } from "./period";
import { localDay } from "./time";

/** A stored report's period, as the planner and the document know it. */
export function periodOf(
  report: Pick<Report, "sessionAt" | "periodStart" | "periodEnd">,
  timeZone: string,
): ReportPeriod {
  return report.sessionAt
    ? {
        kind: "session",
        label: localDay(report.sessionAt, timeZone),
        start: report.periodStart,
        end: report.periodEnd,
        session: report.sessionAt,
      }
    : {
        kind: "week",
        label: calendarWeek(timeZone, report.periodStart).label,
        start: report.periodStart,
        end: report.periodEnd,
        session: null,
      };
}

/** Everything a report page or its PDF shows. */
export interface ReportView {
  report: Report;
  content: ReportContent;
  /** Live for a draft; frozen at approval. */
  numbers: DigestNumbers;
  period: ReportPeriod;
  check: ReportCheck;
  timeZone: string;
  person: { name: string | null };
  therapist: TherapySettings;
}

export async function reportView(scope: UserScope, report: Report): Promise<ReportView | null> {
  const content = parseContent(report.content);
  if (!content) return null;
  const [profile, therapist] = await Promise.all([scope.profile.get(), scope.therapySettings.get()]);
  const period = periodOf(report, profile.timezone);
  const numbers =
    report.status !== "draft" && content.numbers
      ? content.numbers
      : digestNumbers(await collectDigest(scope, period, profile.timezone));
  const live = checkReport(content, await reportLedger(scope, period, content));
  // Once approved, the highlighter is the one the person approved, like the numbers.
  const check =
    report.status !== "draft" && content.verified ? { ...live, verified: new Set(content.verified) } : live;
  return {
    report,
    content,
    numbers,
    period,
    check,
    timeZone: profile.timezone,
    person: { name: profile.displayName },
    therapist,
  };
}

export function reportHtml(view: ReportView): string {
  return reportDocument({
    content: view.content,
    numbers: view.numbers,
    period: view.period,
    check: view.check,
    status: view.report.status,
    person: view.person,
    therapist: { name: view.therapist.therapistName },
  });
}

/** The file name the therapist sees. */
export function reportFilename(period: ReportPeriod): string {
  return `sintr-report-${period.label}.pdf`;
}

/** The session as the report and its email name it. */
export function sessionText(period: ReportPeriod, timeZone: string, language: ReportLanguage): string {
  return period.session ? formatSession(period.session, timeZone, language) : period.label;
}

/**
 * The person approves the words: the numbers are frozen into the content
 * and the final PDF (no draft mark) is printed and stored. What is sent
 * later is exactly this PDF.
 */
export async function approveReport(
  scope: UserScope,
  reportId: string,
  render: (html: string) => Promise<Uint8Array>,
): Promise<Report> {
  const report = await scope.reports.get(reportId);
  if (!report) throw new NotFoundError("report");
  if (report.status !== "draft") throw new InvalidStateError("only a draft can be approved");
  const view = await reportView(scope, report);
  if (!view) throw new InvalidStateError("the report has no content");
  const content: ReportContent = {
    ...view.content,
    numbers: view.numbers,
    verified: [...view.check.verified],
  };
  const pdf = await render(reportHtml({ ...view, content, report: { ...report, status: "reviewed" } }));
  // Refused if the draft changed while the PDF was printing: what is approved is what was read.
  const reviewed = await scope.reports.markReviewed(reportId, {
    content: serializeContent(content),
    pdf,
    ...(report.content !== null ? { expected: report.content } : {}),
  });
  await scope.auditLog.record({ action: "report.reviewed", targetType: "report", targetId: reportId });
  return reviewed;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The person's change to the words. Only the prose may change: a moment's
 * thoughts, emotions and intensities are the entry's (to change them, the
 * person changes the entry), and the check-in notes are the check-ins'.
 * Moments, notes and items may be removed, never forged.
 */
export async function editReport(scope: UserScope, reportId: string, edited: unknown): Promise<Report> {
  const report = await scope.reports.get(reportId);
  if (!report) throw new NotFoundError("report");
  if (report.status === "sent") throw new InvalidStateError("a sent report cannot change");
  if (report.sharedAt) throw new InvalidStateError("a shared report cannot change");
  const stored = parseContent(report.content);
  if (!stored) throw new InvalidStateError("the report has no content");
  const parsed = ReportContent.safeParse(edited);
  if (!parsed.success)
    throw new ValidationError(parsed.error.issues.map((i) => i.path.join(".") || "content"));
  const next = parsed.data;
  const moments = new Map(stored.moments.map((m) => [m.entryId, m]));
  for (const moment of next.moments) {
    const original = moments.get(moment.entryId);
    if (!original) throw new ValidationError(["moments"]);
    const fixed = (m: typeof moment) =>
      Object.fromEntries(
        Object.entries(m).filter(([key]) => !(MOMENT_PROSE as readonly string[]).includes(key)),
      );
    if (!sameJson(fixed(moment), fixed(original))) throw new ValidationError(["moments"]);
  }
  const notes = new Map(stored.notes.map((n) => [n.checkinId, n]));
  if (next.notes.some((n) => !sameJson(n, notes.get(n.checkinId)))) throw new ValidationError(["notes"]);
  const content: ReportContent = {
    ...next,
    language: stored.language,
    author: stored.author,
    problem: stored.problem,
    numbers: null,
    verified: null,
  };
  const updated = await scope.reports.edit(reportId, serializeContent(content));
  await scope.auditLog.record({ action: "report.edited", targetType: "report", targetId: reportId });
  return updated;
}

/**
 * Send an approved report to the therapist: the person's approval of this
 * report to this address is recorded first (consent, audit), then the
 * approved PDF is emailed, then the report is marked sent with the
 * recipient and the time. `recipient` is the address the person saw when
 * they approved; if the settings changed since, nothing is sent.
 */
export async function sendReport(input: {
  scope: UserScope;
  email: EmailTransport;
  reportId: string;
  recipient: string;
  log: Logger;
}): Promise<Report> {
  const { email, reportId, log } = input;
  const checked = async (scope: UserScope) => {
    const report = await scope.reports.lockForSend(reportId);
    if (!report) throw new NotFoundError("report");
    if (report.status !== "reviewed") throw new InvalidStateError("approve the report before sending it");
    const [settings, profile] = await Promise.all([scope.therapySettings.get(), scope.profile.get()]);
    const recipient = settings.therapistContact;
    if (settings.deliveryChannel !== "email") throw new InvalidStateError("this report is kept, not sent");
    if (!recipient || !isEmailAddress(recipient) || recipient !== input.recipient) {
      throw new ValidationError(["recipient"]);
    }
    return { report, profile, recipient };
  };
  if (!email.available) throw new EmailError("email_off");

  // First the person's yes, on record before anything leaves (its own transaction, kept whatever follows).
  const consent = await input.scope.transaction(async (scope) => {
    const { recipient } = await checked(scope);
    const recorded = await scope.consents.record({
      purpose: "report_send",
      version: REPORT_SEND_CONSENT_VERSION,
      granted: true,
      reportId,
      recipient,
    });
    await scope.auditLog.record({
      action: "consent.recorded",
      targetType: "consent",
      targetId: recorded.id,
      metadata: { purpose: "report_send", version: REPORT_SEND_CONSENT_VERSION },
    });
    return recorded;
  });

  // Then the send, with the report row held: a second send of the same report
  // waits, then finds it sent, so the therapist never gets it twice.
  const outcome = await input.scope.transaction(
    async (scope): Promise<{ sent: Report } | { failed: string }> => {
      const { report, profile, recipient } = await checked(scope);
      const pdf = await scope.reports.readPdf(reportId);
      const content = parseContent(report.content);
      if (!pdf || !content) throw new InvalidStateError("the approved report has no PDF");
      const period = periodOf(report, profile.timezone);
      try {
        await email.send(
          reportEmail({
            to: recipient,
            language: content.language,
            personName: profile.displayName,
            session: sessionText(period, profile.timezone, content.language),
            pdf,
            filename: reportFilename(period),
          }),
        );
      } catch (error) {
        const code = error instanceof EmailError ? error.code : "send_failed";
        await scope.auditLog.record({
          action: "report.send_failed",
          targetType: "report",
          targetId: reportId,
          metadata: { code },
        });
        return { failed: code };
      }
      const sent = await scope.reports.markSent(reportId, consent.id);
      await scope.auditLog.record({
        action: "report.sent",
        targetType: "report",
        targetId: reportId,
        metadata: { channel: "email", consent_id: consent.id },
      });
      return { sent };
    },
  );
  if ("failed" in outcome) {
    log.warn("report.send_failed", { reportId, code: outcome.failed });
    throw new EmailError("send_failed");
  }
  log.info("report.sent", { reportId });
  return outcome.sent;
}

/**
 * Tell the person a report is ready, by email, when they asked for it and
 * their address is verified. The message holds a link, never the words.
 */
export async function notifyReportReady(input: {
  scope: UserScope;
  email: EmailTransport;
  report: Report;
  /** The app's origin, for the link. */
  origin: string;
  log: Logger;
}): Promise<boolean> {
  const { scope, email, report, log } = input;
  if (!email.available || report.notifiedAt) return false;
  const [settings, account, profile] = await Promise.all([
    scope.therapySettings.get(),
    scope.profile.account(),
    scope.profile.get(),
  ]);
  if (!settings.reportNoticeEmail || !account.emailVerified) return false;
  const session = report.sessionAt
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: profile.timezone,
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(report.sessionAt)
    : null;
  try {
    await email.send(
      reportReadyEmail({ to: account.email, url: `${input.origin}/reports/${report.id}`, session }),
    );
  } catch (error) {
    log.warn("report.notice_failed", { reportId: report.id, error });
    return false;
  }
  await scope.reports.markNotified(report.id);
  log.info("report.notified", { reportId: report.id });
  return true;
}
