import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { startFakeStripe, type FakeStripe } from "./fake-stripe";
import {
  ASSISTANT,
  closeCore,
  core,
  currentUserId,
  newEmail,
  newKey,
  say,
  setUpAssistant,
  signUpQuietly,
} from "./support";

/**
 * F6, end to end: the home is the input. Written words become a draft as
 * they did in Talk; spoken words go through the offline rehearsal
 * transcriber (Chromium's fake microphone plays a tone), land in the box
 * for the person to read, and become nothing until they send them. The pool
 * of light says what is happening. The house counts the seconds it writes
 * down; a provider that takes no audio gets one line instead of a button.
 */

const HOUSE = process.env.SINTR_E2E_HOUSE_URL!;
const VOICE_KEY = process.env.SINTR_E2E_HOUSE_VOICE_KEY!;
const HEARD = "The meeting on Monday, when my manager asked about the deadline in front of everyone.";
const THOUGHTS = "I thought: I am going to let everyone down. Anxiety 80, shame 60.";
const QUESTION = /What went through your mind right then/;
const DRAFTED = /You can confirm it, change anything, or tell me what to fix/;

const sql = postgres(process.env.SINTR_E2E_DATABASE_URL!, { max: 1, onnotice: () => undefined });

test.use({ permissions: ["microphone"] });

test.afterAll(async () => {
  await sql.end();
  await closeCore();
});

/** The pool of light's state on the page (the first one: the home's, or the composer's once talking). */
const mood = (page: Page) => page.locator(".sintr-pool").first();

/** Speak for a moment and finish; `says` is a line expected on screen while listening. */
async function speak(page: Page, says?: string): Promise<void> {
  await page.getByRole("button", { name: "Speak instead of typing" }).click();
  const listening = page.getByRole("group", { name: "Listening" });
  await expect(listening).toBeVisible();
  await expect(mood(page)).toHaveAttribute("data-mood", "listening");
  // Long enough to be a sentence, not a tap.
  await expect(listening.getByText("0:01")).toBeVisible();
  if (says) await expect(page.getByText(says, { exact: false })).toBeVisible();
  await listening.getByRole("button", { name: "Done" }).click();
}

test.describe("the home, by writing", () => {
  test("drafts an entry from what the person writes, and the pool follows along", async ({ page }) => {
    await signUpQuietly(page, newEmail("home-text"));
    await setUpAssistant(page);
    await page.goto("/home");
    await expect(page.getByRole("heading", { level: 1, name: "Tell me what happened." })).toBeVisible();
    await expect(mood(page)).toHaveAttribute("data-mood", "resting");
    // Everything else is a sentence away.
    await expect(page.getByRole("link", { name: "a quick check-in" })).toHaveAttribute(
      "href",
      "/checkins/new",
    );

    await say(page, "The meeting on Monday went badly.", QUESTION);
    // The conversation keeps its own address, and the pool comes down beside the box.
    await expect(page).toHaveURL(/\/talk\/[0-9a-f-]{36}$/);
    await say(page, THOUGHTS, DRAFTED);
    await expect(mood(page)).toHaveAttribute("data-mood", "proposing");
    // Said beside the pool, and to screen readers.
    await expect(page.getByText("A draft is waiting for you").first()).toBeVisible();
    await page
      .getByRole("article", { name: "Draft entry, waiting for you" })
      .getByRole("button", { name: "Confirm" })
      .click();
    await expect(page.getByRole("article", { name: "Saved entry" })).toBeVisible(ASSISTANT);
    await expect(mood(page)).toHaveAttribute("data-mood", "resting");
    const [entry] = await (await core().repositories.forUser(await currentUserId(page))).entries.list();
    expect(entry).toMatchObject({ situation: "The meeting on Monday went badly." });

    // Talk is the home now: an old address still arrives at a new conversation.
    await page.goto("/talk");
    await expect(page).toHaveURL(/\/home$/);
  });

  test("goes still when the diary stops for help", async ({ page }) => {
    await signUpQuietly(page, newEmail("home-crisis"));
    await setUpAssistant(page);
    await page.goto("/home");
    await say(page, "I want to die", /CVV on 188/);
    await expect(page.getByRole("region", { name: "Human help, now" })).toBeVisible();
    await expect(mood(page)).toHaveAttribute("data-mood", "paused");
    // A paused diary offers no microphone.
    await expect(page.getByRole("button", { name: "Speak instead of typing" })).toHaveCount(0);
  });
});

