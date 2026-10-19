import { createHmac, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

/**
 * A fake Stripe on this machine, for the house tests: it answers the few
 * API calls sintr makes (Checkout, the billing page, a price, a
 * subscription), serves stand-ins for Stripe's pages, and can complete a
 * checkout the way Stripe does: create the subscription and deliver a
 * signed webhook to the app. Nothing reaches the real Stripe.
 */

export interface Checkout {
  id: string;
  body: URLSearchParams;
}

export interface FakeStripe {
  readonly url: string;
  readonly checkouts: Checkout[];
  readonly portals: URLSearchParams[];
  /** Complete a checkout as Stripe would: the subscription exists, then the webhook is delivered. */
  complete(checkout: Checkout, status?: string): Promise<{ subscriptionId: string; delivered: Response }>;
  /** Change a subscription and tell the app, as Stripe does after a change on its billing page. */
  update(subscriptionId: string, change: { status?: string; quantity?: number }): Promise<Response>;
  /** Deliver an event to the app, signed with `secret` (the right one unless a test says otherwise). */
  deliver(type: string, objectId: string, secret?: string): Promise<Response>;
  close(): Promise<void>;
}

const PRICES: Record<string, unknown> = {
  price_e2epersonal: {
    unit_amount: 1990,
    currency: "brl",
    recurring: { interval: "month", interval_count: 1 },
  },
  price_e2eseat: { unit_amount: 4900, currency: "brl", recurring: { interval: "month", interval_count: 1 } },
};

function sign(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")}`;
}

async function bodyOf(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

function page(response: ServerResponse, title: string) {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><title>${title}</title><h1>${title}</h1>`);
}

export async function startFakeStripe(input: { url: string; app: string; secret: string; key: string }) {
  const checkouts: Checkout[] = [];
  const portals: URLSearchParams[] = [];
  const subscriptions = new Map<string, Record<string, unknown>>();
  const now = Math.floor(Date.now() / 1000);

  const server: Server = createServer((request, response) => {
    void (async () => {
      const path = new URL(request.url ?? "/", input.url).pathname;
      if (path.startsWith("/v1/") && request.headers.authorization !== `Bearer ${input.key}`) {
        return json(response, 401, { error: { message: "bad key" } });
      }
      if (request.method === "POST" && path === "/v1/checkout/sessions") {
        const id = `cs_test_${randomUUID().replaceAll("-", "")}`;
        checkouts.push({ id, body: new URLSearchParams(await bodyOf(request)) });
        return json(response, 200, { id, url: `${input.url}/checkout/${id}` });
      }
      if (request.method === "POST" && path === "/v1/billing_portal/sessions") {
        portals.push(new URLSearchParams(await bodyOf(request)));
        return json(response, 200, { url: `${input.url}/billing` });
      }
      const price = /^\/v1\/prices\/(\w+)$/u.exec(path)?.[1];
      if (request.method === "GET" && price && PRICES[price]) return json(response, 200, PRICES[price]);
      const sub = /^\/v1\/subscriptions\/(\w+)$/u.exec(path)?.[1];
      if (request.method === "GET" && sub && subscriptions.has(sub)) {
        return json(response, 200, subscriptions.get(sub));
      }
      if (request.method === "GET" && path.startsWith("/checkout/"))
        return page(response, "Stripe Checkout (fake)");
      if (request.method === "GET" && path === "/billing") return page(response, "Stripe billing (fake)");
      return json(response, 404, { error: { message: "no such route" } });
    })();
  });
  const port = Number(new URL(input.url).port);
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));

  const deliver = (type: string, objectId: string, secret = input.secret) => {
    const payload = JSON.stringify({
      id: `evt_${randomUUID().replaceAll("-", "")}`,
      object: "event",
      type,
      created: Math.floor(Date.now() / 1000),
      data: { object: { id: objectId, object: "subscription" } },
    });
    return fetch(`${input.app}/api/billing/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": sign(payload, secret) },
      body: payload,
    });
  };

  const fake: FakeStripe = {
    url: input.url,
    checkouts,
    portals,
    async complete(checkout, status = "active") {
      const id = `sub_${randomUUID().replaceAll("-", "")}`;
      const body = checkout.body;
      subscriptions.set(id, {
        id,
        object: "subscription",
        customer: body.get("customer") ?? `cus_${randomUUID().replaceAll("-", "").slice(0, 14)}`,
        status,
        cancel_at_period_end: false,
        metadata: {
          sintr_user: body.get("subscription_data[metadata][sintr_user]"),
          sintr_kind: body.get("subscription_data[metadata][sintr_kind]"),
        },
        items: {
          data: [
            {
              price: { id: body.get("line_items[0][price]") },
              quantity: Number(body.get("line_items[0][quantity]")),
              current_period_start: now,
              current_period_end: now + 30 * 24 * 60 * 60,
            },
          ],
        },
      });
      return { subscriptionId: id, delivered: await deliver("customer.subscription.created", id) };
    },
    async update(subscriptionId, change) {
      const sub = subscriptions.get(subscriptionId)!;
      if (change.status) sub.status = change.status;
      if (change.quantity !== undefined) {
        (sub.items as { data: { quantity: number }[] }).data[0]!.quantity = change.quantity;
      }
      return deliver(
        change.status === "canceled" ? "customer.subscription.deleted" : "customer.subscription.updated",
        subscriptionId,
      );
    },
    deliver,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
  return fake;
}
