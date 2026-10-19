import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import {
  closeCore,
  core,
  currentUserId,
  newEmail,
  say,
  setUpAssistant,
  signUp,
  signUpQuietly,
} from "./support";

/**
 * F1, end to end: the production build with the offline rehearsal model.
 * Everything else is real: sign-up, the sealed key, the streamed
 * conversation, drafts, the person's confirmation, the timeline, corrections
 * and the scoping of every new route.
 */

const SITUATION = "The meeting on Monday, when my manager asked about the deadline in front of everyone.";
const THOUGHTS = "I thought: I am going to let everyone down. Anxiety 80, shame 60.";
const QUESTION = /What went through your mind right then/;
const DRAFTED = /You can confirm it, change anything, or tell me what to fix/;

const sql = postgres(process.env.SINTR_E2E_DATABASE_URL!, { max: 1, onnotice: () => undefined });

test.afterAll(async () => {
  await sql.end();
  await closeCore();
});

async function scopeOf(page: Page) {
  return core().repositories.forUser(await currentUserId(page));
}

async function draftAnEntry(page: Page) {
  await page.goto("/talk");
  await say(page, SITUATION, QUESTION);
  await say(page, THOUGHTS, DRAFTED);
  return page.getByRole("article", { name: "Draft entry, waiting for you" });
}

test.describe("bring your own key", () => {
  test("is saved sealed, shown only as a hint, and the connection test runs offline", async ({ page }) => {
    await signUp(page, newEmail("byok"));
    const key = await setUpAssistant(page);
    const userId = await currentUserId(page);

    // Never returned to the browser once saved: not in the page, not in its data.
    await page.reload();
    await expect(page.getByText(`A key is saved, ending in ${key.slice(-4)}.`)).toBeVisible();
    expect(await page.content()).not.toContain(key);
    expect(await (await page.request.get("/settings")).text()).not.toContain(key.slice(0, 16));

    // Ciphertext at rest: an envelope, and no trace of the key in the row's text.
    const [row] = await sql<{ api_key: Buffer; dump: string }[]>`
      select api_key, t::text as dump from agent_settings t where user_id = ${userId}`;
    expect(row!.api_key[0]).toBe(1);
    expect(row!.api_key.includes(Buffer.from(key))).toBe(false);
    expect(row!.dump).not.toContain(key);
    expect(row!.dump).not.toContain(Buffer.from(key).toString("hex"));
    // It opens only with the person's own key, through the core.
    expect(
      (
        await core()
          .repositories.forUser(userId)
          .then((s) => s.agentSettings.credentials())
      )?.apiKey,
    ).toBe(key);
    // Saving a key is an audited event; the event holds no key.
    const audit = await (await core().repositories.forUser(userId)).auditLog.list();
    expect(audit.map((e) => e.action)).toContain("agent_key.saved");
    expect(JSON.stringify(audit)).not.toContain(key);

    await page.getByRole("button", { name: "Test the connection" }).click();
    await expect(page.getByText("The rehearsal assistant answered.")).toBeVisible();
  });

  test("a conversation waits for a provider, but a crisis is answered without one", async ({ page }) => {
    await signUpQuietly(page, newEmail("no-provider"));
    await page.goto("/talk");
    await expect(page.getByText("This sintr has no assistant of its own yet.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Use your own key" })).toHaveAttribute(
      "href",
      "/settings?key=own#own-key",
    );
    // Nothing to choose without a house assistant: no plan in the navigation, and the page says why.
    await expect(page.getByRole("link", { name: "Plan", exact: true })).toHaveCount(0);
    await page.goto("/plan");
    await expect(page.getByRole("heading", { name: "There is no plan to choose here." })).toBeVisible();
    await page.goto("/talk");
    await expect(page.getByRole("link", { name: "Call CVV, 188" })).toBeVisible();

    const plain = await page.request.post("/api/chat", {
      data: { trigger: "submit-message", text: "hello" },
    });
    expect(plain.status()).toBe(409);
    expect(await plain.json()).toEqual({ code: "not_configured" });

    const crisis = await page.request.post("/api/chat", {
      data: { trigger: "submit-message", text: "I want to die" },
    });
    expect(crisis.status()).toBe(200);
    const stream = await crisis.text();
    expect(stream).toContain("188");
    expect(stream).toContain("data-crisis");
  });
});

