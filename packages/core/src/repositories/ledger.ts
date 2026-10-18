import { and, count, desc, eq, gte, isNull, lt, type SQL } from "drizzle-orm";
import { SEALED, openValues, sealValues } from "../db/sealed";
import { checkins, entries, insights, therapyNotes } from "../db/schema";
import {
  CheckinContent,
  CheckinInput,
  EntryContent,
  EntryInput,
  InsightInput,
  TherapyNoteInput,
  type Checkin,
  type Emotion,
  type Entry,
  type Insight,
  type InsightKind,
  type TherapyNote,
  type TherapyNoteKind,
} from "../domain";
import { parseInput } from "../errors";
import { isId, type ScopeContext } from "./context";

export interface ListRange {
  /** Inclusive lower bound on when it happened. */
  from?: Date;
  /** Exclusive upper bound on when it happened. */
  to?: Date;
  limit?: number;
}

const MAX_LIMIT = 500;

function limitOf(range: ListRange): number {
  return Math.min(Math.max(range.limit ?? 100, 1), MAX_LIMIT);
}

function peakIntensity(emotions: Emotion[] | null | undefined): number | null {
  const values = (emotions ?? []).map((e) => e.intensity).filter((v): v is number => v !== null);
  return values.length ? Math.max(...values) : null;
}

const SEALED_ENTRY_KEYS = Object.keys(SEALED.entries.fields) as (keyof typeof SEALED.entries.fields)[];

function pickSealed<T extends Record<string, unknown>, K extends string>(value: T, keys: readonly K[]) {
  const out: Partial<Record<K, unknown>> = {};
  for (const key of keys) if (key in value) out[key] = value[key as keyof T];
  return out;
}

export function entriesRepository({ db, userId, cipher }: ScopeContext) {
  const spec = SEALED.entries;
  const own = (id: string) => and(eq(entries.id, id), eq(entries.userId, userId));
  const decode = (row: typeof entries.$inferSelect): Entry => ({
    id: row.id,
    occurredAt: row.occurredAt,
    alternativeBelief: row.alternativeBelief,
    peakIntensity: row.peakIntensity,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...EntryContent.parse(openValues(cipher, spec, row)),
  });

  return {
    /** Every field is optional: a partial entry is a valid entry. */
    async create(input: EntryInput = {}): Promise<Entry> {
      const value = parseInput(EntryInput, input);
      const [row] = await db
        .insert(entries)
        .values({
          userId,
          ...(value.occurredAt ? { occurredAt: value.occurredAt } : {}),
          alternativeBelief: value.alternativeBelief ?? null,
          peakIntensity: peakIntensity(value.emotions),
          ...sealValues(cipher, spec, pickSealed(value, SEALED_ENTRY_KEYS)),
        })
        .returning();
      return decode(row!);
    },

    async get(id: string): Promise<Entry | null> {
      if (!isId(id)) return null;
      const [row] = await db.select().from(entries).where(own(id));
      return row ? decode(row) : null;
    },

    async list(range: ListRange = {}): Promise<Entry[]> {
      const where: SQL[] = [eq(entries.userId, userId)];
      if (range.from) where.push(gte(entries.occurredAt, range.from));
      if (range.to) where.push(lt(entries.occurredAt, range.to));
      const rows = await db
        .select()
        .from(entries)
        .where(and(...where))
        .orderBy(desc(entries.occurredAt))
        .limit(limitOf(range));
      return rows.map(decode);
    },

    async count(): Promise<number> {
      const [row] = await db.select({ n: count() }).from(entries).where(eq(entries.userId, userId));
      return row?.n ?? 0;
    },

    async update(id: string, patch: EntryInput): Promise<Entry | null> {
      if (!isId(id)) return null;
      const value = parseInput(EntryInput, patch);
      const [row] = await db
        .update(entries)
        .set({
          ...(value.occurredAt ? { occurredAt: value.occurredAt } : {}),
          ...(value.alternativeBelief !== undefined ? { alternativeBelief: value.alternativeBelief } : {}),
          ...(value.emotions !== undefined ? { peakIntensity: peakIntensity(value.emotions) } : {}),
          ...sealValues(cipher, spec, pickSealed(value, SEALED_ENTRY_KEYS)),
          updatedAt: new Date(),
        })
        .where(own(id))
        .returning();
      return row ? decode(row) : null;
    },

    async remove(id: string): Promise<boolean> {
      if (!isId(id)) return false;
      const rows = await db.delete(entries).where(own(id)).returning({ id: entries.id });
      return rows.length > 0;
    },
  };
}

