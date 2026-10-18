import { getTableColumns, getTableName } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { FieldCipher } from "../crypto";
import {
  checkins,
  consents,
  conversations,
  entries,
  insights,
  messages,
  profiles,
  reports,
  therapyNotes,
  therapySettings,
  userKeys,
} from "./schema";

/**
 * The single declaration of which columns hold sensitive content. Repositories
 * seal and open values through these specs, the AAD of every value names its
 * `table.column`, and the schema tests check that every bytea column in the
 * schema is declared here or as key material.
 */

export type SealedKind = "text" | "json" | "bytes";

type ColumnKey<T extends PgTable> = keyof T["_"]["columns"] & string;

export interface SealedSpec<K extends string = string> {
  readonly table: PgTable;
  readonly tableName: string;
  readonly fields: Readonly<Record<K, SealedKind>>;
  /** The AAD column name of each field, `table.column` in SQL names. */
  readonly columns: Readonly<Record<K, string>>;
}

export function sealedFields<T extends PgTable, const F extends Partial<Record<ColumnKey<T>, SealedKind>>>(
  table: T,
  fields: F,
): SealedSpec<keyof F & string> {
  const tableName = getTableName(table);
  const all = getTableColumns(table) as Record<string, { name: string }>;
  const columns = {} as Record<string, string>;
  for (const key of Object.keys(fields)) {
    const column = all[key];
    if (!column) throw new Error(`unknown column ${tableName}.${key}`);
    columns[key] = `${tableName}.${column.name}`;
  }
  return {
    table,
    tableName,
    fields: fields as unknown as Record<keyof F & string, SealedKind>,
    columns: columns as Record<keyof F & string, string>,
  };
}

export const SEALED = {
  profiles: sealedFields(profiles, { displayName: "text" }),
  therapySettings: sealedFields(therapySettings, { therapistName: "text", therapistContact: "text" }),
  entries: sealedFields(entries, {
    title: "text",
    situation: "text",
    thoughts: "json",
    emotions: "json",
    body: "text",
    behavior: "text",
    context: "text",
    tags: "json",
    notes: "text",
    hotThought: "text",
    evidenceFor: "text",
    evidenceAgainst: "text",
    alternative: "text",
    emotionsAfter: "json",
  }),
  checkins: sealedFields(checkins, { sleepQuality: "text", note: "text" }),
  therapyNotes: sealedFields(therapyNotes, { body: "text" }),
  insights: sealedFields(insights, { body: "text" }),
  reports: sealedFields(reports, { content: "text", pdf: "bytes", recipient: "text" }),
  consents: sealedFields(consents, { recipient: "text" }),
  conversations: sealedFields(conversations, { title: "text" }),
  messages: sealedFields(messages, { content: "text" }),
} as const;

/** bytea columns that hold wrapped keys rather than sealed content. */
export const KEY_MATERIAL: readonly { table: PgTable; column: string }[] = [
  { table: userKeys, column: "wrappedDek" },
];

/** Seal the given fields; `null` stays `null`, absent fields stay absent. */
export function sealValues<K extends string>(
  cipher: FieldCipher,
  spec: SealedSpec<K>,
  values: Partial<Record<K, unknown>>,
): Partial<Record<K, Buffer | null>> {
  const out: Partial<Record<K, Buffer | null>> = {};
  for (const key of Object.keys(values) as K[]) {
    const value = values[key];
    if (value === undefined) continue;
    if (value === null) {
      out[key] = null;
      continue;
    }
    const column = spec.columns[key];
    switch (spec.fields[key]) {
      case "text":
        out[key] = cipher.sealText(column, value as string);
        break;
      case "json":
        out[key] = cipher.sealJson(column, value);
        break;
      case "bytes":
        out[key] = cipher.sealBytes(column, value as Uint8Array);
        break;
    }
  }
  return out;
}

/** Open every sealed field of a row. JSON fields come back as `unknown`. */
export function openValues<K extends string>(
  cipher: FieldCipher,
  spec: SealedSpec<K>,
  row: Readonly<Record<K, Buffer | null>>,
): Record<K, unknown> {
  const out = {} as Record<K, unknown>;
  for (const key of Object.keys(spec.fields) as K[]) {
    const envelope = row[key];
    const column = spec.columns[key];
    if (envelope === null || envelope === undefined) {
      out[key] = null;
      continue;
    }
    switch (spec.fields[key]) {
      case "text":
        out[key] = cipher.openText(column, envelope);
        break;
      case "json":
        out[key] = cipher.openJson(column, envelope);
        break;
      case "bytes":
        out[key] = cipher.openBytes(column, envelope);
        break;
    }
  }
  return out;
}
