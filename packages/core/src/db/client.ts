import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Database = PostgresJsDatabase<Schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Anything queries can run on: the database or an open transaction. */
export type Executor = Database | Transaction;

export interface DatabaseHandle {
  readonly db: Database;
  close(): Promise<void>;
}

export interface DatabaseOptions {
  /** Pool size. */
  max?: number;
}

export function createDatabase(url: string, options: DatabaseOptions = {}): DatabaseHandle {
  const client = postgres(url, {
    max: options.max ?? 10,
    // Server notices go nowhere: they can quote statements.
    onnotice: () => undefined,
    connection: { application_name: "sintr" },
  });
  const db = drizzle(client, { schema });
  return { db, close: () => client.end({ timeout: 5 }) };
}
