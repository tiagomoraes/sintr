import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { ASSISTANT, core, currentUserId, newEmail, say, setUpAssistant, signUpQuietly } from "./support";

/**
 * F10: the memory's life through the running app, on the person's own key
 * (OpenRouter) and the rehearsal model and embedder (SINTR_FAKE_AGENT), so
 * no words leave the machine: off, and saying so; turned on, with the
 * providers named; read from the diary; brought into a conversation;
 * corrected; forgotten one by one and all at once, gone from the database.
 */

const MEETING = "At the Monday meeting my manager asked about the deadline in front of everyone.";
const WORK = "I work as a nurse on the night shift at the hospital.";
const DAY = 24 * 60 * 60 * 1000;

let sql: ReturnType<typeof postgres> | undefined;
function database() {
  sql ??= postgres(process.env.SINTR_E2E_DATABASE_URL!, { max: 1, onnotice: () => undefined });
  return sql;
}

test.afterAll(async () => {
  await sql?.end();
});

/** A person with an assistant of their own, a name, and two pages of diary (one a month old). */
async function personWithDiary(page: Page): Promise<string> {
  await signUpQuietly(page, newEmail("memory"));
  await setUpAssistant(page);
  const userId = await currentUserId(page);
  const scope = await core().repositories.forUser(userId);
  await scope.profile.update({ preferredName: "Lia" });
  await scope.entries.create({ occurredAt: new Date(Date.now() - 30 * DAY), situation: MEETING });
  await scope.entries.create({ occurredAt: new Date(Date.now() - 20 * DAY), situation: WORK });
  return userId;
}

async function stored(userId: string) {
  const [row] = await database()<{ memories: string; reads: string }[]>`
    select (select count(*) from memories where user_id = ${userId}) as memories,
           (select count(*) from memory_reads where user_id = ${userId}) as reads`;
  return { memories: Number(row!.memories), reads: Number(row!.reads) };
}

