import { eq, sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { practices, users } from "../db/schema";
import type { PracticePlan } from "../domain";
import { InvalidStateError, NotFoundError, ValidationError, sanitizeError } from "../errors";
import { auditAccounts } from "../repositories/links";

type PracticeRow = typeof practices.$inferSelect;

/**
 * Give a practice a plan and a seat count, or return it to the
 * installation's defaults with `grant: null`. The one way seats change:
 * the admin path (`grant`) and the payment provider's webhook
 * (`subscription`) both come through here. Audited in the professional's log.
 */
export async function writePracticePlan(
  db: Executor,
  practice: Pick<PracticeRow, "id" | "userId">,
  grant: PracticePlan | null,
  source: "grant" | "subscription",
): Promise<void> {
  await db
    .update(practices)
    .set(
      grant
        ? { seatSource: source, plan: grant.plan, seats: grant.seats, updatedAt: new Date() }
        : { seatSource: "config", plan: null, seats: null, updatedAt: new Date() },
    )
    .where(eq(practices.id, practice.id));
  await auditAccounts(db, [practice.userId], {
    action: "practice.plan_changed",
    targetType: "practice",
    targetId: practice.id,
    metadata: grant
      ? { source, plan: grant.plan, seats: grant.seats }
      : { source: "config", plan: null, seats: null },
  });
}

/**
 * The admin path for seats: give a practice (found by its professional's
 * account email) a plan and a seat count, or return it to the
 * installation's defaults with `grant: null`. Refused while the practice
 * pays for its seats with the payment provider: those change there.
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
      .select({ id: practices.id, userId: practices.userId, seatSource: practices.seatSource })
      .from(practices)
      .innerJoin(users, eq(users.id, practices.userId))
      .where(eq(sql`lower(${users.email})`, input.email.trim().toLowerCase()));
    if (!row) throw new NotFoundError("practice");
    if (row.seatSource === "subscription") {
      throw new InvalidStateError("this practice pays for its seats with the payment provider");
    }
    await writePracticePlan(db, row, grant, "grant");
    return { practiceId: row.id };
  } catch (error) {
    throw sanitizeError(error);
  }
}
