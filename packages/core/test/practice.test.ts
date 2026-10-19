import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateMasterKey, inviteCodeHash, parseMasterKey } from "../src/crypto";
import { links, sharedReports, users } from "../src/db/schema";
import { PRACTICE_LINK_CONSENT_VERSION, REPORT_SHARE_CONSENT_VERSION } from "../src/domain";
import { memoryTransport } from "../src/email";
import { InvalidStateError, NotFoundError, ValidationError } from "../src/errors";
import { createLogger } from "../src/log";
import { purgeStaleInvites } from "../src/maintenance";
import { formatInviteCode, generateInviteCode, normalizeInviteCode } from "../src/practice/code";
import { sendPracticeNotices } from "../src/practice/notices";
import { setPracticePlan } from "../src/practice/plan";
import { collectDigest } from "../src/report/collect";
import { parseContent, serializeContent } from "../src/report/content";
import { draftContent } from "../src/report/draft";
import { approveReport, editReport } from "../src/report/service";
import { approveAndShare, shareReport, sharedPaper } from "../src/report/share";
import { createRepositories, type UserScope } from "../src/repositories";
import { DEMO_PERIOD, DEMO_TO_BRING, DEMO_TZ, seedDemoDiary } from "./report-fixtures";
import { createUser, openTestDatabase, testMasterKey } from "./support";

/**
 * F4: a practice, invites both ways (double opt-in), the link and its
 * consent, seats, sharing approved reports, and ending a link from either
 * side. Against a real Postgres; no network, an in-memory email transport.
 */

const DAY = 24 * 60 * 60 * 1000;
const fakePdf = async (html: string) => new Uint8Array(Buffer.from(`%PDF-1.7 ${html.length} %%EOF`));
const log = createLogger({ level: "error" });
const handle = openTestDatabase();
const repositories = createRepositories(handle.db, testMasterKey);

afterAll(() => handle.close());

async function account(label: string, options: { verified?: boolean } = {}): Promise<UserScope> {
  const id = await createUser(handle.db, label);
  if (options.verified) await handle.db.update(users).set({ emailVerified: true }).where(eq(users.id, id));
  await repositories.provision(id);
  return repositories.forUser(id);
}

async function emailOf(scope: UserScope): Promise<string> {
  const [row] = await handle.db.select({ email: users.email }).from(users).where(eq(users.id, scope.userId));
  return row!.email;
}

async function therapist(label: string, name = `Dr. ${label}`): Promise<UserScope> {
  const scope = await account(label, { verified: true });
  await scope.practice.open({
    professionalName: name,
    practiceName: `${label} clinic`,
    registration: "CRP 06/0001",
  });
  return scope;
}

/** A person with a week of diary and one report, approved (its final PDF printed). */
async function personWithReport(label: string): Promise<{ scope: UserScope; reportId: string }> {
  const scope = await account(label);
  await seedDemoDiary(scope);
  const digest = await collectDigest(scope, DEMO_PERIOD, DEMO_TZ);
  const content = {
    ...draftContent({ digest, language: "pt", toBring: DEMO_TO_BRING }),
    week: "Uma semana puxada.",
  };
  const draft = await scope.reports.createDraft({
    periodStart: DEMO_PERIOD.start,
    periodEnd: DEMO_PERIOD.end,
    sessionAt: DEMO_PERIOD.session,
    content: serializeContent(content),
  });
  await approveReport(scope, draft.id, fakePdf);
  return { scope, reportId: draft.id };
}

async function draftFor(scope: UserScope, endOffsetDays: number): Promise<string> {
  const digest = await collectDigest(scope, DEMO_PERIOD, DEMO_TZ);
  const content = draftContent({ digest, language: "pt", toBring: DEMO_TO_BRING });
  const end = new Date(DEMO_PERIOD.end.getTime() + endOffsetDays * DAY);
  const draft = await scope.reports.createDraft({
    periodStart: DEMO_PERIOD.start,
    periodEnd: end,
    sessionAt: new Date(DEMO_PERIOD.session.getTime() + endOffsetDays * DAY),
    content: serializeContent(content),
  });
  return draft.id;
}

/** Link a person to a practice the practice's way: the practice invites, the person accepts. */
async function linkThroughInvite(
  practice: UserScope,
  person: UserScope,
  options: { personName?: string | null; shareMode?: "ask" | "auto" } = {},
) {
  const invite = await practice.practice.createInvite();
  return person.sharing.acceptInvite(invite.code, { consent: true, ...options });
}