export function checkinsRepository({ db, userId, cipher }: ScopeContext) {
  const spec = SEALED.checkins;
  const own = (id: string) => and(eq(checkins.id, id), eq(checkins.userId, userId));
  const decode = (row: typeof checkins.$inferSelect): Checkin => ({
    id: row.id,
    occurredAt: row.occurredAt,
    mood: row.mood,
    energy: row.energy,
    anxiety: row.anxiety,
    sleepHours: row.sleepHours,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...CheckinContent.parse(openValues(cipher, spec, row)),
  });
  const clearValues = (value: ReturnType<typeof CheckinInput.parse>) => ({
    ...(value.occurredAt ? { occurredAt: value.occurredAt } : {}),
    ...(value.mood !== undefined ? { mood: value.mood } : {}),
    ...(value.energy !== undefined ? { energy: value.energy } : {}),
    ...(value.anxiety !== undefined ? { anxiety: value.anxiety } : {}),
    ...(value.sleepHours !== undefined ? { sleepHours: value.sleepHours } : {}),
  });

  return {
    /** Only what the person gave; missing numbers stay missing. */
    async create(input: CheckinInput = {}): Promise<Checkin> {
      const value = parseInput(CheckinInput, input);
      const [row] = await db
        .insert(checkins)
        .values({
          userId,
          ...clearValues(value),
          ...sealValues(cipher, spec, { sleepQuality: value.sleepQuality, note: value.note }),
        })
        .returning();
      return decode(row!);
    },

    async get(id: string): Promise<Checkin | null> {
      if (!isId(id)) return null;
      const [row] = await db.select().from(checkins).where(own(id));
      return row ? decode(row) : null;
    },

    async list(range: ListRange = {}): Promise<Checkin[]> {
      const where: SQL[] = [eq(checkins.userId, userId)];
      if (range.from) where.push(gte(checkins.occurredAt, range.from));
      if (range.to) where.push(lt(checkins.occurredAt, range.to));
      const rows = await db
        .select()
        .from(checkins)
        .where(and(...where))
        .orderBy(desc(checkins.occurredAt))
        .limit(limitOf(range));
      return rows.map(decode);
    },

    async update(id: string, patch: CheckinInput): Promise<Checkin | null> {
      if (!isId(id)) return null;
      const value = parseInput(CheckinInput, patch);
      const [row] = await db
        .update(checkins)
        .set({
          ...clearValues(value),
          ...sealValues(cipher, spec, { sleepQuality: value.sleepQuality, note: value.note }),
          updatedAt: new Date(),
        })
        .where(own(id))
        .returning();
      return row ? decode(row) : null;
    },

    async remove(id: string): Promise<boolean> {
      if (!isId(id)) return false;
      const rows = await db.delete(checkins).where(own(id)).returning({ id: checkins.id });
      return rows.length > 0;
    },
  };
}

