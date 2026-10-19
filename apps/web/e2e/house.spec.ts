import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { startFakeStripe, type FakeStripe } from "./fake-stripe";
import { closeCore, core, currentUserId, newEmail, newKey, say, signUp, signUpQuietly } from "./support";

/**
 * F5, end to end, on a server configured as the hosted app runs: a house
 * assistant (the offline rehearsal model stands in for it; its key is set
 * and must never show) and payments against a fake Stripe on this machine.
 * A new person talks and gets a report without opening Settings; their own
 * key waits behind a small door; the month's limit keeps their words; and a
 * subscription, for a person or a practice, flips the plan through the
 * signed webhook.
 */

const HOUSE = process.env.SINTR_E2E_HOUSE_URL!;
const HOUSE_KEY = process.env.SINTR_E2E_HOUSE_KEY!;
test.use({ baseURL: HOUSE });

const SITUATION = "The meeting on Monday, when my manager asked about the deadline in front of everyone.";
const THOUGHTS = "I thought: I am going to let everyone down. Anxiety 80, shame 60.";
const QUESTION = /What went through your mind right then/;
const DRAFTED = /You can confirm it, change anything, or tell me what to fix/;

const sql = postgres(process.env.SINTR_E2E_DATABASE_URL!, { max: 1, onnotice: () => undefined });
let stripe: FakeStripe;

test.beforeAll(async () => {
  stripe = await startFakeStripe({
    url: process.env.SINTR_E2E_STRIPE_URL!,
    app: HOUSE,
    secret: process.env.SINTR_E2E_WEBHOOK_SECRET!,
    key: "sk_test_e2e",
  });
});

test.afterAll(async () => {
  await stripe.close();
  await sql.end();
  await closeCore();
});

/** This month, as the meter keys it for a person in UTC (the default time zone). */
const thisMonth = () => `${new Date().toISOString().slice(0, 7)}-01`;

async function setUsage(userId: string, values: { messages?: number; reports?: number }) {
  await sql`
    insert into usage_counters (user_id, period, assistant_messages, reports)
    values (${userId}, ${thisMonth()}, ${values.messages ?? 0}, ${values.reports ?? 0})
    on conflict (user_id, period) do update
      set assistant_messages = excluded.assistant_messages, reports = excluded.reports`;
}

async function usage(userId: string) {
  const [row] = await sql<{ messages: number; reports: number }[]>`
    select assistant_messages as messages, reports from usage_counters
    where user_id = ${userId} and period = ${thisMonth()}`;
  return row ?? { messages: 0, reports: 0 };
}

/** The pages a person on the house sees: none may carry the house key. */
async function expectNoHouseKey(page: Page) {
  for (const path of ["/talk", "/settings", "/plan", "/reports"]) {
    const html = await (await page.request.get(path)).text();
    expect(html, path).not.toContain(HOUSE_KEY);
    expect(html, path).not.toContain(HOUSE_KEY.slice(-12));
  }
}

