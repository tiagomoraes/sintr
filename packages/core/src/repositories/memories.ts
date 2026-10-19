import {
  and,
  count,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  ne,
  notInArray,
  notLike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { SEALED } from "../db/sealed";
import { checkins, entries, memories, memoryReads } from "../db/schema";
import {
  MemoryQuote,
  MemoryText,
  type EmbeddingSpace,
  type FoundMemory,
  type Memory,
  type MemoryProgress,
  type MemorySource,
  type UnreadSource,
} from "../domain";
import { ValidationError, parseInput } from "../errors";
import { rotationFor } from "../memory/rotation";
import { isId, type ScopeContext } from "./context";
import { inTransaction } from "./corrections";
import { checkinsRepository, entriesRepository } from "./ledger";

/** At most this many memories are kept from one reading of one source. */
export const MEMORIES_PER_SOURCE = 4;

/** How a space is written in `memories.embedding_model`. */
export function spaceId(space: EmbeddingSpace): string {
  return `${space.model}@${space.dimensions}`;
}

/** A memory with how far it is in meaning from what was asked (cosine distance, 0 to 2). */
export interface NearMemory extends Memory {
  distance: number;
}

/** A source read for the memory: which one, and the version that was read. */
export interface ReadSource {
  kind: "entry" | "checkin";
  id: string;
  updatedAt: Date;
}

const KIND_ORDER = sql`case ${memories.kind} when 'name' then 0 when 'about' then 1 else 2 end`;

/**
 * A source's `updated_at` as JavaScript holds it: Postgres keeps
 * microseconds, a Date milliseconds, so the version read is compared at
 * the precision it was written with.
 */
export function inMilliseconds(column: AnyPgColumn) {
  return sql`date_trunc('milliseconds', ${column})`;
}

/**
 * What sintr remembers of one person (F10, DECISIONS 113 to 117). The words
 * are sealed like the diary; the vectors are stored turned by the person's
 * own rotation, which is applied here, so neither the provider's vector of
 * a memory nor of a question ever reaches the database.
 */
export function memoriesRepository(ctx: ScopeContext) {
  const { db, userId, cipher } = ctx;
  const spec = SEALED.memories;
  const own = (id: string) => and(eq(memories.id, id), eq(memories.userId, userId));
  const fromSource = (source: { kind: "entry" | "checkin"; id: string }) =>
    source.kind === "entry" ? eq(memories.entryId, source.id) : eq(memories.checkinId, source.id);

  const columns = {
    id: memories.id,
    kind: memories.kind,
    text: memories.text,
    quote: memories.quote,
    entryId: memories.entryId,
    checkinId: memories.checkinId,
    occurredAt: memories.occurredAt,
    embeddingModel: memories.embeddingModel,
    editedAt: memories.editedAt,
    createdAt: memories.createdAt,
    updatedAt: memories.updatedAt,
  };
  type Row = { [K in keyof typeof columns]: (typeof memories.$inferSelect)[K] };

  const decode = (row: Row): Memory => {
    const source: MemorySource = row.entryId
      ? { kind: "entry", id: row.entryId }
      : row.checkinId
        ? { kind: "checkin", id: row.checkinId }
        : { kind: "welcome" };
    return {
      id: row.id,
      kind: row.kind,
      text: cipher.openText(spec.columns.text, row.text),
      quote: row.quote ? cipher.openText(spec.columns.quote, row.quote) : null,
      source,
      occurredAt: row.occurredAt,
      embeddingModel: row.embeddingModel,
      editedAt: row.editedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  };

  /** The provider's vectors, turned by the person's rotation for their length. */
  const turn = (space: EmbeddingSpace, vectors: readonly (readonly number[])[]): number[][] => {
    for (const vector of vectors) {
      if (vector.length !== space.dimensions) throw new ValidationError(["embedding"]);
    }
    return rotationFor(cipher, space.dimensions).turn(vectors);
  };

  return {
    /** Every memory: the name first, then who they are, then what happened, newest first. */
    async list(): Promise<Memory[]> {
      const rows = await db
        .select(columns)
        .from(memories)
        .where(eq(memories.userId, userId))
        .orderBy(KIND_ORDER, desc(memories.occurredAt), desc(memories.createdAt));
      return rows.map(decode);
    },

    async get(id: string): Promise<Memory | null> {
      if (!isId(id)) return null;
      const [row] = await db.select(columns).from(memories).where(own(id));
      return row ? decode(row) : null;
    },

    async count(): Promise<number> {
      const [row] = await db.select({ n: count() }).from(memories).where(eq(memories.userId, userId));
      return row?.n ?? 0;
    },

    /** The memories of one entry or check-in, for its page. */
    async of(source: { kind: "entry" | "checkin"; id: string }): Promise<Memory[]> {
      if (!isId(source.id)) return [];
      const rows = await db
        .select(columns)
        .from(memories)
        .where(and(eq(memories.userId, userId), fromSource(source)))
        .orderBy(KIND_ORDER, desc(memories.createdAt));
      return rows.map(decode);
    },

    /**
     * What is always in front of the assistant: the name, the most recent of
     * who they are, and what happened since `since`.
     */
    async lately(options: { about: number; moments: number; since: Date }): Promise<Memory[]> {
      const [name, about, moments] = await Promise.all([
        db
          .select(columns)
          .from(memories)
          .where(and(eq(memories.userId, userId), eq(memories.kind, "name")))
          .limit(1),
        db
          .select(columns)
          .from(memories)
          .where(and(eq(memories.userId, userId), eq(memories.kind, "about")))
          .orderBy(desc(memories.occurredAt), desc(memories.createdAt))
          .limit(options.about),
        db
          .select(columns)
          .from(memories)
          .where(
            and(
              eq(memories.userId, userId),
              eq(memories.kind, "moment"),
              gte(memories.occurredAt, options.since),
            ),
          )
          .orderBy(desc(memories.occurredAt), desc(memories.createdAt))
          .limit(options.moments),
      ]);
      return [...name, ...about, ...moments].map(decode);
    },

    /**
     * The memories nearest in meaning to `vector`, a provider's vector in
     * `space`: it is turned by the person's rotation and compared, by
     * pgvector, with their own memories in that space only.
     */
    async nearest(
      space: EmbeddingSpace,
      vector: readonly number[],
      options: { limit: number; maxDistance: number; exclude?: readonly string[] },
    ): Promise<NearMemory[]> {
      const [turned] = turn(space, [vector]);
      const query = `[${turned!.join(",")}]`;
      const distance = sql<number>`(${memories.embedding} <=> ${query}::vector)`;
      const where: SQL[] = [
        eq(memories.userId, userId),
        eq(memories.embeddingModel, spaceId(space)),
        isNotNull(memories.embedding),
      ];
      const exclude = (options.exclude ?? []).filter(isId);
      if (exclude.length > 0) where.push(notInArray(memories.id, exclude));
      const rows = await db
        .select({ ...columns, distance })
        .from(memories)
        .where(and(...where))
        .orderBy(distance)
        .limit(options.limit);
      return rows
        .filter((row) => Number(row.distance) <= options.maxDistance)
        .map((row) => ({ ...decode(row), distance: Number(row.distance) }));
    },

    /** The name the person goes by, as a memory: replaced when it changes, gone when they have none. */
    async setName(name: string | null, at: Date = new Date()): Promise<void> {
      const value = name === null ? null : parseInput(MemoryText, name);
      await inTransaction(db, async (tx) => {
        await tx.delete(memories).where(and(eq(memories.userId, userId), eq(memories.kind, "name")));
        if (value === null) return;
        await tx.insert(memories).values({
          userId,
          kind: "name",
          text: cipher.sealText(spec.columns.text, value),
          occurredAt: at,
        });
      });
    },

    /**
     * Keep what one reading of a source found, and mark that version read.
     * What earlier readings of it found goes, except memories the person
     * corrected, which are theirs. `found` may be empty: a source read and
     * nothing kept (or one the crisis screen stops) is still read.
     */
    async keep(
      source: ReadSource,
      found: readonly FoundMemory[],
      context: { occurredAt: Date; space: EmbeddingSpace | null },
    ): Promise<Memory[]> {
      if (!isId(source.id)) throw new ValidationError(["source"]);
      if (found.length > MEMORIES_PER_SOURCE) throw new ValidationError(["found"]);
      const values = found.map((memory) => ({
        kind: memory.kind,
        text: parseInput(MemoryText, memory.text),
        quote: parseInput(MemoryQuote, memory.quote),
      }));
      const placed = context.space && found.every((memory) => memory.embedding !== null);
      const vectors = placed
        ? turn(
            context.space!,
            found.map((memory) => memory.embedding!),
          )
        : null;
      const ref = source.kind === "entry" ? { entryId: source.id } : { checkinId: source.id };
      return inTransaction(db, async (tx) => {
        // One reading of a source at a time (the worker and "Read it now" may meet): the second waits, then replaces.
        const [held] =
          source.kind === "entry"
            ? await tx
                .select({ id: entries.id })
                .from(entries)
                .where(and(eq(entries.id, source.id), eq(entries.userId, userId)))
                .for("update")
            : await tx
                .select({ id: checkins.id })
                .from(checkins)
                .where(and(eq(checkins.id, source.id), eq(checkins.userId, userId)))
                .for("update");
        if (!held) return [];
        await tx
          .delete(memories)
          .where(and(eq(memories.userId, userId), fromSource(source), isNull(memories.editedAt)));
        const rows =
          values.length === 0
            ? []
            : await tx
                .insert(memories)
                .values(
                  values.map((value, index) => ({
                    userId,
                    kind: value.kind,
                    text: cipher.sealText(spec.columns.text, value.text),
                    quote: cipher.sealText(spec.columns.quote, value.quote),
                    ...ref,
                    occurredAt: context.occurredAt,
                    embedding: vectors ? vectors[index]! : null,
                    embeddingModel: vectors ? spaceId(context.space!) : null,
                  })),
                )
                .returning(columns);
        const target =
          source.kind === "entry"
            ? [memoryReads.userId, memoryReads.entryId]
            : [memoryReads.userId, memoryReads.checkinId];
        await tx
          .insert(memoryReads)
          .values({ userId, ...ref, sourceUpdatedAt: source.updatedAt })
          .onConflictDoUpdate({
            target,
            set: { sourceUpdatedAt: source.updatedAt, readAt: new Date() },
          });
        return rows.map(decode);
      });
    },

    /** Entries and check-in notes not read yet, or changed since they were: the newest first. */
    async unread(limit: number): Promise<UnreadSource[]> {
      const take = Math.min(Math.max(limit, 1), 100);
      const [entryIds, checkinIds] = await Promise.all([
        db
          .select({ id: entries.id, at: entries.occurredAt })
          .from(entries)
          .leftJoin(
            memoryReads,
            and(eq(memoryReads.entryId, entries.id), eq(memoryReads.userId, entries.userId)),
          )
          .where(
            and(
              eq(entries.userId, userId),
              or(isNull(memoryReads.id), lt(memoryReads.sourceUpdatedAt, inMilliseconds(entries.updatedAt))),
            ),
          )
          .orderBy(desc(entries.occurredAt))
          .limit(take),
        db
          .select({ id: checkins.id, at: checkins.occurredAt })
          .from(checkins)
          .leftJoin(
            memoryReads,
            and(eq(memoryReads.checkinId, checkins.id), eq(memoryReads.userId, checkins.userId)),
          )
          .where(
            and(
              eq(checkins.userId, userId),
              isNotNull(checkins.note),
              or(isNull(memoryReads.id), lt(memoryReads.sourceUpdatedAt, inMilliseconds(checkins.updatedAt))),
            ),
          )
          .orderBy(desc(checkins.occurredAt))
          .limit(take),
      ]);
      const picked = [
        ...entryIds.map((row) => ({ kind: "entry" as const, ...row })),
        ...checkinIds.map((row) => ({ kind: "checkin" as const, ...row })),
      ]
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .slice(0, take);
      const ledger = { entries: entriesRepository(ctx), checkins: checkinsRepository(ctx) };
      const sources: UnreadSource[] = [];
      for (const item of picked) {
        if (item.kind === "entry") {
          const entry = await ledger.entries.get(item.id);
          if (entry) sources.push({ kind: "entry", entry });
        } else {
          const checkin = await ledger.checkins.get(item.id);
          if (checkin) sources.push({ kind: "checkin", checkin });
        }
      }
      return sources;
    },

    /** How much of the diary has been read for the memory, as it is now. */
    async progress(): Promise<MemoryProgress> {
      const [entryRows, checkinRows] = await Promise.all([
        db
          .select({
            total: count(),
            read: sql<number>`count(*) filter (where ${memoryReads.sourceUpdatedAt} >= ${inMilliseconds(entries.updatedAt)})`,
          })
          .from(entries)
          .leftJoin(
            memoryReads,
            and(eq(memoryReads.entryId, entries.id), eq(memoryReads.userId, entries.userId)),
          )
          .where(eq(entries.userId, userId)),
        db
          .select({
            total: count(),
            read: sql<number>`count(*) filter (where ${memoryReads.sourceUpdatedAt} >= ${inMilliseconds(checkins.updatedAt)})`,
          })
          .from(checkins)
          .leftJoin(
            memoryReads,
            and(eq(memoryReads.checkinId, checkins.id), eq(memoryReads.userId, checkins.userId)),
          )
          .where(and(eq(checkins.userId, userId), isNotNull(checkins.note))),
      ]);
      const total = Number(entryRows[0]?.total ?? 0) + Number(checkinRows[0]?.total ?? 0);
      const read = Number(entryRows[0]?.read ?? 0) + Number(checkinRows[0]?.read ?? 0);
      return { read, unread: total - read };
    },

    /** Sources read since `since`: what bounds the house's reading in a day. */
    async readSince(since: Date): Promise<number> {
      const [row] = await db
        .select({ n: count() })
        .from(memoryReads)
        .where(and(eq(memoryReads.userId, userId), gte(memoryReads.readAt, since)));
      return row?.n ?? 0;
    },

    /** Memories not placed by meaning yet (new, corrected, or from another space): the oldest first. */
    async unplaced(limit: number): Promise<Memory[]> {
      const rows = await db
        .select(columns)
        .from(memories)
        .where(and(eq(memories.userId, userId), ne(memories.kind, "name"), isNull(memories.embedding)))
        .orderBy(memories.createdAt)
        .limit(Math.min(Math.max(limit, 1), 100));
      return rows.map(decode);
    },

    /**
     * Drop the vectors not made by the model `keep` (all of them for null):
     * after the provider or its model changed, the old space's vectors mean
     * nothing to the new one, so they go and the memories are placed again.
     */
    async unplace(keep: string | null): Promise<number> {
      const where: SQL[] = [eq(memories.userId, userId), isNotNull(memories.embedding)];
      if (keep) where.push(notLike(memories.embeddingModel, `${keep.replace(/[\\%_]/gu, "\\$&")}@%`));
      const rows = await db
        .update(memories)
        .set({ embedding: null, embeddingModel: null, updatedAt: new Date() })
        .where(and(...where))
        .returning({ id: memories.id });
      return rows.length;
    },

    /** Place memories by meaning in `space`, from the provider's vectors of their words. */
    async place(
      space: EmbeddingSpace,
      placed: readonly { id: string; embedding: number[] }[],
    ): Promise<void> {
      const valid = placed.filter((item) => isId(item.id));
      if (valid.length === 0) return;
      const turned = turn(
        space,
        valid.map((item) => item.embedding),
      );
      await inTransaction(db, async (tx) => {
        for (const [index, item] of valid.entries()) {
          await tx
            .update(memories)
            .set({ embedding: turned[index]!, embeddingModel: spaceId(space), updatedAt: new Date() })
            .where(own(item.id));
        }
      });
    },

    /**
     * The person's correction: their words replace the memory's sentence,
     * which is placed again by meaning from them (or left unplaced until it
     * can be). The words it rested on stay, so it still shows where it came from.
     */
    async correct(
      id: string,
      text: string,
      placed: { space: EmbeddingSpace; embedding: number[] } | null,
    ): Promise<Memory | null> {
      if (!isId(id)) return null;
      const value = parseInput(MemoryText, text);
      const turned = placed ? turn(placed.space, [placed.embedding])[0]! : null;
      const [row] = await db
        .update(memories)
        .set({
          text: cipher.sealText(spec.columns.text, value),
          editedAt: new Date(),
          embedding: turned,
          embeddingModel: placed ? spaceId(placed.space) : null,
          updatedAt: new Date(),
        })
        .where(and(own(id), ne(memories.kind, "name")))
        .returning(columns);
      return row ? decode(row) : null;
    },

    /** Forget one memory: the row is deleted, not hidden. Its source stays read. */
    async forget(id: string): Promise<boolean> {
      if (!isId(id)) return false;
      const rows = await db.delete(memories).where(own(id)).returning({ id: memories.id });
      return rows.length > 0;
    },

    /** Everything: every memory and the record of every reading. */
    async forgetAll(): Promise<{ memories: number }> {
      return inTransaction(db, async (tx) => {
        const removed = await tx
          .delete(memories)
          .where(eq(memories.userId, userId))
          .returning({ id: memories.id });
        await tx.delete(memoryReads).where(eq(memoryReads.userId, userId));
        return { memories: removed.length };
      });
    },
  };
}
