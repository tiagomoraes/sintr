import { and, gt, isNotNull, or, eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { profiles, therapySettings } from "../db/schema";
import { sanitizeError } from "../errors";
import type { SessionSchedule } from "./period";

/** One person's therapy schedule, for the scheduler. Clear metadata only. */
export interface PersonSchedule {
  userId: string;
  timeZone: string;
  schedule: SessionSchedule;
}

/**
 * Everyone with a session to prepare for: a weekly day and time, or a
 * one-off date still ahead. Spans all people by nature, so it reads no
 * content: days, times, time zones and the lead, all kept in the clear.
 */
export async function reportSchedules(db: Executor, now: Date = new Date()): Promise<PersonSchedule[]> {
  try {
    const rows = await db
      .select({
        userId: therapySettings.userId,
        timeZone: profiles.timezone,
        sessionDay: therapySettings.sessionDay,
        sessionTime: therapySettings.sessionTime,
        nextSessionAt: therapySettings.nextSessionAt,
        reportLeadMinutes: therapySettings.reportLeadMinutes,
      })
      .from(therapySettings)
      .innerJoin(profiles, eq(profiles.userId, therapySettings.userId))
      .where(
        or(
          and(isNotNull(therapySettings.sessionDay), isNotNull(therapySettings.sessionTime)),
          gt(therapySettings.nextSessionAt, now),
        ),
      );
    return rows.map((row) => ({
      userId: row.userId,
      timeZone: row.timeZone,
      schedule: {
        sessionDay: row.sessionDay,
        sessionTime: row.sessionTime ? row.sessionTime.slice(0, 5) : null,
        nextSessionAt: row.nextSessionAt,
        reportLeadMinutes: row.reportLeadMinutes,
      },
    }));
  } catch (error) {
    throw sanitizeError(error);
  }
}
