import { eq, sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { practices, users } from "../db/schema";
import type { PracticePlan } from "../domain";
import { NotFoundError, ValidationError, sanitizeError } from "../errors";
import { auditAccounts } from "../repositories/links";

/**
 * The admin path for seats, until a payment provider: give a practice (found
 * by its professional's account email) a plan and a seat count, or return it
 * to the installation's defaults with `grant: null`. A provider's webhook
 * will call this same function, so seats keep one way in. Audited in the
 * professional's log.
 */
export async function setPracticePlan(
  db: Executor,
  input: { email: string; grant: PracticePlan | null },
): Promise<{ practiceId: string }> {
  const { grant } = input;
  if (grant && (grant.plan.length === 0 || grant.plan.length > 60)) throw new ValidationError(["plan"]);
  if (
    grant &&
    grant.seats !== null &&
    !(Number.isInteger(grant.seats) && grant.seats >= 0 && grant.seats <= 100_000)
  ) {
    throw new ValidationError(["seats"]);
  }
  try {
    const [row] = await db
      .select({ id: practices.id, userId: practices.userId })
      .from(practices)
      .innerJoin(users, eq(users.id, practices.userId))
      .where(eq(sql`lower(${users.email})`, input.email.trim().toLowerCase()));
    if (!row) throw new NotFoundError("practice");
    await db
      .update(practices)
      .set(
        grant
          ? { seatSource: "grant", plan: grant.plan, seats: grant.seats, updatedAt: new Date() }
          : { seatSource: "config", plan: null, seats: null, updatedAt: new Date() },
      )
      .where(eq(practices.id, row.id));
    await auditAccounts(db, [row.userId], {
      action: "practice.plan_changed",
      targetType: "practice",
      targetId: row.id,
      metadata: grant
        ? { source: "grant", plan: grant.plan, seats: grant.seats }
        : { source: "config", plan: null, seats: null },
    });
    return { practiceId: row.id };
  } catch (error) {
    throw sanitizeError(error);
  }
}
