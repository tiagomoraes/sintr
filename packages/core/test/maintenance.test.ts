import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { conversations, sessions } from "../src/db/schema";
import { purgeExpiredAuthRecords, purgeExpiredConversations } from "../src/maintenance";
import { createRepositories } from "../src/repositories";
import { createUser, openTestDatabase, testMasterKey } from "./support";

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

describe("purging conversations past their retention", () => {
  it("removes old conversations of people who set a retention, and nothing else", async () => {
    const repositories = createRepositories(handle.db, testMasterKey);
    const day = 24 * 60 * 60 * 1000;
    const now = new Date();
    const setup = async (retention: number | null) => {
      const scope = await repositories.forUser(await createUser(handle.db));
      if (retention !== null) await scope.agentSettings.update({ conversationRetentionDays: retention });
      const old = await scope.conversations.create();
      await scope.conversations.append(old.id, { role: "user", content: "old" });
      const recent = await scope.conversations.create();
      await scope.conversations.append(recent.id, { role: "user", content: "recent" });
      await handle.db
        .update(conversations)
        .set({ lastMessageAt: new Date(now.getTime() - 40 * day) })
        .where(eq(conversations.id, old.id));
      const proposal = await scope.proposals.create({
        conversationId: old.id,
        kind: "entry",
        payload: { situation: "kept as an entry" },
      });
      const { record } = await scope.proposals.confirm(proposal.id);
      return { scope, old: old.id, recent: recent.id, entry: record.id };
    };
    const thirty = await setup(30);
    const keep = await setup(null);

    const result = await purgeExpiredConversations(handle.db, now);
    expect(result.conversations).toBeGreaterThanOrEqual(1);

    expect(await thirty.scope.conversations.get(thirty.old)).toBeNull();
    expect(await thirty.scope.conversations.messages(thirty.old)).toEqual([]);
    expect(await thirty.scope.conversations.get(thirty.recent)).not.toBeNull();
    // The entry saved from the purged conversation is a record of its own.
    expect(await thirty.scope.entries.get(thirty.entry)).not.toBeNull();
    // Without a retention setting, nothing goes.
    expect(await keep.scope.conversations.get(keep.old)).not.toBeNull();
  });
});
