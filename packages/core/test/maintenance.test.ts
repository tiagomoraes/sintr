import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { sessions } from "../src/db/schema";
import { purgeExpiredAuthRecords } from "../src/maintenance";
import { createUser, openTestDatabase } from "./support";

const handle = openTestDatabase();
afterAll(() => handle.close());

describe("purging expired auth records", () => {
  it("removes expired sessions and keeps live ones", async () => {
    const userId = await createUser(handle.db);
    const expired = {
      id: randomUUID(),
      userId,
      token: randomUUID(),
      expiresAt: new Date(Date.now() - 60_000),
    };
    const live = { id: randomUUID(), userId, token: randomUUID(), expiresAt: new Date(Date.now() + 60_000) };
    await handle.db.insert(sessions).values([expired, live]);

    const result = await purgeExpiredAuthRecords(handle.db);
    expect(result.sessions).toBeGreaterThanOrEqual(1);

    const left = await handle.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(inArray(sessions.id, [expired.id, live.id]));
    expect(left.map((s) => s.id)).toEqual([live.id]);
    await handle.db.delete(sessions).where(eq(sessions.id, live.id));
  });
});
