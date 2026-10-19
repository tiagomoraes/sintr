import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  applyProviderSubscription,
  createStripe,
  handlePaymentWebhook,
  readSubscription,
  signPayload,
  verifySignature,
  type BillingConfig,
} from "../src/billing";
import { setPersonPlan } from "../src/billing/subscriptions";
import { subscriptions, users } from "../src/db/schema";
import { createLogger } from "../src/log";
import { createRepositories, type UserScope } from "../src/repositories";
import { createUser, openTestDatabase, testMasterKey } from "./support";

/**
 * F5: payments behind configuration. Stripe is reached only through a fake
 * fetch here: nothing leaves this machine. The webhook's signature, the
 * Checkout and billing page requests, and applying a subscription's state
 * to a person's plan and a practice's seats, against a real Postgres.
 */

const handle = openTestDatabase();
const repositories = createRepositories(handle.db, testMasterKey, {
  practiceDefaults: { plan: "Free", seats: 1 },
});
const NOW = new Date("2026-10-19T15:00:00Z");
const config: Extract<BillingConfig, { kind: "stripe" }> = {
  kind: "stripe",
  secretKey: "sk_test_secret123",
  webhookSecret: "whsec_signing456",
  prices: { personal: "price_personal", practiceSeat: "price_seat" },
  apiUrl: "https://stripe.example.test",
};

afterAll(() => handle.close());

interface Recorded {
  method: string;
  url: string;
  auth: string | null;
  body: URLSearchParams;
}

/** A fetch that answers like Stripe would, from a table of paths. No network. */
function fakeStripe(answers: Record<string, (body: URLSearchParams) => { status?: number; json: unknown }>) {
  const requests: Recorded[] = [];
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    const body = new URLSearchParams(await request.text());
    const path = new URL(request.url).pathname;
    requests.push({
      method: request.method,
      url: request.url,
      auth: request.headers.get("authorization"),
      body,
    });
    const answer = answers[`${request.method} ${path}`];
    if (!answer) return new Response(JSON.stringify({ error: { message: "no such path" } }), { status: 404 });
    const { status = 200, json } = answer(body);
    return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
  }) as typeof globalThis.fetch;
  return { fetch, requests };
}

async function account(label: string): Promise<UserScope> {
  const id = await createUser(handle.db, label);
  await repositories.provision(id);
  return repositories.forUser(id);
}

/** A Stripe subscription object, in the shape of the 2025-03-31 API (the period on the item). */
function stripeSubscription(input: {
  id: string;
  userId: string;
  kind: "person" | "practice";
  status?: string;
  price?: string;
  quantity?: number;
  cancelAtPeriodEnd?: boolean;
}) {
  return {
    id: input.id,
    object: "subscription",
    customer: `cus_${input.userId.slice(-8)}`,
    status: input.status ?? "active",
    cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
    metadata: { sintr_user: input.userId, sintr_kind: input.kind },
    items: {
      data: [
        {
          price: { id: input.price ?? (input.kind === "person" ? "price_personal" : "price_seat") },
          quantity: input.quantity ?? 1,
          current_period_start: 1_792_000_000,
          current_period_end: 1_794_600_000,
        },
      ],
    },
  };
}

describe("the webhook's signature", () => {
  const payload = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" });

  it("is accepted when signed with the secret, recently", () => {
    const header = signPayload(payload, config.webhookSecret, NOW);
    expect(verifySignature(payload, header, config.webhookSecret, NOW)).toBe(true);
    // Several v1 signatures (during a secret roll): one matching is enough.
    expect(verifySignature(payload, `${header},v1=${"0".repeat(64)}`, config.webhookSecret, NOW)).toBe(true);
  });

  it("is refused when anything differs", () => {
    const header = signPayload(payload, config.webhookSecret, NOW);
    expect(verifySignature(payload, header, "whsec_other", NOW)).toBe(false);
    expect(verifySignature(`${payload} `, header, config.webhookSecret, NOW)).toBe(false);
    expect(verifySignature(payload, null, config.webhookSecret, NOW)).toBe(false);
    expect(verifySignature(payload, "t=abc,v1=def", config.webhookSecret, NOW)).toBe(false);
    expect(verifySignature(payload, header.replace(/v1=.*/u, ""), config.webhookSecret, NOW)).toBe(false);
    // Older than five minutes, or from the future: a replay.
    const later = new Date(NOW.getTime() + 6 * 60 * 1000);
    expect(verifySignature(payload, header, config.webhookSecret, later)).toBe(false);
    const earlier = new Date(NOW.getTime() - 6 * 60 * 1000);
    expect(verifySignature(payload, header, config.webhookSecret, earlier)).toBe(false);
  });

  it("gates the event: only a signed one is read", () => {
    const stripe = createStripe(config, { fetch: fakeStripe({}).fetch });
    expect(stripe.verify(payload, "t=1,v1=00", NOW)).toBeNull();
    const event = JSON.stringify({
      id: "evt_2",
      type: "customer.subscription.created",
      data: { object: { id: "sub_9" } },
    });
    expect(stripe.verify(event, signPayload(event, config.webhookSecret, NOW), NOW)).toEqual({
      id: "evt_2",
      type: "customer.subscription.created",
      objectId: "sub_9",
    });
    // Signed, but not an event: refused too.
    expect(stripe.verify("[]", signPayload("[]", config.webhookSecret, NOW), NOW)).toBeNull();
  });
});

