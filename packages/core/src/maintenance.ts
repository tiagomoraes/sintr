import { lt } from "drizzle-orm";
import type { Executor } from "./db/client";
import { sessions, verificationTokens } from "./db/schema";
import { sanitizeError } from "./errors";

/**
 * Housekeeping that spans all users by nature: it removes expired auth
 * records and never reads ledger content.
 */
export async function purgeExpiredAuthRecords(
  db: Executor,
  now: Date = new Date(),
): Promise<{ sessions: number; verificationTokens: number }> {
  try {
    const expiredSessions = await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, now))
      .returning({ id: sessions.id });
    const expiredTokens = await db
      .delete(verificationTokens)
      .where(lt(verificationTokens.expiresAt, now))
      .returning({ id: verificationTokens.id });
    return { sessions: expiredSessions.length, verificationTokens: expiredTokens.length };
  } catch (error) {
    throw sanitizeError(error);
  }
}
