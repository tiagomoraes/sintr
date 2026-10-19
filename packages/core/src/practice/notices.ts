import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import type { Executor } from "../db/client";
import { links, practices, sharedReports, users } from "../db/schema";
import { practiceReportEmail, type EmailTransport } from "../email";
import { sanitizeError } from "../errors";
import type { Logger } from "../log";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Tell professionals by email that a report arrived, when they asked for it
 * (`notify_email`) and their address is confirmed. One message per practice
 * and run, holding a link and a count: never the person's name or words.
 * Each report is claimed before the message leaves, so a second worker
 * never sends it twice; a failed send leaves the notice in the app.
 * Spans every practice by nature, so it reads no content.
 */
export async function sendPracticeNotices(input: {
  db: Executor;
  email: EmailTransport;
  origin: string;
  log: Logger;
  now?: Date;
}): Promise<{ sent: number }> {
  const { db, email, log } = input;
  const now = input.now ?? new Date();
  if (!email.available) return { sent: 0 };
  let due: { id: string; practiceId: string; to: string }[];
  try {
    due = await db
      .select({ id: sharedReports.id, practiceId: practices.id, to: users.email })
      .from(sharedReports)
      .innerJoin(links, and(eq(links.id, sharedReports.linkId), eq(links.status, "active")))
      .innerJoin(practices, eq(practices.id, links.practiceId))
      .innerJoin(users, eq(users.id, practices.userId))
      .where(
        and(
          isNull(sharedReports.notifiedAt),
          gt(sharedReports.createdAt, new Date(now.getTime() - DAY)),
          eq(practices.notifyEmail, true),
          eq(users.emailVerified, true),
        ),
      )
      .limit(500);
  } catch (error) {
    throw sanitizeError(error);
  }
  const byPractice = new Map<string, { to: string; ids: string[] }>();
  for (const row of due) {
    const entry = byPractice.get(row.practiceId) ?? { to: row.to, ids: [] };
    entry.ids.push(row.id);
    byPractice.set(row.practiceId, entry);
  }
  let sent = 0;
  for (const [practiceId, { to, ids }] of byPractice) {
    const claimed = await db
      .update(sharedReports)
      .set({ notifiedAt: now })
      .where(and(inArray(sharedReports.id, ids), isNull(sharedReports.notifiedAt)))
      .returning({ id: sharedReports.id });
    if (claimed.length === 0) continue;
    try {
      await email.send(practiceReportEmail({ to, url: `${input.origin}/practice`, count: claimed.length }));
      sent += 1;
      log.info("practice.notified", { count: claimed.length });
    } catch (error) {
      log.warn("practice.notice_failed", { practiceId, error });
    }
  }
  return { sent };
}
