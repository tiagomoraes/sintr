import { getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DecryptionError,
  ENVELOPE_OVERHEAD,
  ENVELOPE_VERSION,
  createFieldCipher,
  unwrapDataKey,
} from "../src/crypto";
import { SEALED } from "../src/db/sealed";
import { agentSettings, entries, userKeys } from "../src/db/schema";
import * as schema from "../src/db/schema";
import { createRepositories, type UserScope } from "../src/repositories";
import { createUser, marker, openTestDatabase, testMasterKey } from "./support";

/**
 * Proves that sensitive content reaches Postgres only as ciphertext. If the
 * repositories stopped sealing a field (for example by storing its UTF-8
 * bytes), `expectSealed` and the dump scan below would fail.
 */

function hex(value: string): string {
  return Buffer.from(value, "utf8").toString("hex");
}

/** Assert that stored bytes are an envelope of `plaintext`, not the plaintext. */
function expectSealed(stored: Buffer | null | undefined, plaintext: string): void {
  expect(stored, "a value was stored").toBeInstanceOf(Buffer);
  const bytes = stored!;
  expect(bytes[0], "envelope version byte").toBe(ENVELOPE_VERSION);
  expect(bytes.byteLength, "plaintext length plus iv and tag").toBeGreaterThanOrEqual(ENVELOPE_OVERHEAD + 1);
  expect(bytes.includes(Buffer.from(plaintext, "utf8")), "plaintext bytes are absent").toBe(false);
  expect(bytes.toString("utf8").includes(plaintext), "plaintext text is absent").toBe(false);
}

describe("the ciphertext check itself", () => {
  it("fails on plaintext stored as bytes (negative control)", () => {
    const words = "this would be stored in the clear";
    expect(() => expectSealed(Buffer.from(words, "utf8"), words)).toThrow();
  });
});

