import { eq } from "drizzle-orm";
import { generateDataKey, unwrapDataKey, wrapDataKey, type MasterKey } from "../crypto";
import type { Executor } from "../db/client";
import { userKeys } from "../db/schema";
import { DataAccessError, NotFoundError, sanitizeError } from "../errors";

/**
 * Load the user's data key, creating and storing it (wrapped) on first use.
 * Safe under concurrency: a lost insert race re-reads the winner's key.
 */
export async function loadDataKey(db: Executor, kek: MasterKey, userId: string): Promise<Buffer> {
  const read = async () => {
    const [row] = await db.select().from(userKeys).where(eq(userKeys.userId, userId));
    return row;
  };
  let row = await read();
  if (!row) {
    try {
      await db
        .insert(userKeys)
        .values({ userId, kekId: kek.id, wrappedDek: wrapDataKey(kek, generateDataKey(), userId) })
        .onConflictDoNothing();
    } catch (error) {
      const clean = sanitizeError(error);
      if (clean instanceof DataAccessError && clean.code === "23503") throw new NotFoundError("user");
      throw clean;
    }
    row = await read();
  }
  if (!row) throw new NotFoundError("user");
  if (row.kekId !== kek.id) {
    // Rotation is not implemented yet: a key wrapped by another KEK cannot be opened.
    throw new DataAccessError("kek_mismatch");
  }
  return unwrapDataKey(kek, row.wrappedDek, userId);
}
