import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HEALTH_DATA_CONSENT_VERSION, MEMORY_CONSENT_VERSION, type EmbeddingSpace } from "../src/domain";
import { ValidationError } from "../src/errors";
import { createRotation } from "../src/memory/rotation";
import { memoryWork } from "../src/memory/work";
import { createRepositories, type UserScope } from "../src/repositories";
import { createUser, openTestDatabase, testMasterKey } from "./support";

/**
 * F10: what sintr remembers of a person. The rotation keeps the angles
 * pgvector compares and nothing of the provider's own vectors; a memory
 * lives as long as its source and its consent, and forgetting deletes it.
 */

const SPACE: EmbeddingSpace = { model: "test-embedding", dimensions: 8 };

function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return dot / Math.sqrt(na * nb);
}

/** A vector pointing mostly along one axis, so neighbours are known in advance. */
function along(axis: number, noise = 0.1): number[] {
  return Array.from({ length: SPACE.dimensions }, (_, i) => (i === axis ? 1 : noise * ((i % 3) - 1)));
}

describe("the rotation", () => {
  const random = (n: number) => Array.from({ length: n }, () => Math.random() - 0.5);

  it("keeps every angle between vectors and every length, so distances mean the same", () => {
    const rotation = createRotation(randomBytes(32), 64);
    const vectors = [random(64), random(64), random(64)];
    const turned = rotation.turn(vectors);
    for (const vector of turned) expect(Math.hypot(...vector)).toBeCloseTo(1, 12);
    expect(cosine(turned[0]!, turned[1]!)).toBeCloseTo(cosine(vectors[0]!, vectors[1]!), 12);
    expect(cosine(turned[1]!, turned[2]!)).toBeCloseTo(cosine(vectors[1]!, vectors[2]!), 12);
  });

  it("moves each vector away from where the provider put it", () => {
    const rotation = createRotation(randomBytes(32), 1536);
    const vector = random(1536);
    const [turned] = rotation.turn([vector]);
    // Unrelated directions in 1536 dimensions: a cosine near zero, not near one.
    expect(Math.abs(cosine(vector, turned!))).toBeLessThan(0.15);
  });

  it("is the same for the same key and another for another key", () => {
    const seed = randomBytes(32);
    const vector = random(32);
    expect(createRotation(seed, 32).turn([vector])).toEqual(createRotation(seed, 32).turn([vector]));
    const [mine] = createRotation(seed, 32).turn([vector]);
    const [theirs] = createRotation(randomBytes(32), 32).turn([vector]);
    expect(Math.abs(cosine(mine!, theirs!))).toBeLessThan(0.9);
  });

  it("refuses a vector of another length, or one with no direction", () => {
    const rotation = createRotation(randomBytes(32), 8);
    expect(() => rotation.turn([random(7)])).toThrow(RangeError);
    expect(() => rotation.turn([new Array(8).fill(0)])).toThrow(RangeError);
    expect(() => createRotation(randomBytes(16), 8)).toThrow(RangeError);
  });
});