test.describe("the capture conversation", () => {
  test("drafts an entry in the person's words, saves it only on Confirm, and the timeline can correct it", async ({
    page,
  }) => {
    await signUp(page, newEmail("capture"));
    await setUpAssistant(page);

    await page.goto("/talk");
    await expect(page.getByRole("heading", { level: 1, name: "Tell me what happened." })).toBeVisible();
    // The crisis lines stay where a person might disclose risk.
    await expect(page.getByRole("link", { name: "Call CVV, 188" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Call SAMU, 192" })).toBeVisible();

    await say(page, SITUATION, QUESTION);
    await expect(page).toHaveURL(/\/talk\/[0-9a-f-]{36}$/);
    await say(page, THOUGHTS, DRAFTED);

    const card = page.getByRole("article", { name: "Draft entry, waiting for you" });
    await expect(card.getByText(SITUATION)).toBeVisible();
    await expect(card.getByText("I am going to let everyone down")).toBeVisible();
    await expect(card.getByText("80 of 100")).toBeVisible();
    await expect(card.getByText("Draft, not saved")).toBeVisible();

    // A draft is not a record.
    const scope = await scopeOf(page);
    expect(await scope.entries.count()).toBe(0);

    await card.getByRole("button", { name: "Confirm" }).click();
    const saved = page.getByRole("article", { name: "Saved entry" });
    await expect(saved.getByText("Saved to your entries.")).toBeVisible();
    expect(await scope.entries.count()).toBe(1);
    const [entry] = await scope.entries.list();
    expect(entry).toMatchObject({
      situation: SITUATION,
      thoughts: ["I am going to let everyone down"],
      emotions: [
        { name: "Anxiety", intensity: 80 },
        { name: "shame", intensity: 60 },
      ],
    });

    // The conversation and its decision survive a reload.
    await page.reload();
    await expect(page.getByRole("article", { name: "Saved entry" })).toBeVisible();

    // The timeline lists it and opens it.
    await page.getByRole("link", { name: "Entries", exact: true }).click();
    await expect(page).toHaveURL(/\/entries$/);
    await expect(page.getByRole("main").getByText(SITUATION)).toBeVisible();
    await page.getByRole("link", { name: new RegExp(SITUATION.slice(0, 30)) }).click();
    await expect(page).toHaveURL(new RegExp(`/entries/${entry!.id}$`));
    await expect(page.getByText("I am going to let everyone down")).toBeVisible();

    // Correcting keeps the original and dates the change.
    await page.getByRole("link", { name: "Change this entry" }).click();
    await page.getByLabel("How strong, from 0 to 100").first().fill("70");
    await page.getByLabel("What changed, in your words").fill("Thinking about it again, it was a bit lower.");
    await page.getByRole("button", { name: "Save the change" }).click();
    await expect(page).toHaveURL(new RegExp(`/entries/${entry!.id}$`));
    await expect(page.getByText("70 of 100")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Changes since it was written" })).toBeVisible();
    await expect(page.getByText("Corrected how it felt.")).toBeVisible();
    await expect(page.getByText("Thinking about it again, it was a bit lower.")).toBeVisible();
    await page.getByText("What it said before", { exact: true }).click();
    await expect(page.getByText("Anxiety, 80 of 100; shame, 60 of 100")).toBeVisible();

    const corrections = await scope.entries.corrections(entry!.id);
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toMatchObject({
      fields: ["emotions"],
      previous: {
        emotions: [
          { name: "Anxiety", intensity: 80 },
          { name: "shame", intensity: 60 },
        ],
      },
      note: "Thinking about it again, it was a bit lower.",
    });
    expect((await scope.entries.get(entry!.id))?.emotions?.[0]).toEqual({ name: "Anxiety", intensity: 70 });
  });

  test("lets the person fix a draft before saving it, or discard it and keep nothing", async ({ page }) => {
    await signUpQuietly(page, newEmail("edit-draft"));
    await setUpAssistant(page);
    const scope = await scopeOf(page);

    const card = await draftAnEntry(page);
    await card.getByRole("button", { name: "Edit" }).click();
    await card.getByLabel("In the body").fill("a tight chest");
    await card.getByRole("button", { name: "Save entry" }).click();
    await expect(page.getByText("Saved with your changes.")).toBeVisible();
    expect((await scope.entries.list())[0]).toMatchObject({ body: "a tight chest", situation: SITUATION });

    const second = await draftAnEntry(page);
    await second.getByRole("button", { name: "Discard" }).click();
    await page.getByRole("button", { name: "Discard it" }).click();
    await expect(page.getByText("Nothing from it was saved.")).toBeVisible();
    expect(await scope.entries.count()).toBe(1);
  });

  test('saves a drafted check-in when the person says "salva"', async ({ page }) => {
    await signUpQuietly(page, newEmail("salva"));
    await setUpAssistant(page);
    await page.goto("/talk");
    await say(page, "mood 3, energy 2, slept 6.5", DRAFTED);
    await expect(page.getByRole("article", { name: "Draft check-in, waiting for you" })).toBeVisible();
    const scope = await scopeOf(page);
    expect(await scope.checkins.list()).toEqual([]);

    await say(page, "salva", "Saved. It is in your diary now");
    await expect(
      page.getByRole("article", { name: "Saved check-in" }).getByText("Saved to your check-ins."),
    ).toBeVisible();
    expect(await scope.checkins.list()).toEqual([
      expect.objectContaining({ mood: 3, energy: 2, anxiety: null, sleepHours: 6.5 }),
    ]);
  });

  test("stops the diary and points to human help when the person signals risk", async ({ page }) => {
    await signUpQuietly(page, newEmail("crisis"));
    await setUpAssistant(page);
    await page.goto("/talk");
    await say(page, "não aguento mais viver", "Que bom que você me contou");

    const help = page.getByRole("region", { name: "Human help, now" });
    await expect(help.getByRole("link", { name: /188/ })).toBeVisible();
    await expect(help.getByRole("link", { name: /192/ })).toBeVisible();
    await expect(page.getByText("The diary is paused here.")).toBeVisible();

    // It stays stopped: no draft, whatever comes next.
    await say(
      page,
      "I am a bit better. I thought: I am going to let everyone down. Anxiety 80.",
      "I am still here with you",
    );
    await expect(page.getByRole("article")).toHaveCount(0);
    const conversationId = new URL(page.url()).pathname.split("/").at(-1)!;
    const scope = await scopeOf(page);
    expect(await scope.proposals.list(conversationId)).toEqual([]);
    expect(await scope.entries.count()).toBe(0);
    // A crisis opening is not listed under those words.
    expect((await scope.conversations.get(conversationId))?.title).toBeNull();

    // A new conversation starts fresh when the person is ready, straight
    // from the paused one (whose address the page took over).
    await page.getByRole("link", { name: "Start a new conversation" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Tell me what happened." })).toBeVisible();
    await expect(page.getByRole("region", { name: "Human help, now" })).toHaveCount(0);
    await say(page, SITUATION, QUESTION);

    // The paused conversation stays paused when opened again.
    await page.goto(`/talk/${conversationId}`);
    await expect(page.getByRole("region", { name: "Human help, now" })).toBeVisible();
    await expect(page.getByText("The diary is paused here.")).toBeVisible();
  });
});

test.describe("the quick check-in", () => {
  test("needs no conversation and keeps only what was given", async ({ page }) => {
    await signUpQuietly(page, newEmail("checkin"));
    await page.getByRole("link", { name: "Check-ins", exact: true }).click();
    await page.getByRole("link", { name: "New check-in" }).click();
    await page.getByRole("group", { name: "Mood" }).getByRole("radio", { name: "4", exact: true }).check();
    await page.getByRole("group", { name: "Anxiety" }).getByRole("radio", { name: "2", exact: true }).check();
    await page.getByLabel("Hours of sleep").fill("7,5");
    await page.getByLabel("Note").fill("a quieter day, the walk helped");
    await page.getByRole("button", { name: "Save check-in" }).click();

    await expect(page).toHaveURL(/\/checkins\/[0-9a-f-]{36}$/);
    await expect(page.getByText("a quieter day, the walk helped")).toBeVisible();
    await expect(page.getByText("7.5 hours")).toBeVisible();
    const [checkin] = await (await scopeOf(page)).checkins.list();
    expect(checkin).toMatchObject({ mood: 4, energy: null, anxiety: 2, sleepHours: 7.5 });

    await page.getByRole("link", { name: "All check-ins" }).click();
    await expect(page.getByText("a quieter day, the walk helped")).toBeVisible();

    await page.getByRole("link", { name: /a quieter day/ }).click();
    await page.getByRole("link", { name: "Change this check-in" }).click();
    await page.getByRole("group", { name: "Mood" }).getByRole("radio", { name: "3", exact: true }).check();
    await page.getByRole("button", { name: "Save the change" }).click();
    await expect(page.getByText("Corrected the mood.")).toBeVisible();
  });
});

test.describe("the new routes are scoped to their owner", () => {
  test("another person can open, change and confirm none of it", async ({ page, browser }) => {
    await signUpQuietly(page, newEmail("alice"));
    await setUpAssistant(page);
    await draftAnEntry(page);
    const conversationId = new URL(page.url()).pathname.split("/").at(-1)!;
    const alice = await scopeOf(page);
    const [proposal] = await alice.proposals.list(conversationId);
    const entry = await alice.entries.create({ situation: "alice's own words" });
    const checkin = await alice.checkins.create({ mood: 2, note: "alice's note" });

    const bobContext = await browser.newContext();
    const bob = await bobContext.newPage();
    await signUpQuietly(bob, newEmail("bob"));
    await setUpAssistant(bob);

    for (const path of [
      `/entries/${entry.id}`,
      `/entries/${entry.id}/edit`,
      `/checkins/${checkin.id}`,
      `/checkins/${checkin.id}/edit`,
      `/talk/${conversationId}`,
    ]) {
      const response = await bob.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(bob.getByText("There is nothing on this page.")).toBeVisible();
    }
    const chat = await bob.request.post("/api/chat", {
      data: { trigger: "submit-message", conversationId, text: "hello" },
    });
    expect(chat.status()).toBe(404);
    for (const action of [{ action: "confirm" }, { action: "discard" }]) {
      const decision = await bob.request.post(`/api/proposals/${proposal!.id}`, { data: action });
      expect(decision.status()).toBe(404);
    }
    await bob.goto("/entries");
    await expect(bob.getByText("alice's own words")).toHaveCount(0);
    await bobContext.close();

    // Alice's draft is still hers to decide, and her conversation is untouched.
    expect((await alice.proposals.get(proposal!.id))?.status).toBe("proposed");
    expect(await alice.conversations.messages(conversationId)).toHaveLength(4);
  });

  test("they refuse a signed-out request and another origin", async ({ page, request }) => {
    for (const path of [
      "/talk",
      `/talk/${randomUUID()}`,
      "/settings",
      "/checkins/new",
      `/entries/${randomUUID()}`,
    ]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
      expect(new URL(response.headers().location!, "http://x").pathname, path).toBe("/sign-in");
    }
    expect(
      (await request.post("/api/chat", { data: { trigger: "submit-message", text: "x" } })).status(),
    ).toBe(401);
    expect(
      (await request.post(`/api/proposals/${randomUUID()}`, { data: { action: "confirm" } })).status(),
    ).toBe(401);

    await signUpQuietly(page, newEmail("origin"));
    const foreign = await page.request.post("/api/chat", {
      headers: { origin: "https://elsewhere.example" },
      data: { trigger: "submit-message", text: "x" },
    });
    expect(foreign.status()).toBe(403);
  });
});
