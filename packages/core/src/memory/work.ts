import { sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { checkins, consents, entries, memories, memoryReads, users } from "../db/schema";
import { HEALTH_DATA_CONSENT_VERSION, MEMORY_CONSENT_VERSION } from "../domain";
import { sanitizeError } from "../errors";
import { inMilliseconds } from "../repositories/memories";

/** The latest decision of one purpose for the person in `users.id`: granted, in its current wording. */
function currentConsent(purpose: string, version: string) {
  return sql`(
    select ${consents.granted} and ${consents.version} = ${version}
    from ${consents}
    where ${consents.userId} = ${users.id} and ${consents.purpose}::text = ${purpose}
    order by ${consents.createdAt} desc
    limit 1
  ) is true`;
}

/**
 * Everyone whose memory is on and who has something waiting: an entry or a
 * check-in note not read yet (or changed since), or a memory not placed by
 * meaning yet. "On" here is the person's latest memory consent, granted in
 * its current wording, beside their consent to process health data: the
 * gate every page applies. Whether that consent names the providers that
 * would read now is checked per person, with their key. Spans all people by
 * nature, so it reads no content: ids, versions and times.
 */
export async function memoryWork(db: Executor): Promise<string[]> {
  try {
    const rows = await db
      .select({ userId: users.id })
      .from(users)
      .where(
        sql`${currentConsent("memory", MEMORY_CONSENT_VERSION)}
          and ${currentConsent("health_data_processing", HEALTH_DATA_CONSENT_VERSION)}
          and (
            exists (
              select 1 from ${entries}
              left join ${memoryReads}
                on ${memoryReads.entryId} = ${entries.id} and ${memoryReads.userId} = ${entries.userId}
              where ${entries.userId} = ${users.id}
                and (${memoryReads.id} is null or ${memoryReads.sourceUpdatedAt} < ${inMilliseconds(entries.updatedAt)})
            )
            or exists (
              select 1 from ${checkins}
              left join ${memoryReads}
                on ${memoryReads.checkinId} = ${checkins.id} and ${memoryReads.userId} = ${checkins.userId}
              where ${checkins.userId} = ${users.id} and ${checkins.note} is not null
                and (${memoryReads.id} is null or ${memoryReads.sourceUpdatedAt} < ${inMilliseconds(checkins.updatedAt)})
            )
            or exists (
              select 1 from ${memories}
              where ${memories.userId} = ${users.id} and ${memories.kind} <> 'name' and ${memories.embedding} is null
            )
          )`,
      );
    return rows.map((row) => row.userId);
  } catch (error) {
    throw sanitizeError(error);
  }
}
