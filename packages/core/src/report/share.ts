/**
 * Sharing an approved report with a linked practice. What the practice
 * receives is a copy of what the person approved: the page (its words, its
 * frozen numbers, which quotes are the person's exact words) and the PDF
 * printed at approval, sealed with the link's key. A draft is never shared,
 * and nothing is shared without the person's yes for that report.
 */
import type { Report, ShareSummary, SharedReportSnapshot } from "../domain";
import { InvalidStateError, NotFoundError } from "../errors";
import type { Logger } from "../log";
import type { UserScope } from "../repositories";
import type { ReportCheck } from "./check";
import { ReportContent } from "./content";
import type { DigestNumbers } from "./digest";
import { approveReport, reportView, type ReportView } from "./service";

/** What the report page shows: the person's own view, or a practice's copy of it. */
export interface PaperView {
  report: Pick<Report, "status">;
  content: ReportContent;
  numbers: DigestNumbers;
  period: ReportView["period"];
  check: Pick<ReportCheck, "verified">;
  timeZone: string;
  person: { name: string | null };
}

export function snapshotOf(view: ReportView): SharedReportSnapshot {
  const { period } = view;
  return {
    v: 1,
    content: { ...view.content, numbers: view.numbers },
    period: {
      kind: period.kind,
      label: period.label,
      start: period.start.toISOString(),
      end: period.end.toISOString(),
      session: period.session ? period.session.toISOString() : null,
    },
    verified: [...view.check.verified],
    timeZone: view.timeZone,
    personName: view.person.name,
  };
}

/** A practice's copy, read back as the page it was. Null if it cannot be read as one. */
export function sharedPaper(snapshot: SharedReportSnapshot): PaperView | null {
  const parsed = ReportContent.safeParse(snapshot.content);
  if (snapshot.v !== 1 || !parsed.success || !parsed.data.numbers) return null;
  const { period } = snapshot;
  return {
    report: { status: "reviewed" },
    content: parsed.data,
    numbers: parsed.data.numbers,
    period: {
      kind: period.kind,
      label: period.label,
      start: new Date(period.start),
      end: new Date(period.end),
      session: period.session ? new Date(period.session) : null,
    },
    check: { verified: new Set(snapshot.verified) },
    timeZone: snapshot.timeZone,
    person: { name: snapshot.personName },
  };
}

/** Share one approved report with the practice of one of the person's active links. */
export async function shareReport(
  scope: UserScope,
  input: { reportId: string; linkId: string },
): Promise<ShareSummary> {
  const report = await scope.reports.get(input.reportId);
  if (!report) throw new NotFoundError("report");
  if (report.status === "draft") throw new InvalidStateError("approve the report before sharing it");
  const [view, pdf] = await Promise.all([reportView(scope, report), scope.reports.readPdf(report.id)]);
  if (!view || !pdf) throw new InvalidStateError("the approved report has no PDF");
  return scope.sharing.deliver({
    reportId: report.id,
    linkId: input.linkId,
    snapshot: snapshotOf(view),
    pdf,
  });
}

/** The person's active links set to "anything I approve goes to them". */
export async function automaticLinks(scope: UserScope): Promise<string[]> {
  return (await scope.sharing.links())
    .filter((link) => link.status === "active" && link.shareMode === "auto")
    .map((link) => link.id)
    .sort();
}

/**
 * Approve a report and share it with every practice the person chose to
 * receive what they approve. `shownLinks` are those the approve button named
 * when the person pressed it: if they changed since, nothing is approved.
 * A share that fails leaves the report approved and is reported back, to be
 * shared from the report.
 */
export async function approveAndShare(input: {
  scope: UserScope;
  reportId: string;
  render: (html: string) => Promise<Uint8Array>;
  shownLinks: readonly string[];
  log: Logger;
}): Promise<{ report: Report; shared: ShareSummary[]; failed: string[] }> {
  const { scope, reportId, log } = input;
  const automatic = await automaticLinks(scope);
  if (automatic.join() !== [...input.shownLinks].sort().join()) {
    throw new InvalidStateError("the practices that receive approved reports changed since the page opened");
  }
  const report = await approveReport(scope, reportId, input.render);
  const shared: ShareSummary[] = [];
  const failed: string[] = [];
  for (const linkId of automatic) {
    try {
      shared.push(await shareReport(scope, { reportId, linkId }));
    } catch (error) {
      failed.push(linkId);
      log.warn("report.share_failed", { reportId, error });
    }
  }
  return { report, shared, failed };
}
