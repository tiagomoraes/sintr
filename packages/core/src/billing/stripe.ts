/**
 * The payment provider: Stripe, over its HTTP API, behind configuration.
 *
 * sintr never sees a card. A person subscribes on Stripe's own Checkout
 * page and manages the subscription on Stripe's billing page; sintr only
 * learns the result from the webhook, whose signature is checked, and then
 * asks Stripe for the subscription's current state (so the order in which
 * events arrive does not matter). What Stripe receives from sintr: the
 * account's id and email, the plan and the number of seats. Never a word of
 * the diary.
 *
 * Off by default: without SINTR_STRIPE_* nothing here runs and nothing
 * reaches the network.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { SubscriptionStatus, type SubscriptionKind } from "../domain";

export type BillingConfig =
  | { kind: "off" }
  | {
      kind: "stripe";
      secretKey: string;
      webhookSecret: string;
      /** The recurring prices sold: a person's plan, and one practice seat. */
      prices: { personal: string | null; practiceSeat: string | null };
      /** The API's address; another one in tests only. */
      apiUrl: string;
    };

export class BillingError extends Error {
  override readonly name = "BillingError";
  /** `refused`: Stripe answered with an error; `unreachable`: no answer; `invalid`: an answer sintr cannot read. */
  readonly code: "refused" | "unreachable" | "invalid" | "not_offered";
  readonly status: number | null;
  constructor(code: BillingError["code"], status: number | null = null) {
    super(`payment provider: ${code}`);
    this.code = code;
    this.status = status;
  }
}

export interface CheckoutRequest {
  kind: SubscriptionKind;
  userId: string;
  /** For the receipt. Only when the account is not a customer yet. */
  email: string;
  /** The account's customer at Stripe, from an earlier subscription. */
  customerId: string | null;
  /** 1 for a person; a practice's seats. */
  quantity: number;
  /** Where Stripe sends the person back. */
  origin: string;
}

export interface PriceView {
  /** In the currency's smallest unit. */
  amount: number;
  currency: string;
  interval: "day" | "week" | "month" | "year";
  intervalCount: number;
}

/** A subscription as sintr keeps it, read from Stripe. */
export interface ProviderSubscription {
  id: string;
  customerId: string;
  userId: string | null;
  kind: SubscriptionKind | null;
  status: SubscriptionStatus;
  priceId: string | null;
  quantity: number;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface WebhookEvent {
  id: string;
  type: string;
  /** The id of the object the event is about. */
  objectId: string | null;
}

export interface PaymentProvider {
  readonly name: "stripe";
  /** What can be bought here. */
  readonly offers: { personal: boolean; practice: boolean };
  /** A Stripe Checkout page for this plan; the person pays there, never here. */
  checkout(request: CheckoutRequest): Promise<{ url: string }>;
  /** Stripe's billing page, to change seats, the card, or cancel. */
  portal(customerId: string, origin: string): Promise<{ url: string }>;
  /** The price of a plan, to say it before anyone leaves for Checkout. Null when it cannot be read. */
  price(kind: SubscriptionKind): Promise<PriceView | null>;
  /** The subscription's current state. */
  subscription(id: string): Promise<ProviderSubscription>;
  /** The event, when its signature is right and recent; null otherwise. */
  verify(payload: string, signature: string | null, now?: Date): WebhookEvent | null;
}

/** The events that can change a plan. Everything else is acknowledged and ignored. */
export const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

/** How old a signed event may be, as Stripe's own libraries allow. */
const TOLERANCE_SECONDS = 300;
const PRICE_CACHE_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 15_000;

/** Check `Stripe-Signature: t=...,v1=...` against the raw body, in constant time. */
export function verifySignature(
  payload: string,
  header: string | null,
  secret: string,
  now: Date = new Date(),
): boolean {
  if (!header) return false;
  const pairs = header.split(",").map((part) => {
    const at = part.indexOf("=");
    return at < 0 ? ["", ""] : [part.slice(0, at).trim(), part.slice(at + 1).trim()];
  });
  const timestamp = Number(pairs.find(([key]) => key === "t")?.[1]);
  const signatures = pairs.filter(([key]) => key === "v1").map(([, value]) => value!);
  if (!Number.isInteger(timestamp) || signatures.length === 0) return false;
  if (Math.abs(now.getTime() / 1000 - timestamp) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest();
  return signatures.some((signature) => {
    if (!/^[0-9a-f]{64}$/u.test(signature)) return false;
    return timingSafeEqual(expected, Buffer.from(signature, "hex"));
  });
}

/** Sign a payload the way Stripe does. For tests, and for the test suite's fake Stripe. */
export function signPayload(payload: string, secret: string, at: Date = new Date()): string {
  const timestamp = Math.floor(at.getTime() / 1000);
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

const Unix = z.number().int().nonnegative();
const SubscriptionObject = z.object({
  id: z.string().min(1),
  customer: z.union([z.string(), z.object({ id: z.string() })]),
  status: z.string(),
  cancel_at_period_end: z.boolean().optional(),
  current_period_start: Unix.optional(),
  current_period_end: Unix.optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  items: z.object({
    data: z.array(
      z.object({
        price: z.object({ id: z.string() }).optional(),
        quantity: z.number().int().optional(),
        // Since Stripe's 2025-03-31 API version, the period lives on the item.
        current_period_start: Unix.optional(),
        current_period_end: Unix.optional(),
      }),
    ),
  }),
});

const EventObject = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.object({ object: z.object({ id: z.string().optional() }).loose() }),
});

const PriceObject = z.object({
  unit_amount: z.number().int().nullable(),
  currency: z.string(),
  recurring: z
    .object({ interval: z.enum(["day", "week", "month", "year"]), interval_count: z.number().int() })
    .nullable(),
});

function date(seconds: number | undefined): Date | null {
  return seconds === undefined ? null : new Date(seconds * 1000);
}

/** Stripe's subscription as sintr keeps it. Unknown statuses are read as ended. */
export function readSubscription(value: unknown): ProviderSubscription {
  const parsed = SubscriptionObject.safeParse(value);
  if (!parsed.success) throw new BillingError("invalid");
  const sub = parsed.data;
  const item = sub.items.data[0];
  const status = SubscriptionStatus.safeParse(sub.status);
  const kind = sub.metadata?.sintr_kind;
  return {
    id: sub.id,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    userId: sub.metadata?.sintr_user ?? null,
    kind: kind === "person" || kind === "practice" ? kind : null,
    status: status.success ? status.data : "canceled",
    priceId: item?.price?.id ?? null,
    quantity: item?.quantity ?? 1,
    currentPeriodStart: date(item?.current_period_start ?? sub.current_period_start),
    currentPeriodEnd: date(item?.current_period_end ?? sub.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
  };
}

/** Stripe takes form-encoded bodies, with brackets for nested keys. */
function form(fields: Record<string, string | number | null | undefined>): string {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null && value !== undefined) body.set(key, String(value));
  }
  return body.toString();
}

