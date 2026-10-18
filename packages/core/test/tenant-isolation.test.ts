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
