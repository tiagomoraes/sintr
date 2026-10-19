import { and, eq, exists, inArray, sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { consents, profiles, therapySeries, therapySeriesChanges, therapySettings } from "../db/schema";
import { HEALTH_DATA_CONSENT_VERSION } from "../domain";
import { sanitizeError } from "../errors";
import { decodeChange, decodeSeries } from "../repositories/sessions";
import type { SessionSchedule } from "./period";

/** One person's therapy calendar, for the scheduler. Clear metadata only. */
export interface PersonSchedule {
  userId: string;
  timeZone: string;
  schedule: SessionSchedule;
}

/**
 * Everyone with a session in their calendar whose latest consent to
 * process their health data is granted, in its current wording: the same
 * gate every page and route of the app applies. Spans all people by
 * nature, so it reads no content: days, times, how they repeat, time zones
 * and the lead, all kept in the clear.
 */
export async function reportSchedules(db: Executor): Promise<PersonSchedule[]> {
  try {
    const people = await db
      .select({
        userId: therapySettings.userId,
        timeZone: profiles.timezone,
        reportLeadMinutes: therapySettings.reportLeadMinutes,
      })
      .from(therapySettings)
      .innerJoin(profiles, eq(profiles.userId, therapySettings.userId))
      .where(
        and(
          exists(
            db
              .select({ one: sql`1` })
              .from(therapySeries)
              .where(eq(therapySeries.userId, therapySettings.userId)),
          ),
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
    if (people.length === 0) return [];
    const ids = people.map((person) => person.userId);
    const [series, changes] = await Promise.all([
      db.select().from(therapySeries).where(inArray(therapySeries.userId, ids)),
      db.select().from(therapySeriesChanges).where(inArray(therapySeriesChanges.userId, ids)),
    ]);
    return people.map((person) => ({
      userId: person.userId,
      timeZone: person.timeZone,
      schedule: {
        series: series.filter((row) => row.userId === person.userId).map(decodeSeries),
        changes: changes.filter((row) => row.userId === person.userId).map(decodeChange),
        reportLeadMinutes: person.reportLeadMinutes,
      },
    }));
  } catch (error) {
    throw sanitizeError(error);
  }
}