describe("encryption at rest", () => {
  const handle = openTestDatabase();
  const repositories = createRepositories(handle.db, testMasterKey);
  const words: Record<string, string> = {};
  let userId: string;
  let scope: UserScope;

  const remember = (label: string) => {
    words[label] = marker(label);
    return words[label];
  };

  beforeAll(async () => {
    userId = await createUser(handle.db);
    await repositories.provision(userId);
    scope = await repositories.forUser(userId);

    await scope.profile.update({ displayName: remember("display name") });
    await scope.therapySettings.update({
      therapistName: remember("therapist name"),
      therapistContact: remember("therapist contact"),
    });
    await scope.entries.create({
      title: remember("title"),
      situation: remember("situation"),
      thoughts: [remember("thought")],
      emotions: [{ name: remember("emotion"), intensity: 80 }],
      body: remember("body"),
      behavior: remember("behavior"),
      context: remember("context"),
      tags: [remember("tag")],
      notes: remember("notes"),
      hotThought: remember("hot thought"),
      evidenceFor: remember("evidence for"),
      evidenceAgainst: remember("evidence against"),
      alternative: remember("alternative"),
      emotionsAfter: [{ name: remember("emotion after"), intensity: 40 }],
      alternativeBelief: 60,
    });
    await scope.checkins.create({
      mood: 3,
      sleepHours: 6.5,
      sleepQuality: remember("sleep quality"),
      note: remember("checkin note"),
    });
    await scope.therapyNotes.create({ kind: "task", body: remember("therapy task") });
    await scope.insights.create({ kind: "pattern", body: remember("insight") });
    const report = await scope.reports.createDraft({
      periodStart: new Date("2026-10-07T18:00:00Z"),
      periodEnd: new Date("2026-10-14T17:00:00Z"),
      content: remember("report draft"),
    });
    // F2: the person's edit keeps the draft's words as a revision.
    await scope.reports.edit(report.id, remember("report content"));
    await scope.reports.markReviewed(report.id, { pdf: Buffer.from(remember("report pdf"), "utf8") });
    const consent = await scope.consents.record({
      purpose: "report_send",
      version: "1",
      granted: true,
      reportId: report.id,
      recipient: remember("recipient"),
    });
    await scope.reports.markSent(report.id, consent.id);
    const conversation = await scope.conversations.create({ title: remember("conversation title") });
    await scope.conversations.append(conversation.id, { role: "user", content: remember("message") });

    // F1: the assistant's key, a draft, and a correction with its old words.
    await scope.agentSettings.update({
      provider: "openai_compatible",
      baseUrl: "https://llm.example.test/v1",
      model: "a-model",
      apiKey: remember("api key"),
    });
    await scope.proposals.create({
      conversationId: conversation.id,
      kind: "entry",
      payload: { situation: remember("proposal situation"), thoughts: [remember("proposal thought")] },
    });
    const [entry] = await scope.entries.list();
    await scope.entries.correct(
      entry!.id,
      { behavior: remember("corrected behavior") },
      { note: remember("correction note") },
    );
  });

  afterAll(() => handle.close());

  it("stores every sealed column of every table as an envelope", async () => {
    let checked = 0;
    for (const spec of Object.values(SEALED)) {
      const columns = Object.values(spec.columns).map((c) => c.split(".")[1]!);
      const rows = await handle.db.execute<Record<string, Buffer | null>>(
        sql.raw(
          `select ${columns.map((c) => `"${c}"`).join(", ")} from "${spec.tableName}" where user_id = '${userId}'`,
        ),
      );
      expect(rows.length, `${spec.tableName} has rows`).toBeGreaterThan(0);
      for (const row of rows) {
        for (const column of columns) {
          const value = row[column];
          if (value === null || value === undefined) continue;
          expect(value[0], `${spec.tableName}.${column}`).toBe(ENVELOPE_VERSION);
          for (const plaintext of Object.values(words)) expectSealed(value, plaintext);
          checked += 1;
        }
      }
    }
    // display name, 2 therapy, 14 entry, 2 check-in, task, insight, report (3), consent, conversation,
    // message, then F1: the API key, a proposal payload, a correction's previous values and note,
    // then F2: the report's previous words in its revision
    expect(checked).toBe(32);
  });

  it("leaves no trace of the content in a text dump of the whole database", async () => {
    let dump = "";
    for (const table of Object.values(schema)) {
      if (!is(table, PgTable)) continue;
      const name = getTableName(table);
      const rows = await handle.db.execute<{ row: string }>(
        sql.raw(`select t::text as row from "${name}" t`),
      );
      dump += rows.map((r) => r.row).join("\n");
    }
    expect(dump.length).toBeGreaterThan(1000);
    for (const [label, plaintext] of Object.entries(words)) {
      expect(dump.includes(plaintext), `${label} in clear`).toBe(false);
      expect(dump.includes(hex(plaintext)), `${label} as hex`).toBe(false);
    }
  });

  it("keeps the corrected-away words only sealed, in the correction", async () => {
    const [entry] = await scope.entries.list();
    const [correction] = await scope.entries.corrections(entry!.id);
    expect(correction?.previous).toEqual({ behavior: words.behavior });
    expect(correction?.note).toBe(words["correction note"]);
    expect(entry?.behavior).toBe(words["corrected behavior"]);
  });

  it("reads back exactly what was written, verbatim", async () => {
    const [entry] = await scope.entries.list();
    expect(entry?.thoughts).toEqual([words.thought]);
    expect(entry?.emotions).toEqual([{ name: words.emotion, intensity: 80 }]);
    expect(entry?.peakIntensity).toBe(80);
    expect((await scope.profile.get()).displayName).toBe(words["display name"]);
  });

  it("stores the data key only wrapped by the master key", async () => {
    const [row] = await handle.db
      .select()
      .from(userKeys)
      .where(sql`${userKeys.userId} = ${userId}`);
    expect(row?.kekId).toBe(testMasterKey.id);
    const dek = unwrapDataKey(testMasterKey, row!.wrappedDek, userId);
    expect(row!.wrappedDek.includes(dek)).toBe(false);
    // With the unwrapped key the stored situation opens; that is the whole envelope.
    const [stored] = await handle.db
      .select({ situation: entries.situation })
      .from(entries)
      .where(sql`${entries.userId} = ${userId}`);
    const cipher = createFieldCipher(dek, userId);
    expect(cipher.openText(SEALED.entries.columns.situation, stored!.situation!)).toBe(words.situation);
  });

  it("refuses ciphertext moved to another column", async () => {
    const [stored] = await handle.db
      .select({ id: entries.id, situation: entries.situation })
      .from(entries)
      .where(sql`${entries.userId} = ${userId}`);
    await handle.db.execute(sql`update entries set notes = ${stored!.situation} where id = ${stored!.id}`);
    await expect(scope.entries.get(stored!.id)).rejects.toBeInstanceOf(DecryptionError);
    await scope.entries.update(stored!.id, { notes: words.notes! });
  });

  it("cannot be read with another master key", async () => {
    const other = { id: testMasterKey.id, key: Buffer.alloc(32, 7) };
    await expect(createRepositories(handle.db, other).forUser(userId)).rejects.toBeInstanceOf(
      DecryptionError,
    );
  });
});

