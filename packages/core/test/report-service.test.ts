import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { users } from "../src/db/schema";
import { REPORT_SEND_CONSENT_VERSION } from "../src/domain";
import { EmailError, memoryTransport } from "../src/email";
import { InvalidStateError, ValidationError } from "../src/errors";
import { createLogger } from "../src/log";
import { collectDigest } from "../src/report/collect";
import { parseContent, serializeContent, type ReportContent } from "../src/report/content";
import { draftContent } from "../src/report/draft";
import { approveReport, editReport, notifyReportReady, reportView, sendReport } from "../src/report/service";
import { createRepositories, type UserScope } from "../src/repositories";
import { DEMO_PERIOD, DEMO_TO_BRING, DEMO_TZ, seedDemoDiary } from "./report-fixtures";
import { createUser, openTestDatabase, testMasterKey } from "./support";

const THERAPIST = "therapist@example.test";
const fakePdf = async (html: string) => new Uint8Array(Buffer.from(`%PDF-1.7 ${html.length} %%EOF`));
const log = createLogger({ level: "error" });

describe("the report service", () => {
  const handle = openTestDatabase();
  const repositories = createRepositories(handle.db, testMasterKey);
  let scope: UserScope;
  let userId: string;
  let content: ReportContent;

  async function newDraft(end: Date = DEMO_PERIOD.end) {
    return scope.reports.createDraft({
      periodStart: DEMO_PERIOD.start,
      periodEnd: end,
      sessionAt: DEMO_PERIOD.session,
      content: serializeContent(content),
    });
  }

  beforeAll(async () => {
    userId = await createUser(handle.db, "service");
    await repositories.provision(userId);
    scope = await repositories.forUser(userId);
    await seedDemoDiary(scope);
    await scope.therapySettings.update({ therapistContact: THERAPIST, deliveryChannel: "email" });
    const digest = await collectDigest(scope, DEMO_PERIOD, DEMO_TZ);
    content = {
      ...draftContent({ digest, language: "pt", toBring: DEMO_TO_BRING }),
      week: "Uma semana puxada.",
    };
  });

  afterAll(() => handle.close());

  it("reads a draft with live numbers, and freezes them when the person approves it", async () => {
    const draft = await newDraft();
    const view = (await reportView(scope, draft))!;
    expect(view.numbers.counts).toMatchObject({ entries: 4, days: 7 });
    expect(view.check.problems).toEqual([]);

    const reviewed = await approveReport(scope, draft.id, fakePdf);
    expect(reviewed).toMatchObject({ status: "reviewed", hasPdf: true });
    expect(parseContent(reviewed.content)?.numbers?.counts).toEqual(view.numbers.counts);
    // A check-in added later does not change an approved report.
    await scope.checkins.create({ occurredAt: new Date(DEMO_PERIOD.end.getTime() - 60_000), mood: 0 });
    expect((await reportView(scope, reviewed))!.numbers.counts).toEqual(view.numbers.counts);
    expect((await scope.auditLog.list()).map((e) => e.action)).toContain("report.reviewed");
    await expect(approveReport(scope, draft.id, fakePdf)).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("lets the person change the prose and remove items, never a moment's own words", async () => {
    const draft = await newDraft(new Date(DEMO_PERIOD.end.getTime() + 1));
    const stored = parseContent(draft.content)!;
    const edited = await editReport(scope, draft.id, {
      ...stored,
      week: "Escrito por mim.",
      moments: stored.moments
        .slice(1)
        .map((m, i) => (i === 0 ? { ...m, title: "Outro título", happened: "Contado do meu jeito." } : m)),
    });
    expect(parseContent(edited.content)).toMatchObject({ week: "Escrito por mim.", author: stored.author });
    expect(edited.editedAt).not.toBeNull();
    expect((await scope.reports.revisions(draft.id)).map((r) => r.sections)).toEqual([["week", "moments"]]);

    const moment = stored.moments[0]!;
    const forged = [
      { ...stored, moments: [{ ...moment, thoughts: ["um pensamento que nunca escrevi"] }] },
      { ...stored, moments: [{ ...moment, felt: [{ name: "ansiedade", intensity: 10 }] }] },
      { ...stored, moments: [{ ...moment, entryId: "00000000-0000-4000-8000-000000000000" }] },
      { ...stored, notes: [{ ...stored.notes[0]!, note: "outra nota" }] },
      { ...stored, week: 42 },
    ];
    for (const attempt of forged) {
      await expect(editReport(scope, draft.id, attempt)).rejects.toBeInstanceOf(ValidationError);
    }
  });

  it("sends only an approved report, only to the address the person saw, with consent recorded first", async () => {
    const email = memoryTransport();
    const draft = await newDraft(new Date(DEMO_PERIOD.end.getTime() + 2));
    await expect(
      sendReport({ scope, email, reportId: draft.id, recipient: THERAPIST, log }),
    ).rejects.toBeInstanceOf(InvalidStateError);
    await approveReport(scope, draft.id, fakePdf);
    await expect(
      sendReport({ scope, email, reportId: draft.id, recipient: "someone-else@example.test", log }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(email.sent).toEqual([]);

    const sent = await sendReport({ scope, email, reportId: draft.id, recipient: THERAPIST, log });
    expect(sent).toMatchObject({ status: "sent", recipient: THERAPIST });
    expect(sent.sentAt).not.toBeNull();
    const consent = (await scope.consents.list()).find((c) => c.id === sent.consentId)!;
    expect(consent).toMatchObject({
      purpose: "report_send",
      granted: true,
      reportId: draft.id,
      recipient: THERAPIST,
      version: REPORT_SEND_CONSENT_VERSION,
    });
    const [message] = email.sent;
    expect(message!.to).toBe(THERAPIST);
    expect(Buffer.from(message!.attachments![0]!.content)).toEqual(await scope.reports.readPdf(draft.id));
    expect(message!.attachments![0]!.filename).toBe("sintr-report-2026-10-19.pdf");
    const actions = (await scope.auditLog.list()).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["consent.recorded", "report.sent"]));
    expect(JSON.stringify(await scope.auditLog.list())).not.toContain(THERAPIST);
    // A sent report is final.
    await expect(scope.reports.edit(draft.id, serializeContent(content))).rejects.toBeInstanceOf(
      InvalidStateError,
    );
  });

  it("marks nothing sent when the email fails, and says so in the audit log", async () => {
    const email = memoryTransport();
    email.failing = true;
    const draft = await newDraft(new Date(DEMO_PERIOD.end.getTime() + 3));
    await approveReport(scope, draft.id, fakePdf);
    await expect(
      sendReport({ scope, email, reportId: draft.id, recipient: THERAPIST, log }),
    ).rejects.toBeInstanceOf(EmailError);
    expect(await scope.reports.get(draft.id)).toMatchObject({
      status: "reviewed",
      sentAt: null,
      recipient: null,
    });
    expect((await scope.auditLog.list()).map((e) => e.action)).toContain("report.send_failed");
  });

  it("keeps a report the person chose to keep, and refuses to send without email", async () => {
    const draft = await newDraft(new Date(DEMO_PERIOD.end.getTime() + 4));
    await approveReport(scope, draft.id, fakePdf);
    const off = {
      kind: "off" as const,
      available: false,
      send: async () => Promise.reject(new EmailError("email_off")),
    };
    await expect(
      sendReport({ scope, email: off, reportId: draft.id, recipient: THERAPIST, log }),
    ).rejects.toMatchObject({
      code: "email_off",
    });
    await scope.therapySettings.update({ deliveryChannel: "download" });
    await expect(
      sendReport({ scope, email: memoryTransport(), reportId: draft.id, recipient: THERAPIST, log }),
    ).rejects.toBeInstanceOf(InvalidStateError);
    await scope.therapySettings.update({ deliveryChannel: "email" });
  });

  it("tells the person a report is ready only when they asked, at a verified address, once", async () => {
    const email = memoryTransport();
    const draft = await newDraft(new Date(DEMO_PERIOD.end.getTime() + 5));
    const notify = () =>
      notifyReportReady({ scope, email, report: draft, origin: "http://localhost:3000", log });
    expect(await notify()).toBe(false); // not asked
    await scope.therapySettings.update({ reportNoticeEmail: true });
    expect(await notify()).toBe(false); // not verified
    await handle.db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));
    expect(await notify()).toBe(true);
    expect(email.sent[0]!.text).toContain(`http://localhost:3000/reports/${draft.id}`);
    expect(email.sent[0]!.text).not.toContain("Uma semana puxada");
    const again = await notifyReportReady({
      scope,
      email,
      report: (await scope.reports.get(draft.id))!,
      origin: "http://localhost:3000",
      log,
    });
    expect(again).toBe(false);
  });
});
