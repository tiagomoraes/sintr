import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { PASSWORD, closeCore, core, currentUserId, newEmail } from "./support";

/**
 * F6, end to end, on the server configured as the hosted app runs: the
 * first minutes of someone who has never seen sintr. They sign up, are
 * asked a few questions, one a screen, each able to wait, and land on a
 * home already set up; nothing in it asks for a provider, a key or a card.
 */

const HOUSE = process.env.SINTR_E2E_HOUSE_URL!;
// A phone in Sao Paulo: the welcome takes the person's time zone from their device.
test.use({ baseURL: HOUSE, timezoneId: "America/Sao_Paulo" });

const sql = postgres(process.env.SINTR_E2E_DATABASE_URL!, { max: 1, onnotice: () => undefined });

test.afterAll(async () => {
  await sql.end();
  await closeCore();
});

/** The calendar holds exactly one weekly rhythm, on Tuesdays at 18:00. */
async function tuesdays(scope: Awaited<ReturnType<ReturnType<typeof core>["repositories"]["forUser"]>>) {
  const { series, changes } = await scope.sessions.calendar();
  return (
    changes.length === 0 &&
    series.length === 1 &&
    series[0]!.repeat === "weekly" &&
    series[0]!.time === "18:00" &&
    new Date(`${series[0]!.startsOn}T12:00:00Z`).getUTCDay() === 2
  );
}

async function createDiary(page: Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create your diary" }).click();
  await expect(page).toHaveURL(/\/welcome$/);
}