describe("invite codes", () => {
  it("are 12 characters of an unambiguous alphabet, read as XXXX-XXXX-XXXX", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateInviteCode()));
    expect(codes.size).toBe(200);
    for (const code of codes) expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{12}$/);
    expect(formatInviteCode("ABCD2345WXYZ")).toBe("ABCD-2345-WXYZ");
  });

  it("forgive case, spaces, dashes and the letters that look like digits", () => {
    expect(normalizeInviteCode("abcd-2345-wxyz")).toBe("ABCD2345WXYZ");
    expect(normalizeInviteCode(" abcd 2345 wxyz ")).toBe("ABCD2345WXYZ");
    expect(normalizeInviteCode("ABCD-I345-WXOZ")).toBe("ABCD1345WX0Z");
    expect(normalizeInviteCode("ABCD-L345-WXYZ")).toBe("ABCD1345WXYZ");
    for (const bad of ["", "ABCD", "ABCD-2345-WXYZ-0", "ABCD-2345-WXYU", "ABCD/2345/WXYZ", "x".repeat(80)]) {
      expect(normalizeInviteCode(bad), bad).toBeNull();
    }
  });

  it("are looked up by a hash keyed by the master key, so a dump alone cannot be searched for them", () => {
    const other = parseMasterKey(generateMasterKey(), "k1");
    expect(inviteCodeHash(testMasterKey, "ABCD2345WXYZ")).toMatch(/^[0-9a-f]{64}$/);
    expect(inviteCodeHash(testMasterKey, "ABCD2345WXYZ")).toBe(inviteCodeHash(testMasterKey, "ABCD2345WXYZ"));
    expect(inviteCodeHash(other, "ABCD2345WXYZ")).not.toBe(inviteCodeHash(testMasterKey, "ABCD2345WXYZ"));
  });
});

describe("a practice", () => {
  it("is opened once per account, with names sealed and seats from the installation's defaults", async () => {
    const scope = await account("opener");
    expect(await scope.practice.get()).toBeNull();
    const opened = await scope.practice.open({
      professionalName: "Dr. Marina Costa",
      registration: "CRP 06/1234",
    });
    expect(opened).toMatchObject({
      professionalName: "Dr. Marina Costa",
      practiceName: null,
      registration: "CRP 06/1234",
      plan: "Self-hosted",
      seats: null,
      seatSource: "config",
      notifyEmail: false,
    });
    await expect(scope.practice.open({ professionalName: "again" })).rejects.toBeInstanceOf(
      InvalidStateError,
    );
    const updated = await scope.practice.update({ practiceName: "Clínica Horizonte", notifyEmail: true });
    expect(updated).toMatchObject({ practiceName: "Clínica Horizonte", notifyEmail: true });
    await expect(scope.practice.open({ professionalName: "" })).rejects.toBeInstanceOf(ValidationError);
    const actions = (await scope.auditLog.list()).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["practice.opened", "practice.updated"]));
  });

  it("follows the configured plan, until the admin path grants one of its own", async () => {
    const hosted = createRepositories(handle.db, testMasterKey, {
      practiceDefaults: { plan: "Hosted", seats: 0 },
    });
    const id = await createUser(handle.db, "hosted");
    await hosted.provision(id);
    const scope = await hosted.forUser(id);
    await scope.practice.open({ professionalName: "Dr. Hosted" });
    expect(await scope.practice.seats()).toEqual({ plan: "Hosted", seats: 0, active: 0, held: 0, free: 0 });
    await expect(scope.practice.createInvite()).rejects.toThrow("no seat is free");

    const email = await emailOf(scope);
    await setPracticePlan(handle.db, { email: email.toUpperCase(), grant: { plan: "Practice 1", seats: 1 } });
    expect(await scope.practice.seats()).toMatchObject({ plan: "Practice 1", seats: 1, free: 1 });
    expect(await scope.practice.get()).toMatchObject({ seatSource: "grant", plan: "Practice 1", seats: 1 });
    await setPracticePlan(handle.db, { email: email, grant: null });
    expect(await scope.practice.get()).toMatchObject({ seatSource: "config", plan: "Hosted", seats: 0 });
    await expect(
      setPracticePlan(handle.db, { email: "nobody@example.test", grant: null }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      setPracticePlan(handle.db, { email: email, grant: { plan: "x", seats: -1 } }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await scope.auditLog.list()).filter((e) => e.action === "practice.plan_changed")).toHaveLength(2);
  });
});