export function therapyNotesRepository({ db, userId, cipher }: ScopeContext) {
  const spec = SEALED.therapyNotes;
  const own = (id: string) => and(eq(therapyNotes.id, id), eq(therapyNotes.userId, userId));
  const decode = (row: typeof therapyNotes.$inferSelect): TherapyNote => ({
    id: row.id,
    kind: row.kind,
    body: cipher.openText(spec.columns.body, row.body),
    sessionOn: row.sessionOn,
    doneAt: row.doneAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  return {
    async create(input: TherapyNoteInput): Promise<TherapyNote> {
      const value = parseInput(TherapyNoteInput, input);
      const [row] = await db
        .insert(therapyNotes)
        .values({
          userId,
          kind: value.kind,
          sessionOn: value.sessionOn ?? null,
          body: cipher.sealText(spec.columns.body, value.body),
        })
        .returning();
      return decode(row!);
    },

    async list(filter: { kind?: TherapyNoteKind } = {}): Promise<TherapyNote[]> {
      const where: SQL[] = [eq(therapyNotes.userId, userId)];
      if (filter.kind) where.push(eq(therapyNotes.kind, filter.kind));
      const rows = await db
        .select()
        .from(therapyNotes)
        .where(and(...where))
        .orderBy(desc(therapyNotes.createdAt))
        .limit(MAX_LIMIT);
      return rows.map(decode);
    },

    async update(
      id: string,
      patch: { body?: string; sessionOn?: string | null },
    ): Promise<TherapyNote | null> {
      if (!isId(id)) return null;
      const value = parseInput(TherapyNoteInput.pick({ body: true, sessionOn: true }).partial(), patch);
      const [row] = await db
        .update(therapyNotes)
        .set({
          ...(value.body !== undefined ? { body: cipher.sealText(spec.columns.body, value.body) } : {}),
          ...(value.sessionOn !== undefined ? { sessionOn: value.sessionOn } : {}),
          updatedAt: new Date(),
        })
        .where(own(id))
        .returning();
      return row ? decode(row) : null;
    },

    /** Mark a task done (or open again). */
    async setDone(id: string, done: boolean): Promise<TherapyNote | null> {
      if (!isId(id)) return null;
      const [row] = await db
        .update(therapyNotes)
        .set({ doneAt: done ? new Date() : null, updatedAt: new Date() })
        .where(own(id))
        .returning();
      return row ? decode(row) : null;
    },

    async remove(id: string): Promise<boolean> {
      if (!isId(id)) return false;
      const rows = await db.delete(therapyNotes).where(own(id)).returning({ id: therapyNotes.id });
      return rows.length > 0;
    },
  };
}

export function insightsRepository({ db, userId, cipher }: ScopeContext) {
  const spec = SEALED.insights;
  const own = (id: string) => and(eq(insights.id, id), eq(insights.userId, userId));
  const decode = (row: typeof insights.$inferSelect): Insight => ({
    id: row.id,
    kind: row.kind,
    body: cipher.openText(spec.columns.body, row.body),
    evidence: row.evidence,
    observedAt: row.observedAt,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  return {
    async create(input: InsightInput): Promise<Insight> {
      const value = parseInput(InsightInput, input);
      const [row] = await db
        .insert(insights)
        .values({
          userId,
          kind: value.kind,
          evidence: value.evidence ?? [],
          ...(value.observedAt ? { observedAt: value.observedAt } : {}),
          body: cipher.sealText(spec.columns.body, value.body),
        })
        .returning();
      return decode(row!);
    },

    async list(filter: { kind?: InsightKind; includeArchived?: boolean } = {}): Promise<Insight[]> {
      const where: SQL[] = [eq(insights.userId, userId)];
      if (filter.kind) where.push(eq(insights.kind, filter.kind));
      if (!filter.includeArchived) where.push(isNull(insights.archivedAt));
      const rows = await db
        .select()
        .from(insights)
        .where(and(...where))
        .orderBy(desc(insights.observedAt))
        .limit(MAX_LIMIT);
      return rows.map(decode);
    },

    async archive(id: string): Promise<Insight | null> {
      if (!isId(id)) return null;
      const [row] = await db
        .update(insights)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(own(id))
        .returning();
      return row ? decode(row) : null;
    },

    async remove(id: string): Promise<boolean> {
      if (!isId(id)) return false;
      const rows = await db.delete(insights).where(own(id)).returning({ id: insights.id });
      return rows.length > 0;
    },
  };
}
