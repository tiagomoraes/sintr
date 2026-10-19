"use server";

import { BillingError, isEntitling } from "@sintr/core";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MAX_SEATS } from "@/lib/plan";
import { requireScope, runtime } from "@/lib/server/runtime";

/** Arguments bound to a server action come back from the browser: read them again. */
const Kind = z.enum(["person", "practice"]);

function seatsFrom(form: FormData): number | null {
  const value = Number(form.get("seats"));
  return Number.isInteger(value) && value >= 1 && value <= MAX_SEATS ? value : null;
}

/**
 * Subscribe: send the person to the payment provider's own Checkout page
 * for this plan. Nothing is charged here and no card ever reaches sintr;
 * the plan changes when the provider's webhook says the payment went
 * through. Refused, back to the plan page, when payments are off, the plan
 * is not sold here, or the account already pays for it.
 */
export async function subscribe(given: unknown, form: FormData): Promise<void> {
  const { user, scope } = await requireScope();
  const { payments, config, log } = runtime();
  const parsed = Kind.safeParse(given);
  if (!payments || !parsed.success) redirect("/plan");
  const kind = parsed.data;
  let quantity = 1;
  if (kind === "person") {
    if (!config.house || !payments.offers.personal) redirect("/plan");
  } else {
    const seats = seatsFrom(form);
    if (!payments.offers.practice || !(await scope.practice.get()) || seats === null) {
      redirect("/plan?billing=seats#practice");
    }
    quantity = seats;
  }
  const current = await scope.plans.subscription(kind);
  if (current?.source === "stripe" && isEntitling(current.status)) redirect("/plan");

  let url: string;
  try {
    ({ url } = await payments.checkout({
      kind,
      userId: user.id,
      email: user.email,
      customerId: await scope.plans.customer(),
      quantity,
      origin: config.url.origin,
    }));
  } catch (error) {
    log.warn("billing.checkout_failed", {
      userId: user.id,
      code: error instanceof BillingError ? error.code : "failed",
      error,
    });
    redirect("/plan?billing=unavailable");
  }
  redirect(url);
}

/** The payment provider's billing page: the card, the seats, cancelling. */
export async function manageSubscription(): Promise<void> {
  const { user, scope } = await requireScope();
  const { payments, config, log } = runtime();
  const customer = await scope.plans.customer();
  if (!payments || !customer) redirect("/plan");
  let url: string;
  try {
    ({ url } = await payments.portal(customer, config.url.origin));
  } catch (error) {
    log.warn("billing.portal_failed", {
      userId: user.id,
      code: error instanceof BillingError ? error.code : "failed",
      error,
    });
    redirect("/plan?billing=unavailable");
  }
  redirect(url);
}
