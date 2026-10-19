import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authenticateApiToken, clientName } from "../src/auth/api-tokens";
import { API_TOKEN_ACCESS, MAX_ACTIVE_API_TOKENS, accessOf } from "../src/domain";
import { ConsentRequiredError, DataAccessError, InvalidStateError, ValidationError } from "../src/errors";
import { personLanguage, reportLanguageFor } from "../src/language";
import { createRepositories, type UserScope } from "../src/repositories";
import { createUser, openTestDatabase, testMasterKey } from "./support";

const handle = openTestDatabase();
const repositories = createRepositories(handle.db, testMasterKey);
let scope: UserScope;

beforeAll(async () => {
  const id = await createUser(handle.db);
  await repositories.provision(id);
  scope = await repositories.forUser(id);
});

afterAll(() => handle.close());

describe("entries", () => {
  it("accepts a partial entry: capture first, analyse later", async () => {
    const entry = await scope.entries.create({});
    expect(entry.situation).toBeNull();
    expect(entry.thoughts).toBeNull();
    expect(entry.occurredAt).toBeInstanceOf(Date);
  });

  it("keeps thoughts verbatim, including spacing and punctuation", async () => {
    const thought = "  eu sempre estrago tudo...  ";
    const entry = await scope.entries.create({ thoughts: [thought] });
    expect((await scope.entries.get(entry.id))?.thoughts).toEqual([thought]);
  });

  it("derives the clear peak intensity from the sealed emotions", async () => {
    const entry = await scope.entries.create({
      emotions: [
        { name: "ansiedade", intensity: 70 },
        { name: "vergonha", intensity: 85 },
        { name: "cansaço", intensity: null },
      ],
    });
    expect(entry.peakIntensity).toBe(85);
    const updated = await scope.entries.update(entry.id, { emotions: [{ name: "calma", intensity: 20 }] });
    expect(updated?.peakIntensity).toBe(20);
  });

  it("updates only the fields given, and null clears a field", async () => {
    const entry = await scope.entries.create({ situation: "first", notes: "keep me" });
    const updated = await scope.entries.update(entry.id, { situation: null, behavior: "walked out" });
    expect(updated).toMatchObject({ situation: null, notes: "keep me", behavior: "walked out" });
  });

  it("lists by time range, newest first", async () => {
    const own = await repositories.forUser(await createUser(handle.db));
    await own.entries.create({ occurredAt: new Date("2026-10-01T10:00:00Z"), title: "one" });
    await own.entries.create({ occurredAt: new Date("2026-10-05T10:00:00Z"), title: "two" });
    await own.entries.create({ occurredAt: new Date("2026-10-09T10:00:00Z"), title: "three" });
    const all = await own.entries.list();
    expect(all.map((e) => e.title)).toEqual(["three", "two", "one"]);
    const range = await own.entries.list({ from: new Date("2026-10-02"), to: new Date("2026-10-09") });
    expect(range.map((e) => e.title)).toEqual(["two"]);
    expect(await own.entries.count()).toBe(3);
  });

  it("validates input without echoing it", async () => {
    try {
      await scope.entries.create({ emotions: [{ name: "raiva", intensity: 140 }] });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as Error).message).toContain("emotions.0.intensity");
      expect((error as Error).message).not.toContain("raiva");
    }
  });
});

