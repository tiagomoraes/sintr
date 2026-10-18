import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InvalidStateError, NotFoundError, ValidationError } from "../src/errors";
import { createRepositories, type UserScope } from "../src/repositories";
import { createUser, openTestDatabase, testMasterKey } from "./support";

/** The data side of F1: corrections, proposals and the assistant's settings. */

const handle = openTestDatabase();
const repositories = createRepositories(handle.db, testMasterKey);
let scope: UserScope;

beforeAll(async () => {
  const id = await createUser(handle.db);
  await repositories.provision(id);
  scope = await repositories.forUser(id);
});

afterAll(() => handle.close());

describe("correcting an entry", () => {
  it("shows the new words and keeps what each changed field held before, dated", async () => {
    const entry = await scope.entries.create({
      situation: "a reunião de segunda",
      thoughts: ["vou decepcionar todo mundo"],
      emotions: [{ name: "ansiedade", intensity: 80 }],
    });
    const result = await scope.entries.correct(
      entry.id,
      {
        situation: "a reunião de segunda",
        emotions: [{ name: "ansiedade", intensity: 70 }],
        behavior: "fiquei quieta",
      },
      { note: "a intensidade era menor" },
    );
    expect(result?.record).toMatchObject({
      situation: "a reunião de segunda",
      thoughts: ["vou decepcionar todo mundo"],
      emotions: [{ name: "ansiedade", intensity: 70 }],
      behavior: "fiquei quieta",
      peakIntensity: 70,
    });
    // Only what differed is part of the change; the unchanged situation is not.
    expect(result?.correction).toMatchObject({
      fields: ["emotions", "behavior"],
      previous: { emotions: [{ name: "ansiedade", intensity: 80 }], behavior: null },
      note: "a intensidade era menor",
    });
    expect(result?.correction?.createdAt).toBeInstanceOf(Date);

    const corrections = await scope.entries.corrections(entry.id);
    expect(corrections).toHaveLength(1);
    expect(corrections[0]?.previous).toEqual({
      emotions: [{ name: "ansiedade", intensity: 80 }],
      behavior: null,
    });
  });

  it("writes nothing when nothing differs, and treats empty lists as empty", async () => {
    const entry = await scope.entries.create({ situation: "x", tags: null });
    const result = await scope.entries.correct(entry.id, { situation: "x", tags: [] });
    expect(result?.correction).toBeNull();
    expect(await scope.entries.corrections(entry.id)).toEqual([]);
  });

  it("keeps the order of several corrections and records a moved time", async () => {
    const entry = await scope.entries.create({
      occurredAt: new Date("2026-10-12T21:00:00Z"),
      title: "first",
    });
    await scope.entries.correct(entry.id, { title: "second" });
    await scope.entries.correct(entry.id, { occurredAt: new Date("2026-10-12T19:30:00Z") });
    const corrections = await scope.entries.corrections(entry.id);
    expect(corrections.map((c) => c.fields)).toEqual([["title"], ["occurredAt"]]);
    expect(corrections[0]?.previous).toEqual({ title: "first" });
    expect(corrections[1]?.previous).toEqual({ occurredAt: "2026-10-12T21:00:00.000Z" });
    expect((await scope.entries.get(entry.id))?.occurredAt.toISOString()).toBe("2026-10-12T19:30:00.000Z");
  });

  it("validates the patch and the note without echoing them", async () => {
    const entry = await scope.entries.create({});
    await expect(
      scope.entries.correct(entry.id, { emotions: [{ name: "raiva", intensity: 300 }] }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      scope.entries.correct(entry.id, { title: "y" }, { note: "z".repeat(2_001) }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await scope.entries.correct("not-an-id", { title: "y" })).toBeNull();
  });
});

describe("correcting a check-in", () => {
  it("keeps the old values the same way", async () => {
    const checkin = await scope.checkins.create({ mood: 2, sleepHours: 6 });
    const result = await scope.checkins.correct(checkin.id, { mood: 4, sleepHours: 6 });
    expect(result?.record.mood).toBe(4);
    expect(result?.correction).toMatchObject({ fields: ["mood"], previous: { mood: 2 }, note: null });
    expect(await scope.checkins.corrections(checkin.id)).toHaveLength(1);
  });

  it("is refused by the database when a correction names no record, or two", async () => {
    const entry = await scope.entries.create({});
    const checkin = await scope.checkins.create({});
    const neither = handle.db.execute(
      sql`insert into corrections (user_id, fields, previous) values (${scope.userId}, '{}', '\\x01'::bytea)`,
    );
    await expect(neither).rejects.toThrow();
    const both = handle.db.execute(
      sql`insert into corrections (user_id, entry_id, checkin_id, fields, previous) values (${scope.userId}, ${entry.id}, ${checkin.id}, '{}', '\\x01'::bytea)`,
    );
    await expect(both).rejects.toThrow();
  });
});

describe("proposals", () => {
  const draft = {
    situation: "quando meu chefe perguntou do prazo na frente de todos",
    thoughts: ["vou decepcionar todo mundo"],
    emotions: [{ name: "ansiedade", intensity: 80 }],
  };

  it("write nothing to the ledger until the person confirms", async () => {
    const conversation = await scope.conversations.create();
    const before = await scope.entries.count();
    const proposal = await scope.proposals.create({
      conversationId: conversation.id,
      kind: "entry",
      payload: draft,
    });
    expect(proposal).toMatchObject({ status: "proposed", recordId: null, edited: false, payload: draft });
    expect(await scope.entries.count()).toBe(before);
    expect((await scope.proposals.latestPending(conversation.id))?.id).toBe(proposal.id);

    const { proposal: saved, record } = await scope.proposals.confirm(proposal.id);
    expect(saved).toMatchObject({ status: "saved", recordId: record.id, edited: false });
    expect(saved.decidedAt).toBeInstanceOf(Date);
    expect(await scope.entries.count()).toBe(before + 1);
    expect(await scope.entries.get(record.id)).toMatchObject(draft);
    expect(await scope.proposals.latestPending(conversation.id)).toBeNull();
  });

  it("save the person's edited version, and remember it was edited", async () => {
    const conversation = await scope.conversations.create();
    const proposal = await scope.proposals.create({
      conversationId: conversation.id,
      kind: "entry",
      payload: draft,
    });
    const edits = { ...draft, emotions: [{ name: "ansiedade", intensity: 70 }], body: "aperto no peito" };
    const { proposal: saved, record } = await scope.proposals.confirm(proposal.id, edits);
    expect(saved.edited).toBe(true);
    expect(saved.payload).toMatchObject(edits);
    expect(await scope.entries.get(record.id)).toMatchObject(edits);
  });

  it("lay the person's edits over the draft: what they left alone keeps the drafted value", async () => {
    const conversation = await scope.conversations.create();
    const drafted = { ...draft, occurredAt: "2026-10-16T23:00:00.000Z" };
    const proposal = await scope.proposals.create({
      conversationId: conversation.id,
      kind: "entry",
      payload: drafted,
    });
    // The form sends every field, null for the empty ones, and no time when it was left as shown.
    const untouched = {
      ...draft,
      title: null,
      body: null,
      tags: null,
      emotionsAfter: null,
      alternativeBelief: null,
    };
    const { proposal: saved, record } = await scope.proposals.confirm(proposal.id, untouched);
    expect(saved.edited).toBe(false);
    expect(record.occurredAt.toISOString()).toBe("2026-10-16T23:00:00.000Z");
  });

  it("are decided once: no second save, no discard after saving", async () => {
    const conversation = await scope.conversations.create();
    const proposal = await scope.proposals.create({
      conversationId: conversation.id,
      kind: "entry",
      payload: draft,
    });
    const before = await scope.entries.count();
    await scope.proposals.confirm(proposal.id);
    await expect(scope.proposals.confirm(proposal.id)).rejects.toBeInstanceOf(InvalidStateError);
    await expect(scope.proposals.discard(proposal.id)).rejects.toBeInstanceOf(InvalidStateError);
    expect(await scope.entries.count()).toBe(before + 1);
  });

  it("can be discarded, leaving the ledger untouched", async () => {
    const conversation = await scope.conversations.create();
    const proposal = await scope.proposals.create({
      conversationId: conversation.id,
      kind: "checkin",
      payload: { mood: 3, sleepHours: 7 },
    });
    const before = (await scope.checkins.list()).length;
    expect((await scope.proposals.discard(proposal.id)).status).toBe("discarded");
    expect((await scope.checkins.list()).length).toBe(before);
    await expect(scope.proposals.confirm(proposal.id)).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("confirm a check-in into the check-ins", async () => {
    const conversation = await scope.conversations.create();
    const proposal = await scope.proposals.create({
      conversationId: conversation.id,
      kind: "checkin",
      payload: { mood: 4, sleepHours: 6.5, note: "acordei bem" },
    });
    const { record } = await scope.proposals.confirm(proposal.id);
    expect(await scope.checkins.get(record.id)).toMatchObject({
      mood: 4,
      sleepHours: 6.5,
      note: "acordei bem",
    });
  });

  it("validate the draft like a record, and need a conversation of the same person", async () => {
    const conversation = await scope.conversations.create();
    await expect(
      scope.proposals.create({ conversationId: conversation.id, kind: "checkin", payload: { mood: 9 } }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      scope.proposals.create({
        conversationId: "00000000-0000-4000-8000-000000000000",
        kind: "entry",
        payload: draft,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("go with their conversation, while saved records stay", async () => {
    const conversation = await scope.conversations.create();
    const proposal = await scope.proposals.create({
      conversationId: conversation.id,
      kind: "entry",
      payload: draft,
    });
    const { record } = await scope.proposals.confirm(proposal.id);
    await scope.conversations.remove(conversation.id);
    expect(await scope.proposals.get(proposal.id)).toBeNull();
    expect(await scope.entries.get(record.id)).not.toBeNull();
  });

  it("cannot be marked saved without a record, by the database either", async () => {
    const conversation = await scope.conversations.create();
    const proposal = await scope.proposals.create({
      conversationId: conversation.id,
      kind: "entry",
      payload: draft,
    });
    const attempt = handle.db.execute(sql`update proposals set status = 'saved' where id = ${proposal.id}`);
    await expect(attempt).rejects.toThrow();
  });
});

describe("the assistant's settings", () => {
  it("start empty, and give no credentials until a provider and a model are set", async () => {
    const own = await repositories.forUser(await createUser(handle.db));
    expect(await own.agentSettings.get()).toEqual({
      provider: null,
      baseUrl: null,
      model: null,
      hasKey: false,
      keyHint: null,
      conversationRetentionDays: null,
    });
    expect(await own.agentSettings.credentials()).toBeNull();
    await own.agentSettings.update({ provider: "anthropic" });
    expect(await own.agentSettings.credentials()).toBeNull();
  });

  it("keep the key when it is not sent again, replace it, and remove it", async () => {
    const own = await repositories.forUser(await createUser(handle.db));
    const key = "sk-test-0123456789abcdefWXYZ";
    const saved = await own.agentSettings.update({
      provider: "openai_compatible",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "some/model",
      apiKey: key,
    });
    expect(saved).toMatchObject({ hasKey: true, keyHint: "WXYZ" });
    expect(JSON.stringify(saved)).not.toContain(key);

    await own.agentSettings.update({ model: "another/model" });
    expect(await own.agentSettings.credentials()).toEqual({
      provider: "openai_compatible",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "another/model",
      apiKey: key,
    });

    await own.agentSettings.update({ apiKey: "ollama" });
    expect(await own.agentSettings.get()).toMatchObject({ hasKey: true, keyHint: null });
    await own.agentSettings.update({ apiKey: null });
    expect(await own.agentSettings.get()).toMatchObject({ hasKey: false, keyHint: null });
    expect((await own.agentSettings.credentials())?.apiKey).toBeNull();
  });

  it("never carry a saved key to another provider or another address", async () => {
    const own = await repositories.forUser(await createUser(handle.db));
    await own.agentSettings.update({ provider: "anthropic", model: "m", apiKey: "sk-ant-0123456789abcdef" });
    await own.agentSettings.update({ model: "another" });
    expect((await own.agentSettings.get()).hasKey).toBe(true);
    await own.agentSettings.update({
      provider: "openai_compatible",
      baseUrl: "https://gateway.example.test/v1",
    });
    expect((await own.agentSettings.get()).hasKey).toBe(false);

    await own.agentSettings.update({ apiKey: "sk-gw-0123456789abcdef" });
    await own.agentSettings.update({ baseUrl: "https://elsewhere.example.test/v1" });
    expect((await own.agentSettings.credentials())?.apiKey).toBeNull();
    // A new key given with the change is kept.
    await own.agentSettings.update({
      baseUrl: "https://third.example.test/v1",
      apiKey: "sk-third-0123456789ab",
    });
    expect((await own.agentSettings.credentials())?.apiKey).toBe("sk-third-0123456789ab");
  });

  it("refuse a base URL that is not http or https, and retention off the range", async () => {
    await expect(scope.agentSettings.update({ baseUrl: "file:///etc/passwd" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(scope.agentSettings.update({ conversationRetentionDays: 0 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(
      (await scope.agentSettings.update({ conversationRetentionDays: 90 })).conversationRetentionDays,
    ).toBe(90);
  });
});

describe("conversation titles", () => {
  it("are sealed and can be set later", async () => {
    const conversation = await scope.conversations.create();
    expect((await scope.conversations.setTitle(conversation.id, "a reunião"))?.title).toBe("a reunião");
    const [row] = await handle.db.execute<{ title: Buffer }>(
      sql`select title from conversations where id = ${conversation.id}`,
    );
    expect(Buffer.from(row!.title).toString("utf8")).not.toContain("reunião");
  });
});