describe("the calls to Stripe", () => {
  it("opens Checkout for a person's plan with the account, the price and nothing else", async () => {
    const { fetch, requests } = fakeStripe({
      "POST /v1/checkout/sessions": () => ({
        json: { id: "cs_1", url: "https://checkout.stripe.com/c/cs_1" },
      }),
    });
    const stripe = createStripe(config, { fetch });
    expect(stripe.offers).toEqual({ personal: true, practice: true });
    const { url } = await stripe.checkout({
      kind: "person",
      userId: "user-1",
      email: "ana@example.test",
      customerId: null,
      quantity: 7,
      origin: "https://sintr.example",
    });
    expect(url).toBe("https://checkout.stripe.com/c/cs_1");
    const [request] = requests;
    expect(request!.url).toBe("https://stripe.example.test/v1/checkout/sessions");
    expect(request!.auth).toBe("Bearer sk_test_secret123");
    expect(Object.fromEntries(request!.body)).toEqual({
      mode: "subscription",
      "line_items[0][price]": "price_personal",
      // A person's plan is one, whatever is asked.
      "line_items[0][quantity]": "1",
      success_url: "https://sintr.example/plan?subscribed=person",
      cancel_url: "https://sintr.example/plan",
      client_reference_id: "user-1",
      customer_email: "ana@example.test",
      "metadata[sintr_user]": "user-1",
      "metadata[sintr_kind]": "person",
      "subscription_data[metadata][sintr_user]": "user-1",
      "subscription_data[metadata][sintr_kind]": "person",
    });
  });

  it("opens Checkout for practice seats, reusing a known customer", async () => {
    const { fetch, requests } = fakeStripe({
      "POST /v1/checkout/sessions": () => ({ json: { url: "https://checkout.stripe.com/c/cs_2" } }),
    });
    await createStripe(config, { fetch }).checkout({
      kind: "practice",
      userId: "user-2",
      email: "dr@example.test",
      customerId: "cus_known",
      quantity: 12,
      origin: "https://sintr.example",
    });
    const body = Object.fromEntries(requests[0]!.body);
    expect(body).toMatchObject({
      "line_items[0][price]": "price_seat",
      "line_items[0][quantity]": "12",
      customer: "cus_known",
      "subscription_data[metadata][sintr_kind]": "practice",
    });
    expect(body.customer_email).toBeUndefined();
  });

  it("refuses to sell a plan without a price, and reports Stripe's errors as codes", async () => {
    const onlySeats = createStripe(
      { ...config, prices: { personal: null, practiceSeat: "price_seat" } },
      { fetch: fakeStripe({}).fetch },
    );
    expect(onlySeats.offers).toEqual({ personal: false, practice: true });
    const request = {
      kind: "person" as const,
      userId: "u",
      email: "secret-address@example.test",
      customerId: null,
      quantity: 1,
      origin: "https://sintr.example",
    };
    await expect(onlySeats.checkout(request)).rejects.toMatchObject({
      name: "BillingError",
      code: "not_offered",
    });
    const refusing = createStripe(config, {
      fetch: fakeStripe({
        "POST /v1/checkout/sessions": () => ({
          status: 400,
          json: { error: { message: "No such customer: secret-address@example.test" } },
        }),
      }).fetch,
    });
    const error = (await refusing.checkout(request).then(
      () => null,
      (e: unknown) => e,
    )) as Error;
    expect(error).toMatchObject({ name: "BillingError", code: "refused", status: 400 });
    expect(error.message).not.toContain("secret-address");
    const down = createStripe(config, {
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    });
    await expect(down.checkout(request)).rejects.toMatchObject({ code: "unreachable" });
  });

  it("opens the billing page for a customer", async () => {
    const { fetch, requests } = fakeStripe({
      "POST /v1/billing_portal/sessions": () => ({ json: { url: "https://billing.stripe.com/p/session_1" } }),
    });
    expect(await createStripe(config, { fetch }).portal("cus_9", "https://sintr.example")).toEqual({
      url: "https://billing.stripe.com/p/session_1",
    });
    expect(Object.fromEntries(requests[0]!.body)).toEqual({
      customer: "cus_9",
      return_url: "https://sintr.example/plan",
    });
  });

  it("reads a price once an hour, and says nothing when it cannot", async () => {
    let clock = NOW.getTime();
    const { fetch, requests } = fakeStripe({
      "GET /v1/prices/price_personal": () => ({
        json: { unit_amount: 1990, currency: "brl", recurring: { interval: "month", interval_count: 1 } },
      }),
    });
    const stripe = createStripe(config, { fetch, now: () => new Date(clock) });
    const price = { amount: 1990, currency: "brl", interval: "month", intervalCount: 1 };
    expect(await stripe.price("person")).toEqual(price);
    expect(await stripe.price("person")).toEqual(price);
    expect(requests).toHaveLength(1);
    clock += 61 * 60 * 1000;
    await stripe.price("person");
    expect(requests).toHaveLength(2);
    // The seat price is not in the fake: no price, no failure.
    expect(await stripe.price("practice")).toBeNull();
  });

  it("reads a subscription in either shape of Stripe's API", () => {
    const modern = readSubscription(
      stripeSubscription({ id: "sub_1", userId: "u1", kind: "practice", quantity: 4 }),
    );
    expect(modern).toMatchObject({
      id: "sub_1",
      userId: "u1",
      kind: "practice",
      status: "active",
      priceId: "price_seat",
      quantity: 4,
      currentPeriodEnd: new Date(1_794_600_000 * 1000),
    });
    const older = readSubscription({
      ...stripeSubscription({ id: "sub_2", userId: "u2", kind: "person" }),
      customer: { id: "cus_obj" },
      current_period_start: 1_700_000_000,
      current_period_end: 1_702_600_000,
      items: { data: [{ price: { id: "price_personal" }, quantity: 1 }] },
    });
    expect(older).toMatchObject({ customerId: "cus_obj", currentPeriodEnd: new Date(1_702_600_000 * 1000) });
    // A status sintr does not know reads as ended; metadata from elsewhere reads as not sintr's.
    expect(
      readSubscription({
        ...stripeSubscription({ id: "s", userId: "u", kind: "person" }),
        status: "new_kind",
      }).status,
    ).toBe("canceled");
    expect(
      readSubscription({ ...stripeSubscription({ id: "s", userId: "u", kind: "person" }), metadata: {} }),
    ).toMatchObject({
      userId: null,
      kind: null,
    });
    expect(() => readSubscription({ id: 3 })).toThrow(/invalid/);
  });
});