describe("the bring-your-own-key secret at rest", () => {
  const handle = openTestDatabase();
  const repositories = createRepositories(handle.db, testMasterKey);
  const key = `sk-live-${"9f3a".repeat(8)}-not-a-real-key`;
  let userId: string;
  let scope: UserScope;

  beforeAll(async () => {
    userId = await createUser(handle.db, "byok");
    await repositories.provision(userId);
    scope = await repositories.forUser(userId);
    await scope.agentSettings.update({ provider: "anthropic", model: "a-model", apiKey: key });
  });

  afterAll(() => handle.close());

  it("is stored only as an envelope sealed with the person's own key", async () => {
    const [row] = await handle.db
      .select({ apiKey: agentSettings.apiKey })
      .from(agentSettings)
      .where(sql`${agentSettings.userId} = ${userId}`);
    expectSealed(row?.apiKey, key);
    expect(row!.apiKey!.includes(Buffer.from(key.slice(-12), "utf8"))).toBe(false);
    const dek = unwrapDataKey(
      testMasterKey,
      (
        await handle.db
          .select()
          .from(userKeys)
          .where(sql`${userKeys.userId} = ${userId}`)
      )[0]!.wrappedDek,
      userId,
    );
    expect(createFieldCipher(dek, userId).openText(SEALED.agentSettings.columns.apiKey, row!.apiKey!)).toBe(
      key,
    );
  });

  it("leaves no trace of the key anywhere in a text dump of the database", async () => {
    let dump = "";
    for (const table of Object.values(schema)) {
      if (!is(table, PgTable)) continue;
      const rows = await handle.db.execute<{ row: string }>(
        sql.raw(`select t::text as row from "${getTableName(table)}" t`),
      );
      dump += rows.map((r) => r.row).join("\n");
    }
    expect(dump.includes(key)).toBe(false);
    expect(dump.includes(key.slice(8, 40))).toBe(false);
    expect(dump.includes(hex(key))).toBe(false);
  });

  it("comes back out only through credentials(), never through get()", async () => {
    const shown = await scope.agentSettings.get();
    expect(shown).toMatchObject({ hasKey: true, keyHint: key.slice(-4) });
    expect(JSON.stringify(shown)).not.toContain(key.slice(0, 20));
    expect((await scope.agentSettings.credentials())?.apiKey).toBe(key);
  });

  it("cannot be opened as another person's key", async () => {
    const otherId = await createUser(handle.db, "other");
    await repositories.provision(otherId);
    const other = await repositories.forUser(otherId);
    await handle.db.execute(
      sql`insert into agent_settings (user_id, provider, model, api_key) select ${otherId}, provider, model, api_key from agent_settings where user_id = ${userId}`,
    );
    await expect(other.agentSettings.credentials()).rejects.toBeInstanceOf(DecryptionError);
  });
});