test.describe("the memory", () => {
  test("is off until the person agrees: nothing is read or kept, and the assistant says so", async ({
    page,
  }) => {
    const userId = await personWithDiary(page);
    await page.goto("/memory");
    await expect(page.getByRole("heading", { level: 1, name: "What sintr remembers" })).toBeVisible();
    await expect(page.getByText("Who receives your words")).toBeVisible();
    await expect(
      page.getByText(/sends your entries and check-in notes to OpenRouter, with your own key/),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Let sintr remember" })).toBeVisible();
    expect(await stored(userId)).toEqual({ memories: 0, reads: 0 });

    await page.goto("/home");
    await say(page, "Do you remember what I told you about the meeting?", /sintr's memory is off/);
    expect(await stored(userId)).toEqual({ memories: 0, reads: 0 });
  });

  test("created, retrieved, corrected and forgotten, and gone from the database", async ({ page }) => {
    test.slow();
    const userId = await personWithDiary(page);

    // Created: the yes names the provider, and the diary is read while the person waits.
    await page.goto("/memory");
    await page.getByRole("button", { name: "Let sintr remember" }).click();
    await expect(page.getByText("sintr has read everything you wrote.")).toBeVisible(ASSISTANT);
    await expect(page.getByText("To keep it, your diary goes to OpenRouter.")).toBeVisible();
    await expect(page.getByText("You go by Lia.")).toBeVisible();
    const about = page.getByRole("region", { name: "Who you are" });
    await expect(
      about.getByRole("listitem").filter({ hasText: "I work as a nurse on the night shift at the hospital" }),
    ).toHaveCount(1);
    const moments = page.getByRole("region", { name: "What has been happening" });
    const meeting = moments.getByRole("listitem").filter({ hasText: "At the Monday meeting" });
    await expect(meeting).toHaveCount(1);
    await expect(meeting.getByRole("link", { name: /^From your entry of / })).toBeVisible();
    // The words it rests on are the person's, under the highlighter.
    await expect(meeting.locator("q")).toHaveText(
      "At the Monday meeting my manager asked about the deadline in front of everyone",
    );
    expect(await stored(userId)).toMatchObject({ reads: 2 });
    const [consent] = await database()<{ granted: boolean; version: string }[]>`
      select granted, version from consents where user_id = ${userId} and purpose = 'memory' order by created_at desc limit 1`;
    expect(consent?.granted).toBe(true);

    // Retrieved: a new conversation knows the name and brings up what is related.
    await page.goto("/home");
    await say(
      page,
      "My manager asked about the deadline again today.",
      /You mentioned this before: At the Monday meeting my manager asked about the deadline/,
    );
    await expect(page.getByRole("log").getByText(/Lia, it is good to hear from you\./)).toBeVisible();

    // Corrected: the person's words replace the sentence, and the source stays.
    await page.goto("/memory");
    const work = page
      .getByRole("region", { name: "Who you are" })
      .getByRole("listitem")
      .filter({ hasText: "I work as a nurse" });
    await work.getByText("Correct it").click();
    await work.getByLabel("What should sintr remember instead?").fill("Works nights as a nurse.");
    await work.getByRole("button", { name: "Save" }).click();
    const corrected = page.getByRole("listitem").filter({ hasText: "Works nights as a nurse." });
    await expect(corrected.getByText("You corrected this.")).toBeVisible();
    await expect(corrected.locator("q")).toHaveText("I work as a nurse on the night shift at the hospital");

    // Forgotten, one: the row is deleted, and its sealed bytes are in no dump of the table.
    const [sealed] = await database()<{ id: string; text: string }[]>`
      select m.id, encode(m.text, 'hex') as text from memories m
      where m.user_id = ${userId} and m.kind = 'moment' and m.entry_id is not null
      order by m.occurred_at asc limit 1`;
    await meeting.getByRole("button", { name: "Forget" }).click();
    await meeting.getByRole("button", { name: "Forget it" }).click();
    await expect(moments.getByText("At the Monday meeting")).toHaveCount(0);
    const dump = (await database()<{ row: string }[]>`select t::text as row from memories t`)
      .map((r) => r.row)
      .join("\n");
    expect(dump).not.toContain(sealed!.id);
    expect(dump).not.toContain(sealed!.text);

    // Downloaded: what is left, with where it came from.
    const download = await page.request.get("/api/memory");
    expect(download.headers()["content-disposition"]).toContain("sintr-memory.json");
    const file = (await download.json()) as { memories: { kind: string; text: string }[] };
    expect(file.memories.map((memory) => memory.text)).toContain("Works nights as a nurse.");
    expect(JSON.stringify(file)).not.toContain("At the Monday meeting");

    // Forgotten, all: the consent is withdrawn and nothing of the memory is left.
    await page.getByRole("button", { name: "Forget everything" }).click();
    await page.getByRole("button", { name: "Forget everything and turn it off" }).click();
    await expect(
      page.getByText("Done. sintr keeps no memory of you now, and nothing is read."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Let sintr remember" })).toBeVisible();
    expect(await stored(userId)).toEqual({ memories: 0, reads: 0 });
    const [withdrawn] = await database()<{ granted: boolean }[]>`
      select granted from consents where user_id = ${userId} and purpose = 'memory' order by created_at desc limit 1`;
    expect(withdrawn?.granted).toBe(false);

    // And the assistant knows it no longer remembers.
    await page.goto("/home");
    await say(page, "Do you remember my name?", /sintr's memory is off/);
  });

  test("shows a person none of another person's memory", async ({ page, browser }) => {
    const userId = await personWithDiary(page);
    await page.goto("/memory");
    await page.getByRole("button", { name: "Let sintr remember" }).click();
    await expect(page.getByText("You go by Lia.")).toBeVisible(ASSISTANT);
    expect((await stored(userId)).memories).toBeGreaterThan(0);

    const other = await browser.newPage();
    try {
      await signUpQuietly(other, newEmail("other"));
      await other.goto("/memory");
      await expect(other.getByText("You go by Lia.")).toHaveCount(0);
      const file = (await (await other.request.get("/api/memory")).json()) as { memories: unknown[] };
      expect(file.memories).toEqual([]);
    } finally {
      await other.close();
    }
  });
});