describe("seats", () => {
  it("are held by a pending invite, taken by an accepted one, and freed by revoking or ending", async () => {
    const practice = await therapist("seats");
    const email = await emailOf(practice);
    await setPracticePlan(handle.db, { email: email, grant: { plan: "Two", seats: 2 } });

    const first = await practice.practice.createInvite({ note: "for Ana" });
    expect(first.note).toBe("for Ana");
    const second = await practice.practice.createInvite();
    expect(await practice.practice.seats()).toMatchObject({ active: 0, held: 2, free: 0 });
    await expect(practice.practice.createInvite()).rejects.toThrow("no seat is free");

    expect(await practice.practice.revokeInvite(second.id)).toBe(true);
    expect(await practice.practice.revokeInvite(second.id)).toBe(false);
    expect(await practice.practice.seats()).toMatchObject({ held: 1, free: 1 });

    const ana = await account("seat-ana");
    const link = await ana.sharing.acceptInvite(first.code, { consent: true });
    expect(await practice.practice.seats()).toMatchObject({ active: 1, held: 0, free: 1 });

    // An expired invite holds nothing.
    await practice.practice.createInvite({}, new Date(Date.now() - 8 * DAY));
    expect(await practice.practice.seats()).toMatchObject({ active: 1, held: 0, free: 1 });

    expect(await ana.sharing.end(link.id)).toBe(true);
    expect(await practice.practice.seats()).toMatchObject({ active: 0, held: 0, free: 2 });
  });

  it("refuse an acceptance when seats were reduced below what is taken", async () => {
    const practice = await therapist("shrink");
    const email = await emailOf(practice);
    await setPracticePlan(handle.db, { email: email, grant: { plan: "One", seats: 1 } });
    const invite = await practice.practice.createInvite();
    await setPracticePlan(handle.db, { email: email, grant: { plan: "None", seats: 0 } });
    const person = await account("shrink-person");
    await expect(person.sharing.acceptInvite(invite.code, { consent: true })).rejects.toThrow(
      "no seat is free",
    );
    expect(await person.sharing.links()).toEqual([]);
  });
});

