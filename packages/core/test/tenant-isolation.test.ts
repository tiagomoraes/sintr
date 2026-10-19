import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authenticateApiToken } from "../src/auth/api-tokens";
import { ConsentRequiredError, InvalidStateError, NotFoundError } from "../src/errors";
import { createRepositories, type UserScope } from "../src/repositories";
import { createUser, openTestDatabase, testMasterKey } from "./support";

/**
 * User A writes one row into every user-owned repository; user B, through
 * their own scope, must not be able to read, change or delete any of it.
 * Removing the `user_id` condition from any repository query makes one of
 * these assertions fail.
 */

interface Owned {
  entry: string;
  checkin: string;
  note: string;
  insight: string;
  report: string;
  consent: string;
  conversation: string;
  token: string;
  rawToken: string;
  proposal: string;
  memory: string;
}

describe("tenant isolation", () => {
  const handle = openTestDatabase();
  const repositories = createRepositories(handle.db, testMasterKey);
  let a: UserScope;
  let b: UserScope;
  const owned = {} as Owned;

  beforeAll(async () => {
    const aliceId = await createUser(handle.db, "alice");
    const bobId = await createUser(handle.db, "bob");
    await repositories.provision(aliceId);
    await repositories.provision(bobId);
    a = await repositories.forUser(aliceId);
    b = await repositories.forUser(bobId);

    await a.profile.update({ displayName: "Alice", timezone: "America/Sao_Paulo" });
    await a.therapySettings.update({ therapistName: "Dr. A", sessionDay: 3, sessionTime: "18:00" });
    owned.entry = (
      await a.entries.create({ situation: "alice's situation", thoughts: ["alice's thought"] })
    ).id;
    owned.checkin = (await a.checkins.create({ mood: 2, note: "alice's note" })).id;
    owned.note = (await a.therapyNotes.create({ kind: "goal", body: "alice's goal" })).id;
    owned.insight = (await a.insights.create({ kind: "helps", body: "alice's insight" })).id;
    const report = await a.reports.createDraft({
      periodStart: new Date("2026-10-01"),
      periodEnd: new Date("2026-10-08"),
    });
    owned.report = report.id;
    await a.reports.markReviewed(report.id);
    owned.consent = (
      await a.consents.record({
        purpose: "report_send",
        version: "1",
        granted: true,
        reportId: report.id,
        recipient: "therapist@example.test",
      })
    ).id;
    const conversation = await a.conversations.create({ title: "alice's chat" });
    owned.conversation = conversation.id;
    await a.conversations.append(conversation.id, { role: "user", content: "alice's message" });
    const created = await a.apiTokens.create({ name: "alice's agent", scopes: ["entries:read"] });
    owned.token = created.apiToken.id;
    owned.rawToken = created.token;
    await a.auditLog.record({
      action: "api_token.created",
      targetType: "api_token",
      targetId: created.apiToken.id,
    });
    // F1: A's assistant settings, a draft waiting in A's conversation, and a corrected entry.
    await a.agentSettings.update({
      provider: "anthropic",
      model: "a-model",
      apiKey: "alice-key-0123456789abcdef",
      conversationRetentionDays: 30,
    });
    owned.proposal = (
      await a.proposals.create({
        conversationId: conversation.id,
        kind: "entry",
        payload: { situation: "alice's draft" },
      })
    ).id;
    await a.entries.correct(owned.entry, { behavior: "alice's correction" }, { note: "alice's note" });
    await a.checkins.correct(owned.checkin, { sleepHours: 7 });
    // F10: A's memory, from A's entry, placed by meaning, and A's name in it.
    const entry = (await a.entries.get(owned.entry))!;
    owned.memory = (
      await a.memories.keep(
        { kind: "entry", id: owned.entry, updatedAt: entry.updatedAt },
        [{ kind: "moment", text: "alice's memory", quote: "alice's situation", embedding: [1, 0, 0, 0] }],
        { occurredAt: entry.occurredAt, space: { model: "test", dimensions: 4 } },
      )
    )[0]!.id;
    await a.memories.setName("Alice");
  });

  afterAll(() => handle.close());

  it("keeps A's assistant, drafts and corrections out of B's reach", async () => {
    expect(await b.agentSettings.get()).toMatchObject({ provider: null, hasKey: false, keyHint: null });
    expect(await b.agentSettings.credentials()).toBeNull();
    expect(await b.proposals.get(owned.proposal)).toBeNull();
    expect(await b.proposals.list(owned.conversation)).toEqual([]);
    expect(await b.proposals.latestPending(owned.conversation)).toBeNull();
    await expect(b.proposals.confirm(owned.proposal)).rejects.toBeInstanceOf(NotFoundError);
    await expect(b.proposals.discard(owned.proposal)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      b.proposals.create({ conversationId: owned.conversation, kind: "entry", payload: { situation: "x" } }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await b.entries.corrections(owned.entry)).toEqual([]);
    expect(await b.checkins.corrections(owned.checkin)).toEqual([]);
    expect(await b.entries.correct(owned.entry, { situation: "overwritten" })).toBeNull();
    expect(await b.checkins.correct(owned.checkin, { mood: 5 })).toBeNull();
    expect(await b.conversations.setTitle(owned.conversation, "overwritten")).toBeNull();

    // A's data is untouched, and A's draft is still A's to decide.
    expect((await a.proposals.get(owned.proposal))?.status).toBe("proposed");
    expect(await a.entries.corrections(owned.entry)).toHaveLength(1);
    expect((await a.agentSettings.credentials())?.apiKey).toBe("alice-key-0123456789abcdef");
    expect((await a.conversations.get(owned.conversation))?.title).toBe("alice's chat");
    const { proposal } = await a.proposals.confirm(owned.proposal);
    await expect(a.proposals.confirm(proposal.id)).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("keeps A's memory out of B's reach: nothing to list, find, open, correct or forget", async () => {
    const space = { model: "test", dimensions: 4 };
    expect(await b.memories.list()).toEqual([]);
    expect(await b.memories.count()).toBe(0);
    expect(await b.memories.get(owned.memory)).toBeNull();
    expect(await b.memories.of({ kind: "entry", id: owned.entry })).toEqual([]);
    expect(await b.memories.lately({ about: 8, moments: 8, since: new Date(0) })).toEqual([]);
    // The very vector A's memory was placed from finds nothing in B's memory.
    expect(await b.memories.nearest(space, [1, 0, 0, 0], { limit: 10, maxDistance: 2 })).toEqual([]);
    expect(await b.memories.unread(10)).toEqual([]);
    expect(await b.memories.progress()).toEqual({ read: 0, unread: 0 });
    expect(await b.memories.correct(owned.memory, "overwritten", null)).toBeNull();
    expect(await b.memories.forget(owned.memory)).toBe(false);
    expect(await b.memories.forgetAll()).toEqual({ memories: 0 });
    // B cannot keep a memory from A's entry, or mark A's entry read.
    const entry = (await a.entries.get(owned.entry))!;
    await expect(
      b.memories.keep(
        { kind: "entry", id: owned.entry, updatedAt: entry.updatedAt },
        [{ kind: "moment", text: "taken", quote: "alice's situation", embedding: null }],
        { occurredAt: entry.occurredAt, space: null },
      ),
    ).resolves.toEqual([]);

    // A's memory is untouched and still found by A.
    expect((await a.memories.get(owned.memory))?.text).toBe("alice's memory");
    expect(
      (await a.memories.nearest(space, [1, 0, 0, 0], { limit: 10, maxDistance: 2 })).map((m) => m.id),
    ).toEqual([owned.memory]);
    expect((await a.memories.list()).map((m) => m.text)).toEqual(["Alice", "alice's memory"]);
  });

  it("lists nothing of A's to B", async () => {
    expect(await b.entries.list()).toEqual([]);
    expect(await b.entries.count()).toBe(0);
    expect(await b.checkins.list()).toEqual([]);
    expect(await b.therapyNotes.list()).toEqual([]);
    expect(await b.insights.list({ includeArchived: true })).toEqual([]);
    expect(await b.reports.list()).toEqual([]);
    expect(await b.consents.list()).toEqual([]);
    expect(await b.consents.latest("report_send")).toBeNull();
    expect(await b.conversations.list()).toEqual([]);
    expect(await b.conversations.messages(owned.conversation)).toEqual([]);
    expect(await b.apiTokens.list()).toEqual([]);
    expect(await b.auditLog.list()).toEqual([]);
  });

  it("does not let B read A's rows by id", async () => {
    expect(await b.entries.get(owned.entry)).toBeNull();
    expect(await b.checkins.get(owned.checkin)).toBeNull();
    expect(await b.reports.get(owned.report)).toBeNull();
    expect(await b.reports.readPdf(owned.report)).toBeNull();
    expect(await b.conversations.get(owned.conversation)).toBeNull();
  });

  it("keeps per-user settings separate", async () => {
    expect((await b.profile.get()).displayName).toBeNull();
    expect((await b.profile.get()).timezone).toBe("UTC");
    expect((await b.therapySettings.get()).therapistName).toBeNull();
  });

  it("keeps each person's plan and use of the assistant their own", async () => {
    await a.plans.take("assistantMessages");
    await a.plans.take("assistantMessages");
    const before = (await b.plans.current()).used.assistantMessages;
    await b.plans.giveBack("assistantMessages", (await a.plans.current()).period);
    expect((await a.plans.current()).used.assistantMessages).toBeGreaterThanOrEqual(2);
    expect((await b.plans.current()).used.assistantMessages).toBe(before);
    expect(await b.plans.subscription("person")).toBeNull();
    expect(await b.plans.customer()).toBeNull();
  });

  it("does not let B change or delete A's rows", async () => {
    expect(await b.entries.update(owned.entry, { situation: "overwritten" })).toBeNull();
    expect(await b.checkins.update(owned.checkin, { mood: 5 })).toBeNull();
    expect(await b.therapyNotes.update(owned.note, { body: "overwritten" })).toBeNull();
    expect(await b.therapyNotes.setDone(owned.note, true)).toBeNull();
    expect(await b.insights.archive(owned.insight)).toBeNull();
    expect(await b.apiTokens.revoke(owned.token)).toBe(false);
    await expect(b.reports.edit(owned.report, "x")).rejects.toBeInstanceOf(NotFoundError);
    await expect(b.reports.prepareAgain(owned.report, { content: "x" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(b.reports.markNotified(owned.report)).rejects.toBeInstanceOf(NotFoundError);
    await expect(b.reports.markReviewed(owned.report)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      b.conversations.append(owned.conversation, { role: "user", content: "x" }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(await b.entries.remove(owned.entry)).toBe(false);
    expect(await b.checkins.remove(owned.checkin)).toBe(false);
    expect(await b.therapyNotes.remove(owned.note)).toBe(false);
    expect(await b.insights.remove(owned.insight)).toBe(false);
    expect(await b.reports.remove(owned.report)).toBe(false);
    expect(await b.conversations.remove(owned.conversation)).toBe(false);

    // A's data is untouched.
    expect((await a.entries.get(owned.entry))?.situation).toBe("alice's situation");
    expect((await a.checkins.get(owned.checkin))?.mood).toBe(2);
    expect((await a.therapyNotes.list())[0]?.body).toBe("alice's goal");
    expect((await a.insights.list())[0]?.archivedAt).toBeNull();
    expect((await a.apiTokens.list())[0]?.revokedAt).toBeNull();
    expect(await a.conversations.messages(owned.conversation)).toHaveLength(1);
  });

  it("does not let B send A's report with A's consent", async () => {
    const bReport = await b.reports.createDraft({
      periodStart: new Date("2026-10-01"),
      periodEnd: new Date("2026-10-08"),
    });
    await b.reports.markReviewed(bReport.id);
    await expect(b.reports.markSent(bReport.id, owned.consent)).rejects.toBeInstanceOf(ConsentRequiredError);
    await expect(b.reports.markSent(owned.report, owned.consent)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("is enforced by the database too: a row cannot point at another user's parent", async () => {
    const bobId = b.userId;
    const attempt = handle.db.execute(
      sql`insert into messages (user_id, conversation_id, role, content) values (${bobId}, ${owned.conversation}, 'user', '\\x01'::bytea)`,
    );
    await expect(attempt).rejects.toThrow();
    const consentAttempt = handle.db.execute(
      sql`insert into consents (user_id, purpose, version, granted, report_id) values (${bobId}, 'report_send', '1', true, ${owned.report})`,
    );
    await expect(consentAttempt).rejects.toThrow();
    const proposalAttempt = handle.db.execute(
      sql`insert into proposals (user_id, conversation_id, kind, payload) values (${bobId}, ${owned.conversation}, 'entry', '\\x01'::bytea)`,
    );
    await expect(proposalAttempt).rejects.toThrow();
    const correctionAttempt = handle.db.execute(
      sql`insert into corrections (user_id, entry_id, fields, previous) values (${bobId}, ${owned.entry}, '{}', '\\x01'::bytea)`,
    );
    await expect(correctionAttempt).rejects.toThrow();
    const memoryAttempt = handle.db.execute(
      sql`insert into memories (user_id, kind, text, quote, entry_id, occurred_at) values (${bobId}, 'moment', '\\x01'::bytea, '\\x01'::bytea, ${owned.entry}, now())`,
    );
    await expect(memoryAttempt).rejects.toThrow();
    const readAttempt = handle.db.execute(
      sql`insert into memory_reads (user_id, entry_id, source_updated_at) values (${bobId}, ${owned.entry}, now())`,
    );
    await expect(readAttempt).rejects.toThrow();
  });

  it("cannot decrypt A's ciphertext with B's key", async () => {
    // Copy A's sealed situation into a row B owns: B's key and context refuse it.
    const own = await b.entries.create({});
    await handle.db.execute(
      sql`update entries set situation = (select situation from entries where id = ${owned.entry}) where id = ${own.id}`,
    );
    await expect(b.entries.get(own.id)).rejects.toThrow();
    await b.entries.remove(own.id);
  });

  it("resolves an API token only to its owner", async () => {
    const principal = await authenticateApiToken(handle.db, owned.rawToken);
    expect(principal?.userId).toBe(a.userId);
    expect(principal?.scopes).toEqual(["entries:read"]);
    expect(await authenticateApiToken(handle.db, `${owned.rawToken}x`)).toBeNull();
  });

  it("answers ids that cannot exist with nothing, not a driver error", async () => {
    expect(await b.entries.get("not-a-uuid")).toBeNull();
    expect(await b.entries.remove("'; drop table entries; --")).toBe(false);
  });

  it("refuses a scope for a user that does not exist", async () => {
    await expect(repositories.forUser("nobody")).rejects.toBeInstanceOf(NotFoundError);
  });
});

/**
 * F4: a practice sees nothing of a person without an active link, and
 * nothing beyond what the link carries (the reports the person shared);
 * another practice, or another person, reaches none of it. Each assertion
 * fails if the scope it relies on (the practice of the account, the person
 * of the link, the link's status) is removed from the query.
 */
describe("tenant isolation between people and practices", () => {
  const handle = openTestDatabase();
  const repositories = createRepositories(handle.db, testMasterKey);
  const fakePdf = new Uint8Array(Buffer.from("%PDF-1.7 approved %%EOF"));
  let person: UserScope;
  let stranger: UserScope;
  let practice: UserScope;
  let otherPractice: UserScope;
  let linkId: string;
  let shareId: string;
  let reportId: string;
  let draftId: string;
  let personInvite: { id: string; code: string };
  let practiceInvite: { id: string; code: string };

  async function scopeFor(label: string): Promise<UserScope> {
    const id = await createUser(handle.db, label);
    await repositories.provision(id);
    return repositories.forUser(id);
  }

  async function approvedReport(scope: UserScope, day: string): Promise<string> {
    const report = await scope.reports.createDraft({
      periodStart: new Date(`2026-10-${day}T00:00:00Z`),
      periodEnd: new Date(`2026-10-${day}T12:00:00Z`),
      content: "{}",
    });
    await scope.reports.markReviewed(report.id, { pdf: fakePdf });
    return report.id;
  }

  const snapshot = (word: string) => ({
    v: 1 as const,
    content: { word },
    period: { kind: "week" as const, label: "2026-W41", start: "", end: "", session: null },
    verified: [],
    timeZone: "UTC",
    personName: null,
  });

  beforeAll(async () => {
    person = await scopeFor("patient");
    stranger = await scopeFor("stranger");
    practice = await scopeFor("practice");
    otherPractice = await scopeFor("other-practice");
    await practice.practice.open({ professionalName: "Dr. Linked" });
    await otherPractice.practice.open({ professionalName: "Dr. Elsewhere" });

    const invite = await practice.practice.createInvite();
    linkId = (await person.sharing.acceptInvite(invite.code, { consent: true, personName: "Gabi" })).id;
    reportId = await approvedReport(person, "05");
    draftId = (
      await person.reports.createDraft({
        periodStart: new Date("2026-10-06T00:00:00Z"),
        periodEnd: new Date("2026-10-06T12:00:00Z"),
        content: "{}",
      })
    ).id;
    await person.entries.create({ situation: "never shared" });
    shareId = (await person.sharing.deliver({ reportId, linkId, snapshot: snapshot("shared"), pdf: fakePdf }))
      .id;
    personInvite = await person.sharing.createInvite({ personName: "Gabi" });
    practiceInvite = await practice.practice.createInvite({ note: "for someone" });
  });

  afterAll(() => handle.close());

  it("gives the linked practice the shared report and the chosen name, nothing else", async () => {
    expect((await practice.practice.reports()).map((r) => r.id)).toEqual([shareId]);
    expect((await practice.practice.patients()).map((p) => p.personName)).toEqual(["Gabi"]);
    expect((await practice.practice.readReport(shareId))?.snapshot.content).toEqual({ word: "shared" });
    // The practice's own diary scope is its own: the person's records are not in it.
    expect(await practice.reports.get(reportId)).toBeNull();
    expect(await practice.reports.get(draftId)).toBeNull();
    expect(await practice.entries.list()).toEqual([]);
    expect(await practice.sharing.links()).toEqual([]);
  });

  it("gives another practice none of it", async () => {
    expect(await otherPractice.practice.reports()).toEqual([]);
    expect(await otherPractice.practice.patients()).toEqual([]);
    expect(await otherPractice.practice.readReport(shareId)).toBeNull();
    expect(await otherPractice.practice.reportPdf(shareId)).toBeNull();
    expect(await otherPractice.practice.endLink(linkId)).toBe(false);
    expect(await otherPractice.practice.revokeInvite(practiceInvite.id)).toBe(false);
    expect((await otherPractice.practice.invites()).map((i) => i.id)).not.toContain(practiceInvite.id);
    expect((await otherPractice.notices.list()).map((n) => n.linkId)).not.toContain(linkId);
  });

  it("gives an account without a practice no practice side at all", async () => {
    expect(await stranger.practice.get()).toBeNull();
    expect(await stranger.practice.reports()).toEqual([]);
    expect(await stranger.practice.patients()).toEqual([]);
    expect(await stranger.practice.readReport(shareId)).toBeNull();
    expect(await stranger.practice.endLink(linkId)).toBe(false);
    await expect(stranger.practice.createInvite()).rejects.toBeInstanceOf(NotFoundError);
    await expect(stranger.practice.seats()).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not let another person see, change, end or use the person's link", async () => {
    expect(await stranger.sharing.links()).toEqual([]);
    expect(await stranger.sharing.end(linkId)).toBe(false);
    expect(await stranger.sharing.setShareMode(linkId, "auto")).toBe(false);
    expect(await stranger.sharing.rename(linkId, "taken")).toBe(false);
    expect(await stranger.sharing.revokeInvite(personInvite.id)).toBe(false);
    expect((await stranger.sharing.invites()).map((i) => i.id)).not.toContain(personInvite.id);
    await expect(stranger.sharing.confirm(linkId, { consent: true })).rejects.toBeInstanceOf(NotFoundError);
    // Neither the person's report nor the stranger's own can travel through the person's link.
    const own = await approvedReport(stranger, "07");
    await expect(
      stranger.sharing.deliver({ reportId: own, linkId, snapshot: snapshot("x"), pdf: fakePdf }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      stranger.sharing.deliver({ reportId, linkId, snapshot: snapshot("x"), pdf: fakePdf }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await stranger.notices.list()).toEqual([]);
    expect((await person.sharing.links())[0]).toMatchObject({ personName: "Gabi", shareMode: "ask" });
  });

  it("never lets a draft through a link", async () => {
    await expect(
      person.sharing.deliver({ reportId: draftId, linkId, snapshot: snapshot("draft"), pdf: fakePdf }),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("refuses reading through a link that is not active, even if a copy were left behind", async () => {
    // Simulate a link ended without its copies removed: the status alone must refuse.
    await handle.db.execute(sql`update links set status = 'pending' where id = ${linkId}`);
    expect(await practice.practice.readReport(shareId)).toBeNull();
    expect(await practice.practice.reportPdf(shareId)).toBeNull();
    expect(await practice.practice.reports()).toEqual([]);
    await handle.db.execute(sql`update links set status = 'active' where id = ${linkId}`);
    expect(await practice.practice.readReport(shareId)).not.toBeNull();
  });

  it("cannot open what a link carries with another link's key", async () => {
    const invite = await otherPractice.practice.createInvite();
    const otherLink = await stranger.sharing.acceptInvite(invite.code, { consent: true });
    // Move the share's sealed copy onto a share of the other link: the other link's key refuses it.
    const own = await approvedReport(stranger, "08");
    const theirs = await stranger.sharing.deliver({
      reportId: own,
      linkId: otherLink.id,
      snapshot: snapshot("theirs"),
      pdf: fakePdf,
    });
    await handle.db.execute(
      sql`update shared_reports set snapshot = (select snapshot from shared_reports where id = ${shareId}) where id = ${theirs.id}`,
    );
    await expect(otherPractice.practice.readReport(theirs.id)).rejects.toThrow();
  });
});