describe("applying a subscription", () => {
  it("gives a person Personal while it is paid, and takes it back when it ends", async () => {
    const ana = await account("pay-ana");
    const sub = (status: string, cancelAtPeriodEnd = false) =>
      readSubscription(
        stripeSubscription({
          id: `sub_${ana.userId}`,
          userId: ana.userId,
          kind: "person",
          status,
          cancelAtPeriodEnd,
        }),
      );
    expect(await applyProviderSubscription(handle.db, sub("incomplete"), config.prices)).toMatchObject({
      outcome: "applied",
    });
    expect((await ana.plans.current(NOW)).plan.id).toBe("free");
    expect(await applyProviderSubscription(handle.db, sub("active"), config.prices)).toMatchObject({
      outcome: "applied",
      userId: ana.userId,
      kind: "person",
    });
    expect(await ana.plans.current(NOW)).toMatchObject({
      plan: { id: "personal", source: "subscription" },
      subscription: {
        status: "active",
        source: "stripe",
        hasCustomer: true,
        currentPeriodEnd: new Date(1_794_600_000 * 1000),
      },
    });
    // The same state again: nothing to do (a webhook delivered twice).
    expect((await applyProviderSubscription(handle.db, sub("active"), config.prices)).outcome).toBe(
      "unchanged",
    );
    await applyProviderSubscription(handle.db, sub("active", true), config.prices);
    expect((await ana.plans.current(NOW)).subscription?.cancelAtPeriodEnd).toBe(true);
    await applyProviderSubscription(handle.db, sub("canceled"), config.prices);
    expect((await ana.plans.current(NOW)).plan.id).toBe("free");
    expect(await ana.plans.customer()).toBe(`cus_${ana.userId.slice(-8)}`);
    const audit = (await ana.auditLog.list()).filter((e) => e.action === "plan.changed");
    expect(audit).toHaveLength(4);
    expect(audit.every((e) => e.metadata.source === "stripe")).toBe(true);
  });

  it("sets a practice's seats through the same path as the admin, and lowers them back when it ends", async () => {
    const pro = await account("pay-practice");
    await pro.practice.open({ professionalName: "Dr. Pay" });
    expect(await pro.practice.seats()).toMatchObject({ plan: "Free", seats: 1 });
    const sub = (status: string, quantity: number) =>
      readSubscription(
        stripeSubscription({
          id: `sub_p_${pro.userId}`,
          userId: pro.userId,
          kind: "practice",
          status,
          quantity,
        }),
      );
    await applyProviderSubscription(handle.db, sub("active", 8), config.prices);
    expect(await pro.practice.get()).toMatchObject({
      seatSource: "subscription",
      plan: "Practice",
      seats: 8,
    });
    expect(await pro.practice.seats()).toMatchObject({ seats: 8, free: 8 });
    // The professional's own diary gets Personal with the practice's plan.
    expect((await pro.plans.current(NOW)).plan).toMatchObject({ id: "personal", source: "practice" });
    await applyProviderSubscription(handle.db, sub("active", 10), config.prices);
    expect((await pro.practice.get())?.seats).toBe(10);
    // A payment being retried keeps the seats; a cancelled subscription returns to the defaults.
    await applyProviderSubscription(handle.db, sub("past_due", 10), config.prices);
    expect((await pro.practice.get())?.seatSource).toBe("subscription");
    await applyProviderSubscription(handle.db, sub("canceled", 10), config.prices);
    expect(await pro.practice.get()).toMatchObject({ seatSource: "config", plan: "Free", seats: 1 });
    expect((await pro.plans.current(NOW)).plan.id).toBe("free");
    const actions = (await pro.auditLog.list()).map((e) => e.action);
    expect(actions.filter((a) => a === "practice.plan_changed")).toHaveLength(3);
  });

  it("ignores what it was not made for, and keeps an active subscription over a second one", async () => {
    const bia = await account("pay-bia");
    const base = { userId: bia.userId, kind: "person" as const };
    expect(
      (
        await applyProviderSubscription(
          handle.db,
          readSubscription({ ...stripeSubscription({ id: "sub_x", ...base }), metadata: {} }),
          config.prices,
        )
      ).outcome,
    ).toBe("unrelated");
    expect(
      (
        await applyProviderSubscription(
          handle.db,
          readSubscription(stripeSubscription({ id: "sub_y", ...base, price: "price_other" })),
          config.prices,
        )
      ).outcome,
    ).toBe("unknown_price");
    expect(
      (
        await applyProviderSubscription(
          handle.db,
          readSubscription(stripeSubscription({ id: "sub_z", userId: "no-such-account", kind: "person" })),
          config.prices,
        )
      ).outcome,
    ).toBe("unknown_account");
    const first = readSubscription(stripeSubscription({ id: `sub_first_${bia.userId}`, ...base }));
    const second = readSubscription(stripeSubscription({ id: `sub_second_${bia.userId}`, ...base }));
    expect((await applyProviderSubscription(handle.db, first, config.prices)).outcome).toBe("applied");
    expect((await applyProviderSubscription(handle.db, second, config.prices)).outcome).toBe("duplicate");
    const [row] = await handle.db.select().from(subscriptions).where(eq(subscriptions.userId, bia.userId));
    expect(row!.providerSubscriptionId).toBe(first.id);
  });
});