describe("the memory of one person", () => {
  const handle = openTestDatabase();
  const repositories = createRepositories(handle.db, testMasterKey);
  let scope: UserScope;
  let entryId: string;
  let checkinId: string;

  beforeAll(async () => {
    const id = await createUser(handle.db, "remembered");
    await repositories.provision(id);
    scope = await repositories.forUser(id);
    entryId = (
      await scope.entries.create({
        occurredAt: new Date("2026-10-12T21:00:00Z"),
        situation: "My sister Ana called from the hospital.",
        thoughts: ["I should have been there"],
      })
    ).id;
    checkinId = (await scope.checkins.create({ mood: 3, note: "Slept badly before the night shift." })).id;
    await scope.checkins.create({ mood: 4 });
  });

  afterAll(() => handle.close());

  it("starts with nothing kept and the diary unread (a check-in without a note has nothing to read)", async () => {
    expect(await scope.memories.list()).toEqual([]);
    expect(await scope.memories.progress()).toEqual({ read: 0, unread: 2 });
    const unread = await scope.memories.unread(10);
    expect(unread.map((source) => source.kind).sort()).toEqual(["checkin", "entry"]);
  });

  it("keeps what a reading found, sealed, placed under the person's rotation, and marks the page read", async () => {
    const entry = (await scope.entries.get(entryId))!;
    const kept = await scope.memories.keep(
      { kind: "entry", id: entryId, updatedAt: entry.updatedAt },
      [
        { kind: "about", text: "Has a sister, Ana.", quote: "My sister Ana", embedding: along(0) },
        {
          kind: "moment",
          text: "Ana called from the hospital.",
          quote: "Ana called from the hospital",
          embedding: along(1),
        },
      ],
      { occurredAt: entry.occurredAt, space: SPACE },
    );
    expect(kept.map((memory) => memory.kind)).toEqual(["about", "moment"]);
    expect(kept[0]).toMatchObject({
      source: { kind: "entry", id: entryId },
      embeddingModel: "test-embedding@8",
    });
    expect(kept[1]?.occurredAt).toEqual(new Date("2026-10-12T21:00:00Z"));
    expect(await scope.memories.progress()).toEqual({ read: 1, unread: 1 });
    expect((await scope.memories.of({ kind: "entry", id: entryId })).length).toBe(2);
  });

  it("finds a memory by meaning in its own space only, through the rotation", async () => {
    const near = await scope.memories.nearest(SPACE, along(1, 0.2), { limit: 5, maxDistance: 0.5 });
    expect(near.map((memory) => memory.text)).toEqual(["Ana called from the hospital."]);
    expect(near[0]!.distance).toBeLessThan(0.1);
    // Another model's space shares nothing with this one, even at the same length.
    const other = await scope.memories.nearest({ model: "other", dimensions: 8 }, along(1), {
      limit: 5,
      maxDistance: 2,
    });
    expect(other).toEqual([]);
    // What is already in front of the assistant is left out.
    const excluded = await scope.memories.nearest(SPACE, along(1), {
      limit: 5,
      maxDistance: 2,
      exclude: near.map((memory) => memory.id),
    });
    expect(excluded.map((memory) => memory.text)).not.toContain("Ana called from the hospital.");
  });

  it("stores the turned vector, never the provider's", async () => {
    const rows = await handle.db.execute<{ embedding: string }>(
      sql`select embedding::text as embedding from memories where user_id = ${scope.userId} and kind = 'moment'`,
    );
    const stored = JSON.parse(rows[0]!.embedding) as number[];
    expect(stored).toHaveLength(8);
    expect(stored).not.toEqual(along(1));
    expect(Math.hypot(...stored)).toBeCloseTo(1, 5);
  });

  it("keeps the name the person goes by, replaced when it changes and gone when they have none", async () => {
    await scope.memories.setName("Tiago");
    await scope.memories.setName("Ti");
    const names = (await scope.memories.list()).filter((memory) => memory.kind === "name");
    expect(names.map((memory) => memory.text)).toEqual(["Ti"]);
    expect(names[0]?.source).toEqual({ kind: "welcome" });
    expect((await scope.memories.list())[0]?.kind).toBe("name");
    await scope.memories.setName(null);
    expect((await scope.memories.list()).some((memory) => memory.kind === "name")).toBe(false);
    await scope.memories.setName("Tiago");
  });

  it("puts in front of the assistant the name, who they are and what happened lately", async () => {
    const lately = await scope.memories.lately({
      about: 8,
      moments: 3,
      since: new Date("2026-10-05T00:00:00Z"),
    });
    expect(lately.map((memory) => memory.kind)).toEqual(["name", "about", "moment"]);
    const older = await scope.memories.lately({
      about: 8,
      moments: 3,
      since: new Date("2026-10-13T00:00:00Z"),
    });
    expect(older.map((memory) => memory.kind)).toEqual(["name", "about"]);
  });

  it("takes the person's correction, keeps the words it rested on, and never lets a new reading replace it", async () => {
    const about = (await scope.memories.list()).find((memory) => memory.kind === "about")!;
    const corrected = await scope.memories.correct(about.id, "Has an older sister, Ana.", {
      space: SPACE,
      embedding: along(0),
    });
    expect(corrected).toMatchObject({ text: "Has an older sister, Ana.", quote: "My sister Ana" });
    expect(corrected?.editedAt).toBeInstanceOf(Date);

    // The entry changes, so it is unread again; reading it again replaces only what was not corrected.
    await scope.entries.correct(entryId, { behavior: "Drove to the hospital." });
    expect(await scope.memories.progress()).toEqual({ read: 0, unread: 2 });
    const entry = (await scope.entries.get(entryId))!;
    await scope.memories.keep(
      { kind: "entry", id: entryId, updatedAt: entry.updatedAt },
      [{ kind: "moment", text: "Drove to the hospital.", quote: "Drove to the hospital", embedding: null }],
      { occurredAt: entry.occurredAt, space: null },
    );
    const texts = (await scope.memories.of({ kind: "entry", id: entryId })).map((memory) => memory.text);
    expect(texts.sort()).toEqual(["Drove to the hospital.", "Has an older sister, Ana."]);
    expect(await scope.memories.progress()).toEqual({ read: 1, unread: 1 });
  });

  it("places later what had no place, and drops the vectors of an old space", async () => {
    const unplaced = await scope.memories.unplaced(10);
    expect(unplaced.map((memory) => memory.text)).toEqual(["Drove to the hospital."]);
    await scope.memories.place(SPACE, [{ id: unplaced[0]!.id, embedding: along(2) }]);
    expect(await scope.memories.unplaced(10)).toEqual([]);
    expect(await scope.memories.unplace(SPACE)).toBe(0);
    expect(await scope.memories.unplace({ model: "next-model", dimensions: 8 })).toBe(2);
    expect((await scope.memories.unplaced(10)).length).toBe(2);
    await scope.memories.unplace(null);
  });

  it("marks a page read with nothing kept, and counts the pages read in a day", async () => {
    const checkin = (await scope.checkins.get(checkinId))!;
    await scope.memories.keep({ kind: "checkin", id: checkinId, updatedAt: checkin.updatedAt }, [], {
      occurredAt: checkin.occurredAt,
      space: null,
    });
    expect(await scope.memories.progress()).toEqual({ read: 2, unread: 0 });
    expect(await scope.memories.readSince(new Date(Date.now() - 60_000))).toBe(2);
    expect(await scope.memories.readSince(new Date(Date.now() + 60_000))).toBe(0);
  });

  it("refuses what the rules do not allow", async () => {
    const entry = (await scope.entries.get(entryId))!;
    const source = { kind: "entry" as const, id: entryId, updatedAt: entry.updatedAt };
    const context = { occurredAt: entry.occurredAt, space: SPACE };
    const memory = { kind: "moment" as const, text: "x", quote: "x", embedding: along(0) };
    await expect(scope.memories.keep(source, Array(5).fill(memory), context)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      scope.memories.keep(source, [{ ...memory, embedding: [1, 2, 3] }], context),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(scope.memories.keep(source, [{ ...memory, text: " " }], context)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(scope.memories.setName("x".repeat(301))).rejects.toBeInstanceOf(ValidationError);
    // The name is changed in the welcome, never corrected here.
    const name = (await scope.memories.list()).find((m) => m.kind === "name")!;
    expect(await scope.memories.correct(name.id, "Someone else", null)).toBeNull();
  });

  it("is refused by the database itself when a memory has no source, or a vector no model", async () => {
    const id = scope.userId;
    await expect(
      handle.db.execute(
        sql`insert into memories (user_id, kind, text, occurred_at) values (${id}, 'moment', '\\x01'::bytea, now())`,
      ),
    ).rejects.toThrow();
    await expect(
      handle.db.execute(
        sql`insert into memories (user_id, kind, text, entry_id, occurred_at) values (${id}, 'name', '\\x01'::bytea, ${entryId}, now())`,
      ),
    ).rejects.toThrow();
    await expect(
      handle.db.execute(
        sql`insert into memories (user_id, kind, text, occurred_at, embedding) values (${id}, 'name', '\\x01'::bytea, now(), '[1,0]')`,
      ),
    ).rejects.toThrow();
  });

  it("forgets one memory by deleting its row, and leaves its page read", async () => {
    const memory = (await scope.memories.list()).find((m) => m.text === "Drove to the hospital.")!;
    expect(await scope.memories.forget(memory.id)).toBe(true);
    expect(await scope.memories.get(memory.id)).toBeNull();
    const rows = await handle.db.execute(sql`select 1 from memories where id = ${memory.id}`);
    expect(rows.length).toBe(0);
    expect(await scope.memories.forget(memory.id)).toBe(false);
    expect((await scope.memories.progress()).unread).toBe(0);
  });

  it("goes with its entry when the entry is deleted", async () => {
    const other = await scope.entries.create({ situation: "A short walk after dinner." });
    await scope.memories.keep(
      { kind: "entry", id: other.id, updatedAt: other.updatedAt },
      [{ kind: "moment", text: "Walked after dinner.", quote: "A short walk after dinner", embedding: null }],
      { occurredAt: other.occurredAt, space: null },
    );
    expect((await scope.memories.of({ kind: "entry", id: other.id })).length).toBe(1);
    await scope.entries.remove(other.id);
    const left = await handle.db.execute(
      sql`select (select count(*) from memories where entry_id = ${other.id}) as memories,
                 (select count(*) from memory_reads where entry_id = ${other.id}) as reads`,
    );
    expect(left[0]).toEqual({ memories: "0", reads: "0" });
  });

  it("forgets everything: every memory and every record of a reading", async () => {
    expect(await scope.memories.count()).toBeGreaterThan(0);
    const { memories } = await scope.memories.forgetAll();
    expect(memories).toBeGreaterThan(0);
    const left = await handle.db.execute(
      sql`select (select count(*) from memories where user_id = ${scope.userId}) as memories,
                 (select count(*) from memory_reads where user_id = ${scope.userId}) as reads`,
    );
    expect(left[0]).toEqual({ memories: "0", reads: "0" });
    expect(await scope.memories.progress()).toEqual({ read: 0, unread: 2 });
  });

  it("goes with the account", async () => {
    const id = await createUser(handle.db, "leaving-memory");
    await repositories.provision(id);
    const leaving = await repositories.forUser(id);
    const entry = await leaving.entries.create({ situation: "Last page." });
    await leaving.memories.setName("Leaving");
    await leaving.memories.keep(
      { kind: "entry", id: entry.id, updatedAt: entry.updatedAt },
      [{ kind: "moment", text: "Wrote a last page.", quote: "Last page", embedding: along(3) }],
      { occurredAt: entry.occurredAt, space: SPACE },
    );
    await leaving.deleteAccount();
    const left = await handle.db.execute(
      sql`select (select count(*) from memories where user_id = ${id}) as memories,
                 (select count(*) from memory_reads where user_id = ${id}) as reads`,
    );
    expect(left[0]).toEqual({ memories: "0", reads: "0" });
  });
});

describe("whose diary the worker reads", () => {
  const handle = openTestDatabase();
  const repositories = createRepositories(handle.db, testMasterKey);

  async function person(label: string, memory: boolean | null): Promise<UserScope> {
    const id = await createUser(handle.db, label);
    await repositories.provision(id);
    const scope = await repositories.forUser(id);
    await scope.consents.record({
      purpose: "health_data_processing",
      version: HEALTH_DATA_CONSENT_VERSION,
      granted: true,
    });
    if (memory !== null) {
      await scope.consents.record({ purpose: "memory", version: MEMORY_CONSENT_VERSION, granted: true });
      if (!memory)
        await scope.consents.record({ purpose: "memory", version: MEMORY_CONSENT_VERSION, granted: false });
    }
    await scope.entries.create({ situation: `${label} wrote something.` });
    return scope;
  }

  afterAll(() => handle.close());

  it("lists only people whose memory is on and who have something waiting, and reads no content", async () => {
    const on = await person("memory-on", true);
    const never = await person("memory-never", null);
    const withdrawn = await person("memory-withdrawn", false);
    const outdated = await person("memory-outdated", null);
    await outdated.consents.record({ purpose: "memory", version: "2020-01-01", granted: true });

    const listed = await memoryWork(handle.db);
    expect(listed).toContain(on.userId);
    expect(listed).not.toContain(never.userId);
    expect(listed).not.toContain(withdrawn.userId);
    expect(listed).not.toContain(outdated.userId);

    // Once everything is read, there is nothing waiting.
    const [source] = await on.memories.unread(1);
    if (source?.kind !== "entry") throw new Error("expected the entry");
    await on.memories.keep({ kind: "entry", id: source.entry.id, updatedAt: source.entry.updatedAt }, [], {
      occurredAt: source.entry.occurredAt,
      space: null,
    });
    expect(await memoryWork(handle.db)).not.toContain(on.userId);
  });
});