describe("check-ins", () => {
  it("stores only what was given and refuses values off the scale", async () => {
    const checkin = await scope.checkins.create({ mood: 2, sleepHours: 6.5 });
    expect(checkin).toMatchObject({ mood: 2, energy: null, anxiety: null, sleepHours: 6.5, note: null });
    await expect(scope.checkins.create({ mood: 6 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("is protected by database checks as well", async () => {
    const attempt = handle.db.execute(sql`insert into checkins (user_id, mood) values (${scope.userId}, 9)`);
    await expect(attempt).rejects.toThrow();
  });
});

describe("therapy notes and insights", () => {
  it("records tasks and marks them done", async () => {
    const task = await scope.therapyNotes.create({ kind: "task", body: "write down three moments" });
    expect((await scope.therapyNotes.setDone(task.id, true))?.doneAt).toBeInstanceOf(Date);
    expect((await scope.therapyNotes.setDone(task.id, false))?.doneAt).toBeNull();
    expect((await scope.therapyNotes.list({ kind: "task" })).map((n) => n.id)).toContain(task.id);
  });

  it("archives insights out of the default list", async () => {
    const insight = await scope.insights.create({ kind: "question", body: "what changes on Mondays?" });
    await scope.insights.archive(insight.id);
    expect((await scope.insights.list()).map((i) => i.id)).not.toContain(insight.id);
    expect((await scope.insights.list({ includeArchived: true })).map((i) => i.id)).toContain(insight.id);
  });
});

describe("settings", () => {
  it("upserts the profile and validates time zones", async () => {
    const profile = await scope.profile.update({
      displayName: "Ana",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
    });
    // Not onboardedAt: schema.test.ts replays the 0006 backfill over every user of this shared database.
    expect(profile).toEqual({
      displayName: "Ana",
      preferredName: null,
      locale: "pt-BR",
      seenLocale: null,
      reportLanguage: null,
      timezone: "America/Sao_Paulo",
      onboardedAt: expect.toBeOneOf([null, expect.any(Date)]),
    });
    await expect(scope.profile.update({ timezone: "Mars/Olympus" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("keeps the person's language apart from what sintr last showed them and from the report's", async () => {
    const id = await createUser(handle.db, "languages");
    await repositories.provision(id);
    const person = await repositories.forUser(id);
    expect(await person.profile.get()).toMatchObject({
      locale: null,
      seenLocale: null,
      reportLanguage: null,
    });
    await person.profile.update({ seenLocale: "pt-BR" });
    expect(personLanguage(await person.profile.get(), "en")).toBe("pt-BR");
    expect(reportLanguageFor(await person.profile.get(), null)).toBe("pt");
    // Their own choice comes first; a report language chosen in Therapy comes before both.
    await person.profile.update({ locale: "en" });
    expect(personLanguage(await person.profile.get(), "pt-BR")).toBe("en");
    await person.profile.update({ reportLanguage: "es" });
    expect(reportLanguageFor(await person.profile.get(), null)).toBe("es");
    // Back to following their language, and back to no choice of their own.
    await person.profile.update({ reportLanguage: null, locale: null, seenLocale: null });
    expect(personLanguage(await person.profile.get(), "pt-BR")).toBe("pt-BR");
    expect(reportLanguageFor(await person.profile.get(), null)).toBe("en");
    await expect(person.profile.update({ locale: "not a language" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("keeps the name the person goes by apart from the name on their reports", async () => {
    const id = await createUser(handle.db, "called");
    await repositories.provision(id);
    const person = await repositories.forUser(id);
    expect(await person.profile.get()).toMatchObject({ preferredName: null, onboardedAt: null });
    const called = await person.profile.update({ preferredName: "Bia" });
    expect(called).toMatchObject({ preferredName: "Bia", displayName: null });
    // Changing one leaves the other as it was.
    await person.profile.update({ displayName: "Beatriz Souza" });
    expect(await person.profile.get()).toMatchObject({ preferredName: "Bia", displayName: "Beatriz Souza" });
    await expect(person.profile.update({ preferredName: "x".repeat(81) })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("marks the welcome as behind the person once, and keeps the first moment", async () => {
    const id = await createUser(handle.db, "welcomed");
    await repositories.provision(id);
    const person = await repositories.forUser(id);
    const first = new Date("2026-10-19T12:00:00Z");
    expect((await person.profile.markOnboarded(first)).onboardedAt).toEqual(first);
    expect((await person.profile.markOnboarded(new Date("2026-10-20T12:00:00Z"))).onboardedAt).toEqual(first);
    // Updating the profile afterwards does not reopen it.
    await person.profile.update({ preferredName: "Caio" });
    expect((await person.profile.get()).onboardedAt).toEqual(first);
  });

  it("keeps approval mandatory, in code and in the database", async () => {
    const settings = await scope.therapySettings.update({
      sessionDay: 3,
      sessionTime: "18:00",
      reportLeadMinutes: 60,
    });
    expect(settings).toMatchObject({ sessionDay: 3, sessionTime: "18:00", requireApproval: true });
    const attempt = handle.db.execute(
      sql`update therapy_settings set require_approval = false where user_id = ${scope.userId}`,
    );
    await expect(attempt).rejects.toThrow();
  });
});

describe("reports and consent", () => {
  it("moves draft, reviewed, sent, and refuses to send without a consent", async () => {
    const report = await scope.reports.createDraft({
      periodStart: new Date("2026-10-07T17:00:00Z"),
      periodEnd: new Date("2026-10-14T17:00:00Z"),
    });
    expect(report.status).toBe("draft");
    await expect(scope.reports.markSent(report.id, report.id)).rejects.toBeInstanceOf(InvalidStateError);
    await scope.reports.edit(report.id, "# Report");
    const reviewed = await scope.reports.markReviewed(report.id, { pdf: Buffer.from("%PDF") });
    expect(reviewed.status).toBe("reviewed");

    await expect(
      scope.reports.markSent(report.id, "00000000-0000-4000-8000-000000000000"),
    ).rejects.toBeInstanceOf(ConsentRequiredError);
    const refused = await scope.consents.record({
      purpose: "report_send",
      version: "1",
      granted: false,
      reportId: report.id,
      recipient: "t@example.test",
    });
    await expect(scope.reports.markSent(report.id, refused.id)).rejects.toBeInstanceOf(ConsentRequiredError);

    const consent = await scope.consents.record({
      purpose: "report_send",
      version: "1",
      granted: true,
      reportId: report.id,
      recipient: "t@example.test",
    });
    const sent = await scope.reports.markSent(report.id, consent.id);
    expect(sent).toMatchObject({
      status: "sent",
      recipient: "t@example.test",
      consentId: consent.id,
      hasPdf: true,
    });
    expect((await scope.reports.readPdf(report.id))?.toString()).toBe("%PDF");
    await expect(scope.reports.edit(report.id, "changed")).rejects.toBeInstanceOf(InvalidStateError);
    await expect(scope.reports.prepareAgain(report.id, { content: "again" })).rejects.toBeInstanceOf(
      InvalidStateError,
    );
  });

  it("is refused by the database when a report is marked sent without consent", async () => {
    const report = await scope.reports.createDraft({
      periodStart: new Date("2026-09-01"),
      periodEnd: new Date("2026-09-08"),
    });
    const attempt = handle.db.execute(
      sql`update reports set status = 'sent', sent_at = now() where id = ${report.id}`,
    );
    await expect(attempt).rejects.toThrow();
  });

  it("keeps an append-only, versioned consent log", async () => {
    await scope.consents.record({ purpose: "health_data_processing", version: "1", granted: true });
    await scope.consents.record({ purpose: "health_data_processing", version: "2", granted: false });
    const latest = await scope.consents.latest("health_data_processing");
    expect(latest).toMatchObject({ version: "2", granted: false });
    await expect(
      scope.consents.record({ purpose: "report_send", version: "1", granted: true }),
    ).rejects.toBeInstanceOf(DataAccessError);
  });
});

describe("conversations", () => {
  it("appends messages in order and updates the conversation", async () => {
    const conversation = await scope.conversations.create();
    await scope.conversations.append(conversation.id, {
      role: "user",
      content: "preciso falar do que aconteceu",
    });
    await scope.conversations.append(conversation.id, { role: "assistant", content: "estou aqui" });
    const messages = await scope.conversations.messages(conversation.id);
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect((await scope.conversations.get(conversation.id))?.lastMessageAt).toBeInstanceOf(Date);
    expect(await scope.conversations.remove(conversation.id)).toBe(true);
    expect(await scope.conversations.messages(conversation.id)).toEqual([]);
  });
});

describe("API tokens and the audit log", () => {
  it("stores only a hash, shows the token once, and stops working when revoked", async () => {
    const { token, apiToken } = await scope.apiTokens.create({
      name: "Claude Desktop",
      scopes: ["entries:read", "entries:write"],
    });
    expect(token.startsWith(apiToken.tokenPrefix)).toBe(true);
    const rows = await handle.db.execute<{ token_hash: string }>(
      sql`select token_hash from api_tokens where id = ${apiToken.id}`,
    );
    expect(rows[0]?.token_hash).not.toContain(token.slice(6));
    expect((await authenticateApiToken(handle.db, token))?.userId).toBe(scope.userId);
    expect(await scope.apiTokens.revoke(apiToken.id)).toBe(true);
    expect(await authenticateApiToken(handle.db, token)).toBeNull();
    expect(await scope.apiTokens.revoke(apiToken.id)).toBe(false);
  });

  it("does not accept expired tokens or unknown scopes", async () => {
    const { token } = await scope.apiTokens.create({
      name: "old",
      scopes: ["checkins:read"],
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await authenticateApiToken(handle.db, token)).toBeNull();
    await expect(
      scope.apiTokens.create({ name: "x", scopes: ["everything" as "entries:read"] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("names the three kinds of access, and nothing else", () => {
    expect(accessOf([...API_TOKEN_ACCESS.read_write])).toBe("read_write");
    expect(accessOf(["checkins:read", "entries:read", "reports:read", "therapy:read"])).toBe("read");
    expect(accessOf(["entries:write", "checkins:write"])).toBe("write");
    expect(accessOf(["entries:read"])).toBeNull();
    expect(accessOf([...API_TOKEN_ACCESS.read, "insights:read"])).toBeNull();
  });

  it("records when a token was used and the name its client gave, cleaned", async () => {
    const { token, apiToken } = await scope.apiTokens.create({ name: "agent", scopes: ["entries:read"] });
    expect(apiToken.lastUsedAt).toBeNull();
    await authenticateApiToken(handle.db, token, { client: "claude-ai" });
    let stored = await scope.apiTokens.get(apiToken.id);
    expect(stored?.lastUsedAt).toBeInstanceOf(Date);
    expect(stored?.lastClient).toBe("claude-ai");
    // A later call without a name keeps the last one.
    await authenticateApiToken(handle.db, token);
    stored = await scope.apiTokens.get(apiToken.id);
    expect(stored?.lastClient).toBe("claude-ai");
    expect(clientName("Gemini CLI (MCP) 1.2/3")).toBe("Gemini CLI (MCP) 1.2/3");
    expect(clientName("<script>x</script>")).toBe("scriptx/script");
    expect(clientName("a".repeat(100))).toHaveLength(60);
    expect(clientName("   ")).toBeNull();
    expect(clientName(42)).toBeNull();
  });

  it("holds at most a fixed number of working tokens per person", async () => {
    const id = await createUser(handle.db, "many");
    await repositories.provision(id);
    const many = await repositories.forUser(id);
    const made = [];
    for (let i = 0; i < MAX_ACTIVE_API_TOKENS; i += 1) {
      made.push(await many.apiTokens.create({ name: `key ${i}`, scopes: ["entries:read"] }));
    }
    await expect(
      many.apiTokens.create({ name: "one more", scopes: ["entries:read"] }),
    ).rejects.toBeInstanceOf(InvalidStateError);
    // A revoked key frees its place.
    await many.apiTokens.revoke(made[0]!.apiToken.id);
    await expect(
      many.apiTokens.create({ name: "one more", scopes: ["entries:read"] }),
    ).resolves.toBeDefined();
  });

  it("accepts identifiers in audit metadata and refuses nested content", async () => {
    await scope.auditLog.record({ action: "data.exported", metadata: { format: "json", count: 3 } });
    expect((await scope.auditLog.list())[0]).toMatchObject({
      action: "data.exported",
      metadata: { format: "json", count: 3 },
    });
    await expect(
      scope.auditLog.record({ action: "data.exported", metadata: { entry: { situation: "x" } } as never }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(scope.auditLog.record({ action: "entry.read" as never })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe("account deletion", () => {
  it("removes every row the user owns, in every table", async () => {
    const id = await createUser(handle.db, "leaving");
    await repositories.provision(id);
    const leaving = await repositories.forUser(id);
    await leaving.entries.create({ situation: "x" });
    await leaving.checkins.create({ mood: 1 });
    await leaving.therapyNotes.create({ kind: "goal", body: "x" });
    await leaving.insights.create({ kind: "pattern", body: "x" });
    const report = await leaving.reports.createDraft({
      periodStart: new Date("2026-10-01"),
      periodEnd: new Date("2026-10-08"),
    });
    await leaving.reports.markReviewed(report.id);
    const consent = await leaving.consents.record({
      purpose: "report_send",
      version: "1",
      granted: true,
      reportId: report.id,
      recipient: "t@example.test",
    });
    await leaving.reports.markSent(report.id, consent.id);
    const conversation = await leaving.conversations.create();
    await leaving.conversations.append(conversation.id, { role: "user", content: "x" });
    await leaving.agentSettings.update({ provider: "anthropic", model: "m", apiKey: "k" });
    const proposal = await leaving.proposals.create({
      conversationId: conversation.id,
      kind: "entry",
      payload: { situation: "x" },
    });
    const { record } = await leaving.proposals.confirm(proposal.id);
    await leaving.entries.correct(record.id, { situation: "y" });
    await leaving.apiTokens.create({ name: "x", scopes: ["entries:read"] });
    await leaving.auditLog.record({ action: "data.deleted" });
    await leaving.plans.take("assistantMessages");

    await leaving.deleteAccount();

    const tables = await handle.db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.columns where table_schema = 'public' and column_name = 'user_id'`,
    );
    expect(tables.length).toBeGreaterThanOrEqual(18);
    for (const { table_name } of tables) {
      const rows = await handle.db.execute<{ n: number }>(
        sql.raw(`select count(*)::int as n from "${table_name}" where user_id = '${id}'`),
      );
      expect(rows[0]?.n, table_name).toBe(0);
    }
  });
});