describe("a practice invites a person", () => {
  let practice: UserScope;
  let person: UserScope;

  beforeAll(async () => {
    practice = await therapist("inviting", "Dr. Marina Costa");
    person = await account("invited");
  });

  it("shows who is inviting to anyone holding the code, and nothing for a code that does not work", async () => {
    const invite = await practice.practice.createInvite();
    expect(invite).toMatchObject({ direction: "practice_to_person", status: "pending" });
    expect(invite.code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    const preview = await repositories.previewInvite(invite.code.toLowerCase(), null);
    expect(preview).toMatchObject({
      status: "valid",
      direction: "practice_to_person",
      own: false,
      practice: { professionalName: "Dr. Marina Costa", practiceName: "inviting clinic" },
    });
    expect(await repositories.previewInvite(invite.code, practice.userId)).toMatchObject({ own: true });
    expect(await repositories.previewInvite("0000-0000-0000", null)).toEqual({ status: "invalid" });
    expect(await repositories.previewInvite("not a code", null)).toEqual({ status: "invalid" });
    expect(await repositories.previewInvite(invite.code, null, new Date(Date.now() + 8 * DAY))).toEqual({
      status: "invalid",
    });
    await practice.practice.revokeInvite(invite.id);
    expect(await repositories.previewInvite(invite.code, null)).toEqual({ status: "invalid" });
    await expect(person.sharing.acceptInvite(invite.code, { consent: true })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("becomes an active link only with the person's yes and consent, recorded and audited on both sides", async () => {
    const invite = await practice.practice.createInvite();
    await expect(
      person.sharing.acceptInvite(invite.code, { consent: false as unknown as true }),
    ).rejects.toBeInstanceOf(InvalidStateError);
    expect(await person.sharing.links()).toEqual([]);

    const link = await person.sharing.acceptInvite(invite.code, { consent: true, personName: "Ana" });
    expect(link).toMatchObject({
      status: "active",
      personName: "Ana",
      shareMode: "ask",
      practice: { professionalName: "Dr. Marina Costa", registration: "CRP 06/0001" },
      shares: [],
    });

    const [consent] = (await person.consents.list()).filter((c) => c.purpose === "practice_link");
    expect(consent).toMatchObject({
      granted: true,
      version: PRACTICE_LINK_CONSENT_VERSION,
      linkId: link.id,
      recipient: "Dr. Marina Costa, inviting clinic, CRP 06/0001",
    });
    expect((await practice.practice.invites()).find((i) => i.id === invite.id)?.status).toBe("accepted");
    await expect(person.sharing.acceptInvite(invite.code, { consent: true })).rejects.toBeInstanceOf(
      NotFoundError,
    );

    const patients = await practice.practice.patients();
    expect(patients).toEqual([expect.objectContaining({ id: link.id, status: "active", personName: "Ana" })]);
    expect(patients[0]!.activeSince).toBeInstanceOf(Date);

    for (const scope of [person, practice]) {
      const actions = (await scope.auditLog.list()).map((e) => e.action);
      expect(actions).toEqual(expect.arrayContaining(["invite.accepted", "link.activated"]));
    }
    expect((await person.auditLog.list()).map((e) => e.action)).toContain("consent.recorded");
    const [notice] = await practice.notices.list();
    expect(notice).toMatchObject({
      kind: "link_active",
      side: "practice",
      personName: "Ana",
      linkId: link.id,
    });
    expect(await practice.notices.unread()).toEqual({ person: 0, practice: 1 });
    await practice.notices.markRead("practice");
    expect(await practice.notices.unread()).toEqual({ person: 0, practice: 0 });

    // One open link per person and practice.
    const again = await practice.practice.createInvite();
    await expect(person.sharing.acceptInvite(again.code, { consent: true })).rejects.toThrow(
      "already linked",
    );
  });

  it("is refused by the practice's own account", async () => {
    const invite = await practice.practice.createInvite();
    await expect(practice.sharing.acceptInvite(invite.code, { consent: true })).rejects.toThrow(
      "this is your own practice",
    );
  });

  it("gives a neutral number when the person chooses no name", async () => {
    const quiet = await account("unnamed");
    const link = await linkThroughInvite(practice, quiet);
    const listed = (await practice.practice.patients()).find((p) => p.id === link.id)!;
    expect(listed.personName).toBeNull();
    expect(listed.number).toBeGreaterThan(1);
    expect(await quiet.sharing.rename(link.id, "R.")).toBe(true);
    expect((await practice.practice.patients()).find((p) => p.id === link.id)?.personName).toBe("R.");
    expect(await quiet.sharing.rename(link.id, null)).toBe(true);
    expect((await practice.practice.patients()).find((p) => p.id === link.id)?.personName).toBeNull();
  });
});

describe("a person invites their therapist", () => {
  it("needs the therapist to accept from a practice, then the person to confirm it, with consent", async () => {
    const person = await account("asker");
    const invite = await person.sharing.createInvite({ personName: "Bia" });
    expect(invite).toMatchObject({ direction: "person_to_practice", status: "pending", personName: "Bia" });

    const professional = await account("asked", { verified: true });
    // Without a practice there is nothing to accept with.
    await expect(professional.practice.acceptInvite(invite.code)).rejects.toBeInstanceOf(NotFoundError);
    expect(await repositories.previewInvite(invite.code, professional.userId)).toMatchObject({
      status: "valid",
      direction: "person_to_practice",
      personName: "Bia",
      own: false,
    });
    await professional.practice.open({ professionalName: "Dr. Bruno Lima" });
    const pending = await professional.practice.acceptInvite(invite.code);
    expect(pending).toMatchObject({ status: "pending", personName: "Bia", activeSince: null });
    expect(await professional.practice.seats()).toMatchObject({ active: 0, held: 1 });
    await expect(professional.practice.acceptInvite(invite.code)).rejects.toBeInstanceOf(NotFoundError);

    // The person learns of it, and nothing can be shared until they confirm.
    const [notice] = await person.notices.list();
    expect(notice).toMatchObject({
      kind: "link_pending",
      side: "person",
      practice: { professionalName: "Dr. Bruno Lima" },
    });
    const [link] = await person.sharing.links();
    expect(link).toMatchObject({ status: "pending", personName: "Bia" });
    expect((await person.consents.list()).filter((c) => c.purpose === "practice_link")).toEqual([]);

    const confirmed = await person.sharing.confirm(link!.id, { consent: true });
    expect(confirmed.status).toBe("active");
    expect((await person.consents.list()).find((c) => c.purpose === "practice_link")).toMatchObject({
      linkId: link!.id,
      recipient: "Dr. Bruno Lima",
    });
    await expect(person.sharing.confirm(link!.id, { consent: true })).rejects.toBeInstanceOf(NotFoundError);
    expect(await professional.practice.seats()).toMatchObject({ active: 1, held: 0 });
    expect((await professional.notices.list())[0]).toMatchObject({ kind: "link_active", personName: "Bia" });
  });

  it("can be declined by the person, which records no consent and tells the practice", async () => {
    const person = await account("decliner");
    const invite = await person.sharing.createInvite();
    const professional = await therapist("declined");
    const pending = await professional.practice.acceptInvite(invite.code);
    expect(await person.sharing.decline(pending.id)).toBe(true);
    expect(await person.sharing.links()).toEqual([]);
    expect(await professional.practice.patients()).toEqual([]);
    expect((await person.consents.list()).filter((c) => c.purpose === "practice_link")).toEqual([]);
    expect((await professional.notices.list())[0]).toMatchObject({ kind: "link_declined", personName: null });
    expect((await person.auditLog.list()).map((e) => e.action)).toContain("link.declined");
  });

  it("can be withdrawn by the practice before the person confirms, and the person is told", async () => {
    const person = await account("withdrawn-from");
    const invite = await person.sharing.createInvite();
    const professional = await therapist("withdrawing", "Dr. Clara Melo");
    const pending = await professional.practice.acceptInvite(invite.code);
    expect(await professional.practice.endLink(pending.id)).toBe(true);
    expect(await person.sharing.links()).toEqual([]);
    const [notice] = await person.notices.list();
    expect(notice).toMatchObject({
      kind: "link_declined",
      side: "person",
      practice: { professionalName: "Dr. Clara Melo" },
    });
    expect((await professional.auditLog.list()).map((e) => e.action)).toContain("link.declined");
    expect((await person.consents.list()).filter((c) => c.purpose === "practice_link")).toEqual([]);
  });

  it("is refused by the person's own practice, and limited in number", async () => {
    const both = await therapist("both");
    const invite = await both.sharing.createInvite();
    await expect(both.practice.acceptInvite(invite.code)).rejects.toThrow("this is your own invite");
    for (let i = 0; i < 4; i += 1) await both.sharing.createInvite();
    await expect(both.sharing.createInvite()).rejects.toThrow("too many pending invites");
    expect(await both.sharing.revokeInvite(invite.id)).toBe(true);
    await both.sharing.createInvite();
  });
});

describe("sharing an approved report", () => {
  let practice: UserScope;
  let person: UserScope;
  let reportId: string;
  let linkId: string;

  beforeAll(async () => {
    practice = await therapist("receiver", "Dr. Carla Reis");
    ({ scope: person, reportId } = await personWithReport("sharer"));
    linkId = (await linkThroughInvite(practice, person, { personName: "Duda" })).id;
  });

  it("refuses a draft", async () => {
    const draftId = await draftFor(person, 7);
    await expect(shareReport(person, { reportId: draftId, linkId })).rejects.toBeInstanceOf(
      InvalidStateError,
    );
    await expect(
      person.sharing.deliver({ reportId: draftId, linkId, snapshot: {} as never, pdf: new Uint8Array(1) }),
    ).rejects.toBeInstanceOf(InvalidStateError);
    expect(await practice.practice.reports()).toEqual([]);
  });

  it("gives the practice a sealed copy of what was approved, with the person's consent naming the report", async () => {
    const approvedPdf = (await person.reports.readPdf(reportId))!;
    const shared = await shareReport(person, { reportId, linkId });
    expect(shared).toMatchObject({ reportId, firstReadAt: null });

    const consent = (await person.consents.list()).find((c) => c.purpose === "report_share");
    expect(consent).toMatchObject({
      granted: true,
      version: REPORT_SHARE_CONSENT_VERSION,
      reportId,
      linkId,
      recipient: "Dr. Carla Reis, receiver clinic, CRP 06/0001",
    });
    expect((await person.reports.get(reportId))?.sharedAt).toBeInstanceOf(Date);
    await expect(shareReport(person, { reportId, linkId })).rejects.toThrow("already shared");

    const [received] = await practice.practice.reports();
    expect(received).toMatchObject({ id: shared.id, personName: "Duda", linkId, firstReadAt: null });
    const [notice] = await practice.notices.list();
    expect(notice).toMatchObject({ kind: "report_shared", sharedReportId: shared.id, personName: "Duda" });

    const read = (await practice.practice.readReport(shared.id))!;
    const paper = sharedPaper(read.snapshot)!;
    expect(paper.content.week).toBe("Uma semana puxada.");
    expect(paper.numbers.counts.entries).toBeGreaterThan(0);
    expect(paper.period.session?.toISOString()).toBe(DEMO_PERIOD.session.toISOString());
    expect(read.firstReadAt).toBeInstanceOf(Date);
    const download = (await practice.practice.reportPdf(shared.id))!;
    expect(Buffer.from(download.pdf).equals(approvedPdf)).toBe(true);

    // The person sees that it was read; reading is in both audit logs.
    const [link] = await person.sharing.links();
    expect(link!.shares).toEqual([expect.objectContaining({ id: shared.id, reportId })]);
    expect(link!.shares[0]!.firstReadAt).toBeInstanceOf(Date);
    for (const scope of [person, practice]) {
      const actions = (await scope.auditLog.list()).map((e) => e.action);
      expect(actions).toEqual(expect.arrayContaining(["share.created", "share.read", "share.downloaded"]));
    }
  });

  it("makes the report's words final", async () => {
    const report = (await person.reports.get(reportId))!;
    await expect(editReport(person, reportId, JSON.parse(report.content!))).rejects.toThrow(
      "a shared report cannot change",
    );
    await expect(person.reports.edit(reportId, report.content!)).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("goes automatically on approval when the person chose it, and only as the page showed it", async () => {
    expect(await person.sharing.setShareMode(linkId, "auto")).toBe(true);
    const draftId = await draftFor(person, 14);
    // The page did not name the practice: nothing is approved.
    await expect(
      approveAndShare({ scope: person, reportId: draftId, render: fakePdf, shownLinks: [], log }),
    ).rejects.toBeInstanceOf(InvalidStateError);
    expect((await person.reports.get(draftId))?.status).toBe("draft");

    const result = await approveAndShare({
      scope: person,
      reportId: draftId,
      render: fakePdf,
      shownLinks: [linkId],
      log,
    });
    expect(result.report.status).toBe("reviewed");
    expect(result.failed).toEqual([]);
    expect(result.shared).toEqual([expect.objectContaining({ reportId: draftId })]);
    expect((await practice.practice.reports()).map((r) => r.reportId)).toContain(draftId);
    expect(
      (await person.consents.list()).filter((c) => c.purpose === "report_share" && c.reportId === draftId),
    ).toHaveLength(1);
    await person.sharing.setShareMode(linkId, "ask");
  });

  it("tells a professional who opted in by email: a link and a count, never a name or a word", async () => {
    const email = memoryTransport();
    const origin = "https://sintr.example.test";
    // Not opted in: nothing.
    expect(await sendPracticeNotices({ db: handle.db, email, origin, log })).toEqual({ sent: 0 });
    await practice.practice.update({ notifyEmail: true });
    expect(await sendPracticeNotices({ db: handle.db, email, origin, log })).toEqual({ sent: 1 });
    expect(email.sent).toHaveLength(1);
    const [message] = email.sent;
    expect(message!.subject).toBe("2 reports were shared with you");
    expect(message!.text).toContain(`${origin}/practice`);
    expect(message!.text).not.toContain("Duda");
    expect(message!.text).not.toContain("puxada");
    expect(message!.attachments).toBeUndefined();
    // Each report is told once.
    expect(await sendPracticeNotices({ db: handle.db, email, origin, log })).toEqual({ sent: 0 });
    await practice.practice.update({ notifyEmail: false });
  });
});

describe("what the person was shown, and what they approved", () => {
  it("refuses a consent when the practice changed its names since the page showed them", async () => {
    const practice = await therapist("renamed", "Dr. Before");
    const person = await account("shown");
    const invite = await practice.practice.createInvite();
    const shown = "Dr. Before, renamed clinic, CRP 06/0001";
    await practice.practice.update({ professionalName: "Dr. After" });
    await expect(
      person.sharing.acceptInvite(invite.code, { consent: true, shownPractice: shown }),
    ).rejects.toThrow("the practice changed since it was shown");
    expect(await person.sharing.links()).toEqual([]);
    expect((await person.consents.list()).filter((c) => c.purpose === "practice_link")).toEqual([]);
    const link = await person.sharing.acceptInvite(invite.code, {
      consent: true,
      shownPractice: "Dr. After, renamed clinic, CRP 06/0001",
    });
    expect((await person.consents.list()).find((c) => c.purpose === "practice_link")?.recipient).toBe(
      "Dr. After, renamed clinic, CRP 06/0001",
    );

    // The same for each report: the share names the practice as the report page showed it.
    const { scope: sharer, reportId } = await personWithReport("shown-sharer");
    const other = await linkThroughInvite(practice, sharer);
    await expect(
      shareReport(sharer, { reportId, linkId: other.id, shownPractice: "Dr. Before" }),
    ).rejects.toThrow("the practice changed since it was shown");
    expect(await practice.practice.reports()).toEqual([]);
    expect(link.status).toBe("active");
  });

  it("refuses a confirmation when the practice changed its names since the page showed them", async () => {
    const person = await account("confirm-shown");
    const invite = await person.sharing.createInvite();
    const professional = await therapist("confirm-renamed", "Dr. First");
    const pending = await professional.practice.acceptInvite(invite.code);
    await professional.practice.update({ registration: null });
    await expect(
      person.sharing.confirm(pending.id, {
        consent: true,
        shownPractice: "Dr. First, confirm-renamed clinic, CRP 06/0001",
      }),
    ).rejects.toThrow("the practice changed since it was shown");
    expect((await person.sharing.links())[0]?.status).toBe("pending");
  });

  it("gives the practice the highlighter of the approved report, even if the diary changed since", async () => {
    const practice = await therapist("highlight");
    const scope = await account("highlighter");
    await seedDemoDiary(scope);
    const digest = await collectDigest(scope, DEMO_PERIOD, DEMO_TZ);
    const quote = "eu sempre deixo a desejar";
    const content = {
      ...draftContent({ digest, language: "pt", toBring: DEMO_TO_BRING }),
      week: `Uma semana puxada: “${quote}”.`,
    };
    const draft = await scope.reports.createDraft({
      periodStart: DEMO_PERIOD.start,
      periodEnd: DEMO_PERIOD.end,
      sessionAt: DEMO_PERIOD.session,
      content: serializeContent(content),
    });
    const approved = await approveReport(scope, draft.id, fakePdf);
    const frozen = parseContent(approved.content)!.verified!;
    expect(frozen.length).toBeGreaterThan(0);

    // The person changes the entry the quote came from, after approving.
    const entry = (await scope.entries.list()).find((e) => e.thoughts?.includes(quote))!;
    await scope.entries.correct(entry.id, { thoughts: ["outra coisa"] });
    const link = await linkThroughInvite(practice, scope);
    const shared = await shareReport(scope, { reportId: draft.id, linkId: link.id });
    const read = (await practice.practice.readReport(shared.id))!;
    expect(read.snapshot.verified).toEqual(frozen);
    expect(sharedPaper(read.snapshot)!.check.verified.size).toBe(frozen.length);
  });
});

describe("ending a link", () => {
  it("by the person refuses the practice at once, destroys the link's key and withdraws the consent", async () => {
    const practice = await therapist("revoked");
    const { scope: person, reportId } = await personWithReport("revoker");
    const link = await linkThroughInvite(practice, person, { personName: "Eva" });
    const shared = await shareReport(person, { reportId, linkId: link.id });
    expect(await practice.practice.readReport(shared.id)).not.toBeNull();

    expect(await person.sharing.end(link.id)).toBe(true);
    expect(await person.sharing.end(link.id)).toBe(false);

    // Immediately: nothing to read, list or download.
    expect(await practice.practice.readReport(shared.id)).toBeNull();
    expect(await practice.practice.reportPdf(shared.id)).toBeNull();
    expect(await practice.practice.reports()).toEqual([]);
    expect(await practice.practice.patients()).toEqual([]);
    expect(await practice.practice.endLink(link.id)).toBe(false);
    expect(await person.sharing.links()).toEqual([]);

    // The copies are gone, and the link holds neither its key nor the name.
    expect(await handle.db.select().from(sharedReports).where(eq(sharedReports.linkId, link.id))).toEqual([]);
    const [row] = await handle.db.select().from(links).where(eq(links.id, link.id));
    expect(row).toMatchObject({
      status: "ended",
      endedBy: "person",
      wrappedKey: null,
      kekId: null,
      personName: null,
    });
    await expect(
      handle.db.execute(
        sql`update links set wrapped_key = '\\x01'::bytea, kek_id = 'k1' where id = ${link.id}`,
      ),
    ).rejects.toThrow();

    const withdrawal = (await person.consents.list()).find(
      (c) => c.purpose === "practice_link" && !c.granted,
    );
    expect(withdrawal).toMatchObject({ linkId: link.id, version: PRACTICE_LINK_CONSENT_VERSION });
    // The report stays final for the person, and the other side is told without the name.
    expect((await person.reports.get(reportId))?.sharedAt).toBeInstanceOf(Date);
    const notices = await practice.notices.list();
    expect(notices.map((n) => n.kind)).toEqual(["link_ended"]);
    expect(notices[0]).toMatchObject({ personName: null, side: "practice" });
    for (const scope of [person, practice]) {
      expect((await scope.auditLog.list()).map((e) => e.action)).toContain("link.ended");
    }
  });

  it("by the practice is the same end, and the person is told", async () => {
    const practice = await therapist("disconnecting", "Dr. Fabio Souza");
    const { scope: person, reportId } = await personWithReport("disconnected");
    const link = await linkThroughInvite(practice, person);
    const shared = await shareReport(person, { reportId, linkId: link.id });
    expect(await practice.practice.endLink(link.id)).toBe(true);
    expect(await practice.practice.readReport(shared.id)).toBeNull();
    expect(await person.sharing.links()).toEqual([]);
    const [notice] = await person.notices.list();
    expect(notice).toMatchObject({
      kind: "link_ended",
      side: "person",
      practice: { professionalName: "Dr. Fabio Souza" },
    });
    expect(await person.notices.unread()).toEqual({ person: 1, practice: 0 });
    // The person did not withdraw anything: no consent row is added.
    expect((await person.consents.list()).filter((c) => !c.granted)).toEqual([]);
    await expect(shareReport(person, { reportId, linkId: link.id })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("what the database itself refuses", () => {
  it("an active link without the person's consent, and a share through another person's link", async () => {
    const practice = await therapist("guarded");
    const { scope: person, reportId } = await personWithReport("guarded-person");
    const other = await account("guarded-other");
    const practiceRow = (await practice.practice.get())!;
    await expect(
      handle.db.execute(
        sql`insert into links (user_id, practice_id, status, number, kek_id, wrapped_key, person_accepted_at, practice_accepted_at)
            values (${person.userId}, ${practiceRow.id}, 'active', 99, 'k1', '\\x01'::bytea, now(), now())`,
      ),
    ).rejects.toThrow();

    const link = await linkThroughInvite(practice, person);
    const shared = await shareReport(person, { reportId, linkId: link.id });
    const [consent] = (await person.consents.list()).filter((c) => c.purpose === "report_share");
    await expect(
      handle.db.execute(
        sql`insert into shared_reports (user_id, link_id, report_id, consent_id, period_start, period_end, snapshot, pdf)
            values (${other.userId}, ${link.id}, ${reportId}, ${consent!.id}, now(), now(), '\\x01'::bytea, '\\x01'::bytea)`,
      ),
    ).rejects.toThrow();
    await expect(
      handle.db.execute(
        sql`insert into consents (user_id, purpose, version, granted) values (${person.userId}, 'practice_link', '1', true)`,
      ),
    ).rejects.toThrow();
    expect(shared.id).toBeTruthy();
  });
});

describe("stale invites", () => {
  it("are removed a month after they stopped being usable; pending ones stay", async () => {
    const practice = await therapist("stale");
    const old = new Date(Date.now() - 40 * DAY);
    const expired = await practice.practice.createInvite({}, old);
    const live = await practice.practice.createInvite();
    const { invites: removed } = await purgeStaleInvites(handle.db);
    expect(removed).toBeGreaterThanOrEqual(1);
    const left = (await practice.practice.invites()).map((i) => i.id);
    expect(left).toContain(live.id);
    expect(left).not.toContain(expired.id);
  });
});