test.describe("the home, by voice", () => {
  test("writes down what was said, hands it back to read, and keeps nothing until it is sent", async ({
    page,
  }) => {
    await signUpQuietly(page, newEmail("home-voice"));
    // The person's own OpenRouter key: OpenRouter writes it down, with their key (the rehearsal stands in).
    await setUpAssistant(page);
    const scope = await core().repositories.forUser(await currentUserId(page));
    await page.goto("/home");

    const sent: (string | null)[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/voice")
        sent.push(request.headers()["content-type"] ?? null);
    });
    // While it listens, it says who will write it down.
    await speak(page, "What you say is written down by OpenRouter");
    await expect(page.getByText("Here is what I heard. Change anything, then send it.")).toBeVisible(
      ASSISTANT,
    );
    const box = page.getByLabel("Your message");
    await expect(box).toHaveValue(HEARD);
    await expect(mood(page)).toHaveAttribute("data-mood", "resting");
    // One recording went up, as audio (the rehearsal transcriber refuses anything too small to be one),
    // and nothing came of it yet: no conversation, no message, no draft.
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatch(/^audio\/(webm|ogg|mp4)/);
    expect(await scope.conversations.list()).toEqual([]);

    // The person reads it, changes a word, and sends it: from here it is a conversation like any other.
    await box.fill(HEARD.replace("Monday", "Monday morning"));
    await box.press("Enter");
    await expect(page.getByRole("log").getByText(QUESTION).last()).toBeVisible(ASSISTANT);
    await say(page, THOUGHTS, DRAFTED);
    await page
      .getByRole("article", { name: "Draft entry, waiting for you" })
      .getByRole("button", { name: "Confirm" })
      .click();
    await expect(page.getByRole("article", { name: "Saved entry" })).toBeVisible(ASSISTANT);
    const [entry] = await scope.entries.list();
    expect(entry?.situation).toBe(HEARD.replace("Monday", "Monday morning"));
  });

  test("cancelled, keeps nothing; and a provider that takes no audio gets a line, not a button", async ({
    page,
  }) => {
    await signUpQuietly(page, newEmail("home-no-audio"));
    await setUpAssistant(page);
    // A microphone that takes a moment to open, as when the browser is still asking the person.
    await page.addInitScript(() => {
      const devices = navigator.mediaDevices;
      const open = devices.getUserMedia.bind(devices);
      const opened: MediaStream[] = [];
      (window as unknown as { opened: MediaStream[] }).opened = opened;
      devices.getUserMedia = async (constraints) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const stream = await open(constraints);
        opened.push(stream);
        return stream;
      };
    });
    const sent: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/voice") sent.push(request.url());
    });
    await page.goto("/home");

    // Cancelled while listening: nothing kept.
    await page.getByRole("button", { name: "Speak instead of typing" }).click();
    await expect(page.getByRole("group", { name: "Listening" }).getByText("Listening")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByLabel("Your message")).toHaveValue("");

    // Cancelled before the microphone even opened: when it opens it is closed at once, and nothing records.
    await page.getByRole("button", { name: "Speak instead of typing" }).click();
    await expect(page.getByRole("group", { name: "Listening" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByLabel("Your message")).toBeVisible();
    await page.waitForTimeout(2500);
    const tracks = await page.evaluate(() =>
      (window as unknown as { opened: MediaStream[] }).opened.flatMap((stream) =>
        stream.getTracks().map((track) => track.readyState),
      ),
    );
    expect(tracks).toEqual(["ended", "ended"]);
    expect(sent).toEqual([]);
    await expect(page.getByRole("group", { name: "Listening" })).toHaveCount(0);
    await expect(page.getByText("Here is what I heard.", { exact: false })).toHaveCount(0);

    // Anthropic takes no audio: the box, and one clear line.
    await page.goto("/settings");
    await page.getByRole("radio", { name: "Anthropic" }).check();
    await page.getByLabel("Model", { exact: true }).fill("claude-sonnet-5-5");
    await page.getByLabel("API key", { exact: true }).fill(newKey());
    await page.getByRole("button", { name: "Save the assistant" }).click();
    await expect(page.getByText(/A key is saved/)).toBeVisible();
    await page.goto("/home");
    await expect(page.getByLabel("Your message")).toBeVisible();
    await expect(page.getByRole("button", { name: "Speak instead of typing" })).toHaveCount(0);
    await expect(
      page.getByText("Anthropic does not take audio, so here you write.", { exact: false }),
    ).toBeVisible();
    // Asked anyway, the server says the same.
    const refused = await page.request.post("/api/voice?seconds=3", {
      headers: { "content-type": "audio/webm" },
      data: Buffer.alloc(2048, 1),
    });
    expect(refused.status()).toBe(409);
    expect(await refused.json()).toEqual({ code: "voice_provider_has_no_audio" });
  });
});

test.describe("speaking on the house", () => {
  test.use({ baseURL: HOUSE });

  // The house server sells plans: its Stripe answers, as in house.spec.ts (a price it could not read is
  // left out of the plan page for an hour, which would follow into the next spec).
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
  });

  const thisMonth = () => `${new Date().toISOString().slice(0, 7)}-01`;
  async function spokenSeconds(userId: string): Promise<number> {
    const [row] = await sql<{ seconds: number }[]>`
      select audio_seconds as seconds from usage_counters where user_id = ${userId} and period = ${thisMonth()}`;
    return row?.seconds ?? 0;
  }

  test("counts the seconds it writes down, and at the month's end the box stays", async ({ page }) => {
    await signUpQuietly(page, newEmail("house-voice"));
    const userId = await currentUserId(page);
    await page.goto("/home");
    await speak(page);
    await expect(page.getByLabel("Your message")).toHaveValue(HEARD, ASSISTANT);
    // Written down on the house's own transcription endpoint (its key never on a page), and counted.
    const seconds = await spokenSeconds(userId);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThan(60);
    for (const path of ["/home", "/settings", "/plan"]) {
      expect(await (await page.request.get(path)).text(), path).not.toContain(VOICE_KEY);
    }
    await page.goto("/plan");
    await expect(page.getByText("Minutes of speaking written down")).toBeVisible();
    await expect(page.getByRole("definition").nth(2)).toHaveText("1 of 15");

    // The month's minutes used: no button, one line, and the box still takes words.
    await sql`
      update usage_counters set audio_seconds = 900 where user_id = ${userId} and period = ${thisMonth()}`;
    await page.goto("/home");
    await expect(page.getByRole("button", { name: "Speak instead of typing" })).toHaveCount(0);
    await expect(
      page.getByText(/This month's speaking time is used\. You can still write here/),
    ).toBeVisible();
    const refused = await page.request.post("/api/voice?seconds=3", {
      headers: { "content-type": "audio/webm" },
      data: Buffer.alloc(2048, 1),
    });
    expect(refused.status()).toBe(429);
    expect(await spokenSeconds(userId)).toBe(900);
  });
});
