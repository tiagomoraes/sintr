import { and, asc, eq } from "drizzle-orm";
import type { Database, Executor, Transaction } from "../db/client";
import { SEALED } from "../db/sealed";
import { corrections } from "../db/schema";
import type { Correction } from "../domain";
import type { ScopeContext } from "./context";

export type CorrectionTarget = { entryId: string } | { checkinId: string };

/** Run `fn` atomically; on a transaction already open this is a savepoint. */
export function inTransaction<T>(db: Executor, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return (db as Database).transaction(fn);
}

/** Empty lists and empty strings count as nothing, like null. */
function comparable(value: unknown): string {
  if (value === undefined || value === null || value === "") return "null";
  if (Array.isArray(value) && value.length === 0) return "null";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  return JSON.stringify(value);
}

/**
 * The fields of `next` whose value differs from `current`, and what each
 * held before. Fields absent from `next` are not part of the change.
 */
export function diffFields(
  currentRecord: object,
  nextValues: object,
  keys: readonly string[],
): { fields: string[]; previous: Record<string, unknown> } {
  const current = currentRecord as Readonly<Record<string, unknown>>;
  const next = nextValues as Readonly<Record<string, unknown>>;
  const fields: string[] = [];
  const previous: Record<string, unknown> = {};
  for (const key of keys) {
    if (!(key in next) || next[key] === undefined) continue;
    if (comparable(current[key]) === comparable(next[key])) continue;
    fields.push(key);
    const before = current[key];
    previous[key] = before instanceof Date ? before.toISOString() : (before ?? null);
  }
  return { fields, previous };
}

export function correctionsRepository({ db, userId, cipher }: ScopeContext) {
  const spec = SEALED.corrections;
  const decode = (row: typeof corrections.$inferSelect): Correction => ({
    id: row.id,
    fields: row.fields,
    previous: cipher.openJson(spec.columns.previous, row.previous) as Record<string, unknown>,
    note: row.note ? cipher.openText(spec.columns.note, row.note) : null,
    createdAt: row.createdAt,
  });
  const targetWhere = (target: CorrectionTarget) =>
    "entryId" in target
      ? and(eq(corrections.userId, userId), eq(corrections.entryId, target.entryId))
      : and(eq(corrections.userId, userId), eq(corrections.checkinId, target.checkinId));

  return {
    async record(
      target: CorrectionTarget,
      change: { fields: string[]; previous: Record<string, unknown> },
      note: string | null,
    ): Promise<Correction> {
      const [row] = await db
        .insert(corrections)
        .values({
          userId,
          ...("entryId" in target ? { entryId: target.entryId } : { checkinId: target.checkinId }),
          fields: change.fields,
          previous: cipher.sealJson(spec.columns.previous, change.previous),
          note: note ? cipher.sealText(spec.columns.note, note) : null,
        })
        .returning();
      return decode(row!);
    },

    /** Oldest first: the order the record changed in. */
    async list(target: CorrectionTarget): Promise<Correction[]> {
      const rows = await db
        .select()
        .from(corrections)
        .where(targetWhere(target))
        .orderBy(asc(corrections.createdAt))
        .limit(500);
      return rows.map(decode);
    },
  };
}
