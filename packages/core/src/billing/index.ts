import type { Database } from "../db/client";
import type { Logger } from "../log";
import { SUBSCRIPTION_EVENTS, type BillingConfig, type PaymentProvider } from "./stripe";
import { applyProviderSubscription } from "./subscriptions";

export {
  BillingError,
  SUBSCRIPTION_EVENTS,
  createStripe,
  readSubscription,
  signPayload,
  verifySignature,
  type BillingConfig,
  type CheckoutRequest,
  type PaymentProvider,
  type PriceView,
  type ProviderSubscription,
  type WebhookEvent,
} from "./stripe";
export {
  PRACTICE_PLAN_LABEL,
  applyProviderSubscription,
  setPersonPlan,
  type AppliedOutcome,
} from "./subscriptions";

/** What the webhook route answers: 200 when handled or ignored, 400 for a bad signature, 503 to be retried. */
export type WebhookResult = { status: 200 | 400 | 503; code: string };

/**
 * One delivery of the payment provider's webhook. The signature is checked
 * against the raw body; for an event about a subscription, its current
 * state is read back from the provider and applied. Logged as codes only.
 */
export async function handlePaymentWebhook(
  input: {
    db: Database;
    provider: PaymentProvider;
    prices: Extract<BillingConfig, { kind: "stripe" }>["prices"];
    log: Logger;
  },
  payload: string,
  signature: string | null,
): Promise<WebhookResult> {
  const { provider, log } = input;
  const event = input.provider.verify(payload, signature);
  if (!event) {
    log.warn("billing.webhook_refused", { code: "signature" });
    return { status: 400, code: "signature" };
  }
  if (!SUBSCRIPTION_EVENTS.has(event.type) || !event.objectId) {
    log.info("billing.webhook", { code: "ignored" });
    return { status: 200, code: "ignored" };
  }
  try {
    const subscription = await provider.subscription(event.objectId);
    const result = await applyProviderSubscription(input.db, subscription, input.prices);
    log.info("billing.webhook", { code: result.outcome, userId: result.userId, status: subscription.status });
    return { status: 200, code: result.outcome };
  } catch (error) {
    log.error("billing.webhook_failed", { error });
    return { status: 503, code: "unavailable" };
  }
}
