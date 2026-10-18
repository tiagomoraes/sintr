import { lt, sql } from "drizzle-orm";
import type { Executor } from "./db/client";
import { agentSettings, conversations, sessions, verificationTokens } from "./db/schema";
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

/**
 * Delete conversations older than their owner's retention setting: a
 * conversation whose last message is more than `conversation_retention_days`
 * days old goes, with its messages and drafts (by cascade). People without a
 * retention setting keep their conversations. Entries and check-ins saved
 * from a conversation are records of their own and stay.
 */
export async function purgeExpiredConversations(
  db: Executor,
  now: Date = new Date(),
): Promise<{ conversations: number }> {
  try {
    const removed = await db
      .delete(conversations)
      .where(
        sql`exists (
          select 1 from ${agentSettings}
          where ${agentSettings.userId} = ${conversations.userId}
            and ${agentSettings.conversationRetentionDays} is not null
            and coalesce(${conversations.lastMessageAt}, ${conversations.createdAt})
              < ${now.toISOString()}::timestamptz - make_interval(days => ${agentSettings.conversationRetentionDays})
        )`,
      )
      .returning({ id: conversations.id });
    return { conversations: removed.length };
  } catch (error) {
    throw sanitizeError(error);
  }
}