test.describe("the house assistant", () => {
  test("a new person talks it through and gets a report, without ever opening Settings", async ({ page }) => {
    await signUp(page, newEmail("house-first"));
    const userId = await currentUserId(page);

    // From the diary straight to Talk: no provider, no key, nothing to set up.
    await page.getByRole("link", { name: "Talk it through" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Tell me what happened." })).toBeVisible();
    await expect(page.getByText("The assistant is included in your plan.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Call CVV, 188" })).toBeVisible();
    await say(page, SITUATION, QUESTION);
    await say(page, THOUGHTS, DRAFTED);
    await page
      .getByRole("article", { name: "Draft entry, waiting for you" })
      .getByRole("button", { name: "Confirm" })
      .click();
    await expect(page.getByRole("article", { name: "Saved entry" })).toBeVisible();

    // The report, written by the assistant from that entry.
    await page.getByRole("link", { name: "Reports", exact: true }).click();
    await page.getByRole("button", { name: "Prepare this week's report" }).click();
    await expect(page).toHaveURL(/\/reports\/[0-9a-f-]{36}$/);
    await expect(page.getByText("I am going to let everyone down").first()).toBeVisible();
    await expect(page.getByText(/sintr prepared what it can on its own/)).toHaveCount(0);

    // The plan counted it, in plain words; nothing asked for a key along the way.
    expect(await usage(userId)).toEqual({ messages: 2, reports: 1 });
    await page.getByRole("link", { name: "Plan", exact: true }).click();
    await expect(page.getByRole("heading", { name: "You are on Free." })).toBeVisible();
    await expect(
      page.getByText("100 messages with the assistant and 4 reports written by it, each month."),
    ).toBeVisible();
    const meters = page.getByRole("definition");
    await expect(meters.nth(0)).toHaveText("2 of 100");
    await expect(meters.nth(1)).toHaveText("1 of 4");
    expect(await (await core().repositories.forUser(userId)).agentSettings.get()).toMatchObject({
      provider: null,
      hasKey: false,
    });

    // Settings says it is included, and keeps the door to a key of one's own closed.
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await expect(
      page.getByText(/The assistant is included\. It runs on a model from Anthropic/),
    ).toBeVisible();
    await expect(page.getByText("Use your own key instead")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save the assistant" })).toBeHidden();
    await expectNoHouseKey(page);
  });

  test("a person's own key waits behind a small door, is never counted, and the way back is one button", async ({
    page,
  }) => {
    await signUpQuietly(page, newEmail("house-byok"));
    const userId = await currentUserId(page);
    await page.goto("/settings");
    await page.getByText("Use your own key instead").click();
    await page.getByRole("button", { name: "OpenRouter" }).click();
    await page.getByLabel("Model", { exact: true }).fill("vendor/model");
    const key = newKey();
    await page.getByLabel("API key", { exact: true }).fill(key);
    await page.getByRole("button", { name: "Save the assistant" }).click();
    await expect(page.getByText(`A key is saved, ending in ${key.slice(-4)}.`)).toBeVisible();
    await page.reload();
    await expect(
      page.getByText(
        /You are using your own key, with openrouter\.ai \(vendor\/model\)\..*does not count toward any plan/,
      ),
    ).toBeVisible();

    // No nagging: the plan page says one line, and offers nothing.
    await page.goto("/plan");
    await expect(page.getByRole("heading", { name: "You use your own key." })).toBeVisible();
    await expect(page.getByText("More of the assistant")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Subscribe/ })).toHaveCount(0);
    await page.goto("/talk");
    await expect(page.getByText("The assistant is included in your plan.")).toHaveCount(0);
    await say(page, SITUATION, QUESTION);
    expect(await usage(userId)).toEqual({ messages: 0, reports: 0 });

    // Back to the included assistant: the key is gone, and the plan counts again.
    await page.goto("/settings");
    await page.getByRole("button", { name: "Go back to the included assistant" }).click();
    await expect(page.getByText(/The assistant is included\./)).toBeVisible();
    const scope = await core().repositories.forUser(userId);
    expect(await scope.agentSettings.credentials()).toBeNull();
    expect((await scope.auditLog.list()).map((e) => e.action)).toContain("agent_key.removed");
  });

  test("warns before the month's limit, and at it keeps the person's words as a draft entry", async ({
    page,
  }) => {
    await signUpQuietly(page, newEmail("house-limit"));
    const userId = await currentUserId(page);
    await setUsage(userId, { messages: 95 });

    await page.goto("/talk");
    await expect(page.getByText(/5 messages with the assistant left this month, until 1\s/)).toBeVisible();
    await say(page, SITUATION, QUESTION);
    await expect(page.getByText(/4 messages with the assistant left this month/)).toBeVisible();

    // The month is used: the assistant waits, the diary does not.
    await setUsage(userId, { messages: 100 });
    await page.goto("/talk");
    await expect(page.getByText("This month's messages with the assistant are used.")).toBeVisible();
    await expect(page.getByRole("link", { name: "See your plan" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Use your own key" })).toBeVisible();
    const box = page.getByLabel("Your message");
    await expect(box).toHaveAttribute("placeholder", "Write what happened");
    await box.fill(SITUATION);
    await box.press("Enter");
    await expect(page.getByText(/so I cannot answer this one\. Your words are kept/)).toBeVisible();
    const card = page.getByRole("article", { name: "Draft entry, waiting for you" });
    await expect(card.getByText(SITUATION)).toBeVisible();
    await card.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("article", { name: "Saved entry" })).toBeVisible();
    const scope = await core().repositories.forUser(userId);
    expect((await scope.entries.list())[0]).toMatchObject({ situation: SITUATION });
    expect(await usage(userId)).toEqual({ messages: 100, reports: 0 });

    // The help lines never depend on a plan.
    const crisis = await page.request.post("/api/chat", {
      data: { trigger: "submit-message", text: "I want to die" },
    });
    expect(await crisis.text()).toContain("188");

    // The report still comes, from the person's own words.
    await setUsage(userId, { messages: 100, reports: 4 });
    await page.goto("/reports");
    await expect(page.getByText(/This month's reports written by the assistant are used/)).toBeVisible();
    await page.getByRole("button", { name: "Prepare this week's report" }).click();
    await expect(page).toHaveURL(/\/reports\/[0-9a-f-]{36}$/);
    await expect(page.getByText(/reports written by the assistant are used on your plan/)).toBeVisible();
    await expect(page.getByText(SITUATION).first()).toBeVisible();
  });
});

test.describe("plans and payments", () => {
  test("a person subscribes on Stripe's page and the signed webhook flips the plan", async ({ page }) => {
    const email = newEmail("house-pay");
    await signUpQuietly(page, email);
    const userId = await currentUserId(page);
    await page.goto("/plan");
    await expect(page.getByRole("heading", { name: "More of the assistant" })).toBeVisible();
    await expect(
      page.getByText(/Personal: 600 messages with the assistant .* It costs R\$19\.90 a month\./),
    ).toBeVisible();
    await page.getByRole("button", { name: "Subscribe to Personal" }).click();
    await expect(page).toHaveURL(/\/checkout\/cs_test_/);

    // Stripe received the account and the plan, and nothing of the diary.
    const checkout = stripe.checkouts.at(-1)!;
    expect(Object.fromEntries(checkout.body)).toMatchObject({
      mode: "subscription",
      "line_items[0][price]": "price_e2epersonal",
      "line_items[0][quantity]": "1",
      customer_email: email,
      client_reference_id: userId,
      "subscription_data[metadata][sintr_user]": userId,
      "subscription_data[metadata][sintr_kind]": "person",
    });

    // A forged event changes nothing; the signed one does.
    const forged = await stripe.deliver("customer.subscription.created", "sub_forged", "whsec_wrong");
    expect(forged.status).toBe(400);
    const { subscriptionId, delivered } = await stripe.complete(checkout);
    expect(delivered.status).toBe(200);
    expect(await delivered.json()).toEqual({ received: true, code: "applied" });

    await page.goto("/plan?subscribed=person");
    await expect(page.getByText(/Thank you\. Your plan changes as soon as Stripe confirms/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "You are on Personal." })).toBeVisible();
    await expect(page.getByText(/Paid through Stripe, renewing on/)).toBeVisible();
    await expect(page.getByText("More of the assistant")).toHaveCount(0);
    await page.goto("/talk");
    await expect(page.getByText("The assistant is included in your plan.")).toBeVisible();

    // Its billing page opens from the plan; a cancellation there brings Free back, the diary untouched.
    await page.goto("/plan");
    await page.getByRole("button", { name: "Manage the subscription" }).click();
    await expect(page).toHaveURL(/\/billing$/);
    expect(stripe.portals.at(-1)?.get("return_url")).toBe(`${process.env.SINTR_E2E_HOUSE_URL}/plan`);
    expect((await stripe.update(subscriptionId, { status: "canceled" })).status).toBe(200);
    await page.goto("/plan");
    await expect(page.getByRole("heading", { name: "You are on Free." })).toBeVisible();
    await expect(page.getByText("Your last subscription has ended.")).toBeVisible();
  });

  test("a practice chooses its seats, pays for them, and its own diary gets the assistant", async ({
    page,
  }) => {
    await signUpQuietly(page, newEmail("house-practice"));
    await page.goto("/practice");
    await page.getByLabel("Your name, as the people you see know it").fill("Dr. Helena Prado");
    await page.getByRole("button", { name: "Open my practice" }).click();
    await expect(page.getByText(/0 of 1 seat in use/)).toBeVisible();

    await page.goto("/plan#practice");
    await expect(page.getByText("Free: 1 seat, 0 in use.", { exact: false })).toBeVisible();
    await expect(
      page.getByText(/The Practice plan: the seats you choose, at R\$49\.00 a month each/),
    ).toBeVisible();
    await page.getByLabel("Seats").fill("6");
    await page.getByRole("button", { name: "Subscribe", exact: true }).click();
    await expect(page).toHaveURL(/\/checkout\/cs_test_/);
    const checkout = stripe.checkouts.at(-1)!;
    expect(checkout.body.get("line_items[0][price]")).toBe("price_e2eseat");
    expect(checkout.body.get("line_items[0][quantity]")).toBe("6");
    const { subscriptionId } = await stripe.complete(checkout);

    await page.goto("/practice");
    await expect(page.getByText(/0 of 6 seats in use/)).toBeVisible();
    await page.goto("/plan");
    await expect(page.getByText(/Practice: 6 seats, 0 in use\./)).toBeVisible();
    await expect(page.getByRole("heading", { name: "You are on Personal." })).toBeVisible();
    await expect(page.getByText("Included with your practice's plan.")).toBeVisible();
    await expect(page.getByText(/Sharing with you never changes them/)).toBeVisible();

    // Seats changed on Stripe's page reach the practice too.
    await stripe.update(subscriptionId, { quantity: 9 });
    await page.goto("/practice");
    await expect(page.getByText(/0 of 9 seats in use/)).toBeVisible();
  });
});