export function createStripe(
  config: Extract<BillingConfig, { kind: "stripe" }>,
  options: { fetch?: typeof fetch; now?: () => Date } = {},
): PaymentProvider {
  const send = options.fetch ?? globalThis.fetch;
  const now = options.now ?? (() => new Date());
  const prices = new Map<string, { at: number; view: PriceView | null }>();

  async function call(method: "GET" | "POST", path: string, body?: string): Promise<unknown> {
    let response: Response;
    try {
      response = await send(`${config.apiUrl}/v1/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
          ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        ...(body ? { body } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new BillingError("unreachable");
    }
    // Stripe's error text can repeat what was sent (an email); only the status is kept.
    if (!response.ok) throw new BillingError("refused", response.status);
    try {
      return await response.json();
    } catch {
      throw new BillingError("invalid", response.status);
    }
  }

  const priceOf = (kind: SubscriptionKind) =>
    kind === "person" ? config.prices.personal : config.prices.practiceSeat;

  return {
    name: "stripe",
    offers: { personal: config.prices.personal !== null, practice: config.prices.practiceSeat !== null },

    async checkout(request) {
      const price = priceOf(request.kind);
      if (!price) throw new BillingError("not_offered");
      const quantity = request.kind === "person" ? 1 : request.quantity;
      const result = await call(
        "POST",
        "checkout/sessions",
        form({
          mode: "subscription",
          "line_items[0][price]": price,
          "line_items[0][quantity]": quantity,
          success_url: `${request.origin}/plan?subscribed=${request.kind}`,
          cancel_url: `${request.origin}/plan`,
          client_reference_id: request.userId,
          ...(request.customerId ? { customer: request.customerId } : { customer_email: request.email }),
          "metadata[sintr_user]": request.userId,
          "metadata[sintr_kind]": request.kind,
          "subscription_data[metadata][sintr_user]": request.userId,
          "subscription_data[metadata][sintr_kind]": request.kind,
        }),
      );
      const url = (result as { url?: unknown } | null)?.url;
      if (typeof url !== "string" || !/^https?:\/\//u.test(url)) throw new BillingError("invalid");
      return { url };
    },

    async portal(customerId, origin) {
      const result = await call(
        "POST",
        "billing_portal/sessions",
        form({ customer: customerId, return_url: `${origin}/plan` }),
      );
      const url = (result as { url?: unknown } | null)?.url;
      if (typeof url !== "string" || !/^https?:\/\//u.test(url)) throw new BillingError("invalid");
      return { url };
    },

    async price(kind) {
      const id = priceOf(kind);
      if (!id) return null;
      const cached = prices.get(id);
      if (cached && now().getTime() - cached.at < PRICE_CACHE_MS) return cached.view;
      let view: PriceView | null = null;
      try {
        const parsed = PriceObject.safeParse(await call("GET", `prices/${encodeURIComponent(id)}`));
        if (parsed.success && parsed.data.unit_amount !== null && parsed.data.recurring) {
          view = {
            amount: parsed.data.unit_amount,
            currency: parsed.data.currency,
            interval: parsed.data.recurring.interval,
            intervalCount: parsed.data.recurring.interval_count,
          };
        }
      } catch {
        view = null;
      }
      prices.set(id, { at: now().getTime(), view });
      return view;
    },

    async subscription(id) {
      return readSubscription(await call("GET", `subscriptions/${encodeURIComponent(id)}`));
    },

    verify(payload, signature, at = now()) {
      if (!verifySignature(payload, signature, config.webhookSecret, at)) return null;
      let parsed: z.infer<typeof EventObject>;
      try {
        parsed = EventObject.parse(JSON.parse(payload));
      } catch {
        return null;
      }
      return { id: parsed.id, type: parsed.type, objectId: parsed.data.object.id ?? null };
    },
  };
}