describe("following a subscription over time", () => {
  it("keeps following a subscription after its price stops being sold, so a cancellation still lands", async () => {
    const dora = await account("pay-dora");
    const active = readSubscription(
      stripeSubscription({ id: `sub_old_${dora.userId}`, userId: dora.userId, kind: "person" }),
    );
    await applyProviderSubscription(handle.db, active, config.prices);
    expect((await dora.plans.current(NOW)).plan.id).toBe("personal");
    // The operator raised the price: Personal is now another price id.
    const raised = { ...config.prices, personal: "price_personal_2027" };
    const cancelled = { ...active, status: "canceled" as const };
    expect((await applyProviderSubscription(handle.db, cancelled, raised)).outcome).toBe("applied");
    expect((await dora.plans.current(NOW)).plan.id).toBe("free");
    // A new subscription on the old price is still not one this installation sells.
    const other = readSubscription(
      stripeSubscription({ id: `sub_new_${dora.userId}`, userId: dora.userId, kind: "person" }),
    );
    expect((await applyProviderSubscription(handle.db, other, raised)).outcome).toBe("unknown_price");
  });

  it("keeps an active grant against a subscription that was never paid, and lets a paid one replace it", async () => {
    const enzo = await account("pay-grant");
    const [row] = await handle.db.select({ email: users.email }).from(users).where(eq(users.id, enzo.userId));
    await setPersonPlan(handle.db, { email: row!.email, plan: "unlimited" });
    const sub = (status: string) =>
      readSubscription(
        stripeSubscription({ id: `sub_g_${enzo.userId}`, userId: enzo.userId, kind: "person", status }),
      );
    expect((await applyProviderSubscription(handle.db, sub("incomplete"), config.prices)).outcome).toBe(
      "duplicate",
    );
    expect((await enzo.plans.current(NOW)).plan).toMatchObject({ id: "unlimited", source: "grant" });
    expect((await applyProviderSubscription(handle.db, sub("active"), config.prices)).outcome).toBe(
      "applied",
    );
    expect((await enzo.plans.current(NOW)).plan).toMatchObject({ id: "personal", source: "subscription" });
  });
});

