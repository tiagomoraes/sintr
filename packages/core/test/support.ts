import { randomUUID } from "node:crypto";
import { inject } from "vitest";
import { generateMasterKey, parseMasterKey } from "../src/crypto";
import { createDatabase, type Database } from "../src/db/client";
import { users } from "../src/db/schema";

/** A master key that exists only for this test run. */
export const testMasterKey = parseMasterKey(generateMasterKey(), "k1");

export function openTestDatabase() {
  return createDatabase(inject("databaseUrl"), { max: 4 });
}

/** Insert a bare user row, as Better Auth would, and return its id. */
export async function createUser(db: Database, label = "person"): Promise<string> {
  const id = `${label}-${randomUUID()}`;
  await db.insert(users).values({ id, email: `${id}@example.test` });
  return id;
}

/** A recognisable string, unique per call, to look for in raw storage. */
export function marker(label: string): string {
  return `marker ${label} ${randomUUID()} the person's own words`;
}
