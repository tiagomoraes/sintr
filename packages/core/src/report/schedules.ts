import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { consents, profiles, therapySettings } from "../db/schema";
import { HEALTH_DATA_CONSENT_VERSION } from "../domain";
import { sanitizeError } from "../errors";
import type { SessionSchedule } from "./period";

/** One person's therapy schedule, for the scheduler. Clear metadata only. */
export interface PersonSchedule {
  userId: string;
  timeZone: string;
  schedule: SessionSchedule;
}

/**
 * Everyone with a weekly session to prepare for whose latest consent to process their health
 * data is granted, in its current wording: the same gate every page and
 * route of the app applies. Spans all people by nature, so it reads no
 * content: days, times, time zones and the lead, all kept in the clear.
 */
export async function reportSchedules(db: Executor): Promise<PersonSchedule[]> {
  try {
    const rows = await db
      .select({
        userId: therapySettings.userId,
        timeZone: profiles.timezone,
        sessionDay: therapySettings.sessionDay,
        sessionTime: therapySettings.sessionTime,
        reportLeadMinutes: therapySettings.reportLeadMinutes,
      })
      .from(therapySettings)
      .innerJoin(profiles, eq(profiles.userId, therapySettings.userId))
      .where(
        and(
          isNotNull(therapySettings.sessionDay),
          isNotNull(therapySettings.sessionTime),
          sql`(
            select ${consents.granted} and ${consents.version} = ${HEALTH_DATA_CONSENT_VERSION}
            from ${consents}
            where ${consents.userId} = ${therapySettings.userId}
              and ${consents.purpose} = 'health_data_processing'
            order by ${consents.createdAt} desc
            limit 1
          ) is true`,
        ),
      );
    return rows.map((row) => ({
      userId: row.userId,
      timeZone: row.timeZone,
      schedule: {
        sessionDay: row.sessionDay,
        sessionTime: row.sessionTime ? row.sessionTime.slice(0, 5) : null,
        reportLeadMinutes: row.reportLeadMinutes,
      },
    }));
  } catch (error) {
    throw sanitizeError(error);
  }
}