describe("the webhook, end to end inside the core", () => {
  it("applies overlapping deliveries one at a time, so a slow stale read cannot win", async () => {
    const fia = await account("hook-race");
    const id = `sub_race_${fia.userId}`;
    let reads = 0;
    const fetch = (async () => {
      reads += 1;
      // The first read sees the subscription before payment and answers slowly; the second sees it paid.
      const status = reads === 1 ? "incomplete" : "active";
      if (reads === 1) await new Promise((resolve) => setTimeout(resolve, 300));
      return Response.json(stripeSubscription({ id, userId: fia.userId, kind: "person", status }));
    }) as typeof globalThis.fetch;
    const provider = createStripe(config, { fetch });
    const quiet = createLogger({ level: "error", write: () => undefined });
    const deliver = (type: string) => {
      const payload = JSON.stringify({ id: `evt_${type}`, type, data: { object: { id } } });
      return handlePaymentWebhook(
        { db: handle.db, provider, prices: config.prices, log: quiet },
        payload,
        signPayload(payload, config.webhookSecret),
      );
    };
    const first = deliver("customer.subscription.created");
    await new Promise((resolve) => setTimeout(resolve, 50));
    await Promise.all([first, deliver("customer.subscription.updated")]);
    expect((await fia.plans.current(NOW)).plan.id).toBe("personal");
  });

  const log = createLogger({ level: "error", write: () => undefined });

  it("verifies, reads the subscription back from Stripe, and flips the plan", async () => {
    const cris = await account("hook-cris");
    let status = "active";
    const { fetch, requests } = fakeStripe({
      [`GET /v1/subscriptions/sub_hook_${cris.userId}`]: () => ({
        json: stripeSubscription({
          id: `sub_hook_${cris.userId}`,
          userId: cris.userId,
          kind: "person",
          status,
        }),
      }),
    });
    const provider = createStripe(config, { fetch });
    const deliver = (type: string, id: string, signature?: string) => {
      const payload = JSON.stringify({ id: `evt_${type}`, type, data: { object: { id } } });
      return handlePaymentWebhook(
        { db: handle.db, provider, prices: config.prices, log },
        payload,
        signature ?? signPayload(payload, config.webhookSecret),
      );
    };
    expect(await deliver("customer.subscription.created", `sub_hook_${cris.userId}`, "t=1,v1=00")).toEqual({
      status: 400,
      code: "signature",
    });
    expect(requests).toHaveLength(0);
    expect(await deliver("invoice.paid", "in_1")).toEqual({ status: 200, code: "ignored" });
    expect(await deliver("customer.subscription.created", `sub_hook_${cris.userId}`)).toEqual({
      status: 200,
      code: "applied",
    });
    expect((await cris.plans.current(NOW)).plan.id).toBe("personal");
    // The event's own copy is never trusted: what Stripe says now is applied.
    status = "canceled";
    expect(await deliver("customer.subscription.updated", `sub_hook_${cris.userId}`)).toEqual({
      status: 200,
      code: "applied",
    });
    expect((await cris.plans.current(NOW)).plan.id).toBe("free");
    // When Stripe cannot say: 503, so Stripe delivers the event again later.
    expect(await deliver("customer.subscription.updated", "sub_missing")).toEqual({
      status: 503,
      code: "unavailable",
    });
  });
});
