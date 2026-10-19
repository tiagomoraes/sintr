import { and, eq, sql } from "drizzle-orm";
import type { Database, Executor } from "../db/client";
import { practices, subscriptions, users } from "../db/schema";
import { isEntitling, type SubscriptionKind } from "../domain";
import { InvalidStateError, NotFoundError, sanitizeError } from "../errors";
import { writePracticePlan } from "../practice/plan";
import { inTransaction } from "../repositories/corrections";
import { auditAccounts } from "../repositories/links";
import type { BillingConfig, ProviderSubscription } from "./stripe";

/** The label a practice's plan carries while it pays for its seats. */
export const PRACTICE_PLAN_LABEL = "Practice";

async function accountByEmail(db: Executor, email: string): Promise<string> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.trim().toLowerCase()));
  if (!row) throw new NotFoundError("account");
  return row.id;
}

/**
 * The admin path for a person's plan, until (and next to) payments: give an
 * account (by its email) Personal or Unlimited, or return it to the
 * installation's default with `plan: null`. Refused while the account pays
 * for its plan with the payment provider. Audited in the person's log.
 */
export async function setPersonPlan(
  db: Database,
  input: { email: string; plan: "personal" | "unlimited" | null },
): Promise<{ userId: string }> {
  try {
    const userId = await accountByEmail(db, input.email);
    await inTransaction(db, async (tx) => {
      const [current] = await tx
        .select()
        .from(subscriptions)
        .where(and(eq(subscriptions.userId, userId), eq(subscriptions.kind, "person")))
        .for("update");
      if (current?.source === "stripe" && isEntitling(current.status)) {
        throw new InvalidStateError("this account pays for its plan with the payment provider");
      }
      if (input.plan === null) {
        if (current?.source !== "grant") return;
        await tx.delete(subscriptions).where(eq(subscriptions.id, current.id));
      } else {
        const values = {
          plan: input.plan,
          status: "active" as const,
          source: "grant" as const,
          seats: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          providerSubscriptionId: null,
          updatedAt: new Date(),
        };
        await tx
          .insert(subscriptions)
          .values({ userId, kind: "person", ...values })
          .onConflictDoUpdate({ target: [subscriptions.userId, subscriptions.kind], set: values });
      }
      await auditAccounts(tx, [userId], {
        action: "plan.changed",
        targetType: "subscription",
        metadata: { kind: "person", plan: input.plan, source: input.plan ? "grant" : "installation" },
      });
    });
    return { userId };
  } catch (error) {
    throw sanitizeError(error);
  }
}

export type AppliedOutcome =
  /** The plan now follows this subscription. */
  | "applied"
  /** Nothing changed. */
  | "unchanged"
  /** Not a subscription sintr started (no account in its metadata). */
  | "unrelated"
  /** For an account that no longer exists. */
  | "unknown_account"
  /** A new subscription for a price this installation does not sell. */
  | "unknown_price"
  /**
   * The account already holds another plan of this kind that is kept: an
   * active paid subscription, or an active grant that a subscription which
   * is not paid (incomplete, cancelled) must not replace.
   */
  | "duplicate";

/**
 * Apply a subscription's current state, as the payment provider reports
 * it, to the account it was made for: its plan, status, period and, for a
 * practice, its seats (through the same function as the admin path).
 * Applying the same state twice changes nothing, so a webhook delivered
 * twice is harmless. The price is checked for a subscription sintr does not
 * follow yet; one it already follows keeps being followed (cancelled,
 * renewed) even after the installation stopped selling its price.
 */
export async function applyProviderSubscription(
  db: Executor,
  sub: ProviderSubscription,
  prices: Extract<BillingConfig, { kind: "stripe" }>["prices"],
): Promise<{ outcome: AppliedOutcome; userId: string | null; kind: SubscriptionKind | null }> {
  const { userId, kind } = sub;
  if (!userId || !kind) return { outcome: "unrelated", userId: null, kind: null };
  const price = kind === "person" ? prices.personal : prices.practiceSeat;
  try {
    return await inTransaction(db, async (tx) => {
      const [account] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId));
      if (!account) return { outcome: "unknown_account" as const, userId, kind };
      const [current] = await tx
        .select()
        .from(subscriptions)
        .where(and(eq(subscriptions.userId, userId), eq(subscriptions.kind, kind)))
        .for("update");
      const followed = current?.providerSubscriptionId === sub.id;
      if (!followed && (!price || sub.priceId !== price)) {
        return { outcome: "unknown_price" as const, userId, kind };
      }
      // Another plan of this kind that holds: a paid one is never replaced by a second,
      // and a grant only by a subscription that is actually paid.
      if (
        current &&
        !followed &&
        isEntitling(current.status) &&
        (current.source === "stripe" || !isEntitling(sub.status))
      ) {
        return { outcome: "duplicate" as const, userId, kind };
      }
      const seats = kind === "practice" ? sub.quantity : null;
      const values = {
        plan: kind === "person" ? "personal" : "practice",
        status: sub.status,
        source: "stripe" as const,
        seats,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        providerCustomerId: sub.customerId,
        providerSubscriptionId: sub.id,
      };
      const same =
        current !== undefined &&
        current.source === "stripe" &&
        current.providerSubscriptionId === sub.id &&
        current.status === values.status &&
        current.seats === seats &&
        current.cancelAtPeriodEnd === values.cancelAtPeriodEnd &&
        current.currentPeriodEnd?.getTime() === values.currentPeriodEnd?.getTime();
      if (same) return { outcome: "unchanged" as const, userId, kind };
      await tx
        .insert(subscriptions)
        .values({ userId, kind, ...values })
        .onConflictDoUpdate({
          target: [subscriptions.userId, subscriptions.kind],
          set: { ...values, updatedAt: new Date() },
        });
      if (kind === "practice") {
        const [practice] = await tx
          .select()
          .from(practices)
          .where(eq(practices.userId, userId))
          .for("update");
        if (practice && isEntitling(sub.status)) {
          if (
            practice.seatSource !== "subscription" ||
            practice.seats !== seats ||
            practice.plan !== PRACTICE_PLAN_LABEL
          ) {
            await writePracticePlan(tx, practice, { plan: PRACTICE_PLAN_LABEL, seats }, "subscription");
          }
        } else if (practice?.seatSource === "subscription") {
          // Back to the installation's defaults. Lowering seats never ends a link.
          await writePracticePlan(tx, practice, null, "subscription");
        }
      }
      await auditAccounts(tx, [userId], {
        action: "plan.changed",
        targetType: "subscription",
        metadata: { kind, plan: values.plan, status: sub.status, source: "stripe", seats },
      });
      return { outcome: "applied" as const, userId, kind };
    });
  } catch (error) {
    throw sanitizeError(error);
  }
}