test.describe("the welcome", () => {
  test("asks one question a screen, saves each answer, and opens on a home already set up", async ({
    page,
  }) => {
    await createDiary(page, newEmail("welcome"));
    const userId = await currentUserId(page);
    const scope = await core().repositories.forUser(userId);

    // A calm first screen: what this is, and that every question can wait. The help lines are there too.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "This is your diary for the week between sessions.",
    );
    await expect(
      page.getByText("Three short questions and you are set. Any of them can wait."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Call CVV, 188" })).toBeVisible();
    await page.getByRole("button", { name: "Begin" }).click();

    // How to call the person: for greetings, and for the assistant while its memory is on.
    await expect(page.getByRole("heading", { level: 1, name: "What should I call you?" })).toBeVisible();
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    await expect(
      page.getByText(
        "To greet you here, and for your assistant to call you by it if you turn on its memory. It is never printed on a report.",
      ),
    ).toBeVisible();
    await page.getByLabel("Your name, or what you like to be called").fill("Bia");
    await page.getByRole("button", { name: "Continue" }).click();

    // The therapist, then the sessions. The back gesture goes back a question, with the answer kept.
    await expect(page.getByRole("heading", { level: 1, name: "Who is your therapist?" })).toBeVisible();
    await expect(page).toHaveURL(/step=therapist/);
    await page.goBack();
    await expect(page.getByLabel("Your name, or what you like to be called")).toHaveValue("Bia");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Your therapist's name").fill("Dr. Lima");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "When do you see Dr. Lima?" })).toBeVisible();
    await expect(page.getByText("In Sao Paulo time.")).toBeVisible();
    // Both or neither: a day without a time is asked again, plainly.
    await page.getByRole("radio", { name: "Tuesdays" }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Choose the day and the time, or let it wait.")).toBeVisible();
    await page.getByLabel("Time").fill("18:00");
    await page.getByRole("button", { name: "Continue" }).click();

    // Set: said back in sentences, then the home.
    await expect(page.getByRole("heading", { level: 1, name: "You are set, Bia." })).toBeVisible();
    await expect(
      page.getByText(
        "Your sessions are on Tuesdays at 18:00. An hour before each one, your week will be waiting on one page.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Your reports are for Dr. Lima, and go to them only when you say so."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Go to my diary" }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByText(/^Good (morning|afternoon|evening), Bia\.$/)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Tell me what happened." })).toBeVisible();
    await expect(page.getByText("You stopped partway through setting up.")).toHaveCount(0);

    // Every answer was kept, and the name the person goes by is not the name on their reports.
    const profile = await scope.profile.get();
    expect(profile).toMatchObject({ preferredName: "Bia", displayName: null, timezone: "America/Sao_Paulo" });
    expect(profile.onboardedAt).toBeInstanceOf(Date);
    expect(await scope.therapySettings.get()).toMatchObject({ therapistName: "Dr. Lima" });
    // Tuesdays at 18:00, in one move: a weekly rhythm in the calendar.
    expect(await tuesdays(scope)).toBe(true);
    // Sealed at rest, like everything else the person writes.
    const [row] = await sql<
      { dump: string }[]
    >`select t::text as dump from profiles t where user_id = ${userId}`;
    expect(row!.dump).not.toContain("Bia");

    // Therapy says it back in sentences.
    await page.goto("/therapy");
    await expect(page.getByText("Every week on Tuesday at 18:00.")).toBeVisible();
    await expect(page.getByText("Times are in Sao Paulo time.")).toBeVisible();
    await expect(page.getByText("Dr. Lima. Reports stay with you, to download and bring.")).toBeVisible();
  });

  test("runs again from Settings over the answers given, and skipping erases nothing", async ({ page }) => {
    await createDiary(page, newEmail("welcome-again"));
    const scope = await core().repositories.forUser(await currentUserId(page));
    await page.getByRole("button", { name: "Begin" }).click();
    await page.getByLabel("Your name, or what you like to be called").fill("Bia");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Your therapist's name").fill("Dr. Lima");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("radio", { name: "Tuesdays" }).check();
    await page.getByLabel("Time").fill("18:00");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Go to my diary" }).click();
    await expect(page).toHaveURL(/\/home$/);
    await scope.entries.create({ situation: "Something I wrote before running the welcome again." });

    // One line in Settings, in the welcome's own voice.
    await page.goto("/settings");
    await expect(page.getByText(/nothing you have written is erased/)).toBeVisible();
    await page.getByRole("link", { name: "Go through the welcome again" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Here is the welcome again." })).toBeVisible();
    // Not now goes back where the person came from.
    await page.getByRole("button", { name: "Not now, back to Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.getByRole("link", { name: "Go through the welcome again" }).click();
    await page.getByRole("button", { name: "Begin" }).click();

    // Every answer is in its field; Skip keeps it, even after a change in the field.
    const name = page.getByLabel("Your name, or what you like to be called");
    await expect(name).toHaveValue("Bia");
    await name.fill("Somebody else");
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByLabel("Your therapist's name")).toHaveValue("Dr. Lima");
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "When do you see Dr. Lima?" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Tuesdays" })).toBeChecked();
    await expect(page.getByLabel("Time")).toHaveValue("18:00");
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "You are set, Bia." })).toBeVisible();
    await expect(page.getByText("Your sessions are on Tuesdays at 18:00.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Go to my diary" }).click();
    await expect(page).toHaveURL(/\/home$/);

    // Nothing was erased or changed.
    expect(await scope.profile.get()).toMatchObject({ preferredName: "Bia" });
    expect(await scope.therapySettings.get()).toMatchObject({ therapistName: "Dr. Lima" });
    expect(await tuesdays(scope)).toBe(true);
    expect(await scope.entries.count()).toBe(1);
  });

  test("lets every question wait, and offers the way back without insisting", async ({ page }) => {
    await createDiary(page, newEmail("welcome-later"));
    const scope = await core().repositories.forUser(await currentUserId(page));

    await page.getByRole("button", { name: "Begin" }).click();
    await page.getByRole("button", { name: "Skip" }).click();
    await page.getByRole("button", { name: "I do not have one right now" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "When are your sessions?" })).toBeVisible();
    // Leaving partway: the home offers the way back, once, and nothing else.
    await page.goto("/home");
    await expect(page.getByText("You stopped partway through setting up.")).toBeVisible();
    await page.getByRole("link", { name: "Pick it up where you left off" }).click();
    await expect(page).toHaveURL(/\/welcome$/);
    await page.getByRole("button", { name: "Begin" }).click();
    await page.getByRole("button", { name: "Skip" }).click();
    await page.getByRole("button", { name: "I do not have one right now" }).click();
    await page.getByRole("button", { name: "It changes from week to week" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "You are set." })).toBeVisible();
    await expect(page.getByText(/you can prepare it from Reports/)).toBeVisible();
    await page.getByRole("button", { name: "Go to my diary" }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByText(/^Good (morning|afternoon|evening)\.$/)).toBeVisible();
    await expect(page.getByText("You stopped partway through setting up.")).toHaveCount(0);

    expect(await scope.profile.get()).toMatchObject({ preferredName: null, displayName: null });
    expect(await scope.therapySettings.get()).toMatchObject({ therapistName: null });
    // "It changes from week to week": nothing in the calendar, and nothing erased from it.
    expect(await scope.sessions.calendar()).toEqual({ series: [], changes: [] });
  });
});
