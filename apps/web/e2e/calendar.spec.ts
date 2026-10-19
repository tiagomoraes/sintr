import { expect, test, type Browser, type Page } from "@playwright/test";
import { REPORT, closeCore, core, currentUserId, newEmail, signUpQuietly } from "./support";

/**
 * F11, end to end: Therapy's calendar on the production build. Sessions are
 * added in one move, two in a week are two sessions, one session of a
 * rhythm is moved or cancelled on its own and the app says which, a rhythm
 * changes from one session on, the next session announced (and the report
 * prepared for it) is the real next one, on a phone and without JavaScript.
 * The people here are in UTC, so the days below are their own days.
 */

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

test.afterAll(async () => {
  await closeCore();
});

/** The local day `n` days from today, as `YYYY-MM-DD`. */
function day(n: number): string {
  return new Date(Date.now() + n * DAY).toISOString().slice(0, 10);
}

function at(onDay: string, time: string): Date {
  return new Date(`${onDay}T${time}:00Z`);
}

/** A moment as the page says it: "Tuesday 20 October at 18:00". */
function when(onDay: string, time: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(at(onDay, time));
}

/** A day as the page says it: "Tuesday 20 October". */
function date(onDay: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(at(onDay, "12:00"));
}

const weekday = (onDay: string) => WEEKDAYS[at(onDay, "12:00").getUTCDay()]!;

async function scopeOf(page: Page) {
  return core().repositories.forUser(await currentUserId(page));
}

/** A session in "Coming up", by when it is. */
function comingUp(page: Page, onDay: string, time: string) {
  return page
    .getByRole("region", { name: "Your sessions" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: new RegExp(`^${when(onDay, time)}`) }) })
    .first();
}

async function openSession(page: Page, onDay: string, time: string) {
  await comingUp(page, onDay, time).getByRole("link").click();
  const sheet = page.getByRole("dialog", { name: when(onDay, time) });
  await expect(sheet).toBeVisible();
  return sheet;
}

async function addSession(page: Page, onDay: string, time: string, repeat?: string) {
  await page.getByRole("link", { name: "Add a session", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Add a session" });
  await sheet.getByLabel("Day", { exact: true }).fill(onDay);
  await sheet.getByLabel("Time", { exact: true }).fill(time);
  if (repeat) await sheet.getByRole("radio", { name: repeat }).check();
  await sheet.getByRole("button", { name: "Add the session" }).click();
  await expect(page.getByText("Added to your calendar.")).toBeVisible();
}

test.describe("the therapy calendar", () => {
  test("adds sessions in one move each, two in a week, and announces the real next one", async ({ page }) => {
    await signUpQuietly(page, newEmail("calendar-add"));
    await page.goto("/therapy");
    await expect(page.getByText("None in your calendar yet.")).toBeVisible();
    await expect(
      page.getByText("Without a session in your calendar, no report is prepared on its own."),
    ).toBeVisible();

    // Every week, in one move: the day, the time, and the rhythm the day already suggests.
    await page.getByRole("link", { name: "Add a session", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Add a session" });
    await sheet.getByLabel("Day", { exact: true }).fill(day(3));
    await expect(sheet.getByRole("radio", { name: `Every week on ${weekday(day(3))}` })).toBeChecked();
    await expect(sheet.getByRole("radio", { name: `Every two weeks on ${weekday(day(3))}` })).toBeVisible();
    await expect(sheet.getByRole("radio", { name: "Every 15 days" })).toBeVisible();
    await sheet.getByLabel("Time", { exact: true }).fill("18:00");
    await sheet.getByRole("button", { name: "Add the session" }).click();
    await expect(page.getByText("Added to your calendar.")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // A second session in the same week, once.
    await addSession(page, day(4), "08:30", "Does not repeat");
    await expect(
      page.getByText(`Every week on ${weekday(day(3))} at 18:00. Once, on ${date(day(4))} at 08:30.`),
    ).toBeVisible();

    // As they fall: the next one first and marked, the single one the day after, then the rhythm going on.
    await expect(comingUp(page, day(3), "18:00")).toContainText("Next session. Every week");
    await expect(comingUp(page, day(4), "08:30")).toContainText("Does not repeat");
    await expect(comingUp(page, day(10), "18:00")).toContainText("Every week");
    await expect(
      page.getByText(
        `The next report will be prepared on ${when(day(3), "17:00")}, for the session of ${when(day(3), "18:00")}.`,
      ),
    ).toBeVisible();

    // Kept as two series: a weekly rhythm and one date.
    const { series } = await (await scopeOf(page)).sessions.calendar();
    expect(series).toEqual([
      expect.objectContaining({ startsOn: day(3), time: "18:00", repeat: "weekly", stopsOn: null }),
      expect.objectContaining({ startsOn: day(4), time: "08:30", repeat: "once" }),
    ]);
  });

  test("moves one session alone: the next session and its report follow it, the rhythm stays", async ({
    page,
  }) => {
    test.slow();
    await signUpQuietly(page, newEmail("calendar-move"));
    const scope = await scopeOf(page);
    const rhythm = await scope.sessions.add({ startsOn: day(3), time: "18:00", repeat: "weekly" });
    await page.goto("/therapy");

    // Moving it says which: only this one, unless the person chooses the ones after it too.
    let sheet = await openSession(page, day(3), "18:00");
    await expect(sheet).toContainText(`Its report is prepared on ${when(day(3), "17:00")}.`);
    await sheet.getByRole("link", { name: "Change" }).click();
    sheet = page.getByRole("dialog", { name: "Change this session" });
    await sheet.getByLabel("Day", { exact: true }).fill(day(2));
    await sheet.getByLabel("Time", { exact: true }).fill("09:00");
    await expect(sheet.getByRole("radio", { name: "Only this one" })).toBeChecked();
    // Only this one moves; the rhythm is still the rhythm of its own day.
    await expect(sheet.getByRole("radio", { name: `Every week on ${weekday(day(3))}` })).toBeChecked();
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByText("Moved. Only that session changed: the rest of the rhythm is where it was."),
    ).toBeVisible();

    // The real next one is the moved one; its old day is free; the rhythm goes on a week later.
    await expect(comingUp(page, day(2), "09:00")).toContainText(
      `Next session. Moved from ${when(day(3), "18:00")}`,
    );
    await expect(comingUp(page, day(10), "18:00")).toContainText("Every week");
    await expect(page.getByRole("link", { name: new RegExp(`^${when(day(3), "18:00")}`) })).toHaveCount(0);
    await expect(
      page.getByText(
        `The next report will be prepared on ${when(day(2), "08:00")}, for the session of ${when(day(2), "09:00")}.`,
      ),
    ).toBeVisible();
    expect(await scope.sessions.calendar()).toEqual({
      series: [expect.objectContaining({ id: rhythm.id, startsOn: day(3), time: "18:00", stopsOn: null })],
      changes: [{ seriesId: rhythm.id, occursOn: day(3), movedTo: { on: day(2), time: "09:00" } }],
    });

    // Reports believe it: the next session is the moved one, and "Prepare it now" is for it.
    await page.goto("/reports");
    await expect(
      page.getByText(
        `The next one is prepared on ${when(day(2), "08:00")}, for your session of ${when(day(2), "09:00")}.`,
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Prepare it now" }).click();
    await expect(page).toHaveURL(/\/reports\/[0-9a-f-]{36}$/, REPORT);
    const [report] = await scope.reports.list();
    expect(report?.sessionAt).toEqual(at(day(2), "09:00"));

    // Put back, it is the rhythm's session again.
    await page.goto("/therapy");
    sheet = await openSession(page, day(2), "09:00");
    await expect(sheet).toContainText(
      `Moved from ${when(day(3), "18:00")}. The rest of the rhythm is where it was.`,
    );
    await sheet.getByRole("button", { name: `Put it back on ${when(day(3), "18:00")}` }).click();
    await expect(page.getByText("Put back where the rhythm has it.")).toBeVisible();
    await expect(comingUp(page, day(3), "18:00")).toContainText("Next session. Every week");
    expect((await scope.sessions.calendar()).changes).toEqual([]);
  });

  test("cancels one session alone, and changes or stops the rhythm from one session on", async ({ page }) => {
    await signUpQuietly(page, newEmail("calendar-cancel"));
    const scope = await scopeOf(page);
    const rhythm = await scope.sessions.add({ startsOn: day(3), time: "18:00", repeat: "weekly" });
    await page.goto("/therapy");

    // Only this one: the gap shows, and the rhythm goes on around it.
    let sheet = await openSession(page, day(10), "18:00");
    await sheet.getByRole("link", { name: "Cancel this session" }).click();
    sheet = page.getByRole("dialog", { name: "Cancel this session" });
    await expect(sheet.getByRole("radio", { name: "Only this one" })).toBeChecked();
    await sheet.getByRole("button", { name: "Cancel the session" }).click();
    await expect(
      page.getByText("Cancelled. Only that session: the rest of the rhythm goes on."),
    ).toBeVisible();
    await expect(comingUp(page, day(10), "18:00")).toContainText("Cancelled");
    await expect(comingUp(page, day(3), "18:00")).toContainText("Next session");
    await expect(comingUp(page, day(17), "18:00")).toContainText("Every week");

    // A new rhythm from one session on: "only this one" is not what it means, so it is not offered.
    sheet = await openSession(page, day(17), "18:00");
    await sheet.getByRole("link", { name: "Change" }).click();
    sheet = page.getByRole("dialog", { name: "Change this session" });
    await sheet.getByRole("radio", { name: `Every two weeks on ${weekday(day(17))}` }).check();
    await expect(sheet.getByRole("radio", { name: "Only this one" })).toBeDisabled();
    await expect(sheet.getByRole("radio", { name: "This one and the ones after it" })).toBeChecked();
    await expect(sheet.getByText("A new rhythm changes the sessions after this one too.")).toBeVisible();
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByText("Changed from that session on. The sessions before it stay as they were."),
    ).toBeVisible();
    let calendar = await scope.sessions.calendar();
    expect(calendar.series).toEqual([
      expect.objectContaining({ id: rhythm.id, repeat: "weekly", stopsOn: day(17) }),
      expect.objectContaining({ startsOn: day(17), time: "18:00", repeat: "fortnightly", stopsOn: null }),
    ]);
    // The cancellation before it is still the person's.
    expect(calendar.changes).toEqual([{ seriesId: rhythm.id, occursOn: day(10), movedTo: null }]);
    await expect(comingUp(page, day(31), "18:00")).toContainText("Every two weeks");
    await expect(page.getByRole("link", { name: new RegExp(`^${when(day(24), "18:00")}`) })).toHaveCount(0);

    // Stopping it from one session on keeps every session before it.
    sheet = await openSession(page, day(31), "18:00");
    await sheet.getByRole("link", { name: "Cancel this session" }).click();
    sheet = page.getByRole("dialog", { name: "Cancel this session" });
    await sheet.getByRole("radio", { name: "This one and every one after it" }).check();
    await sheet.getByRole("button", { name: "Cancel the session" }).click();
    await expect(
      page.getByText("The rhythm stops there. The sessions before it stay as they were."),
    ).toBeVisible();
    calendar = await scope.sessions.calendar();
    expect(calendar.series[1]).toMatchObject({ startsOn: day(17), stopsOn: day(31) });
    await expect(comingUp(page, day(17), "18:00")).toBeVisible();
  });

  test("asks before leaving Therapy with a change, and never while the calendar moves", async ({ page }) => {
    await signUpQuietly(page, newEmail("calendar-unsaved"));
    const scope = await scopeOf(page);
    await scope.sessions.add({ startsOn: day(3), time: "18:00", repeat: "weekly" });
    await page.goto("/therapy");
    // The form posts, and its Save waits for the page to be alive: no field travels in an address.
    const form = page.getByRole("form", { name: "Your therapy" });
    await expect(form).toHaveAttribute("method", "post");
    await expect(form.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
    await page.getByText("Your therapist", { exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill("Dr. Unsaved");

    // The calendar's months, a session's sheet and the back gesture that closes it are this page.
    await page.getByRole("link", { name: "Next month" }).click();
    await expect(page).toHaveURL(/month=/);
    await page.getByRole("link", { name: "Previous month" }).click();
    await comingUp(page, day(3), "18:00").getByRole("link").click();
    await expect(page.getByRole("dialog", { name: when(day(3), "18:00") })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Dr. Unsaved");

    // Leaving for another page asks, names what would be lost, and staying keeps it.
    await page.getByRole("navigation").getByRole("link", { name: "Entries", exact: true }).first().click();
    const question = page.getByRole("alertdialog");
    await expect(question).toContainText("Your changes to your therapist's details are not saved yet");
    await question.getByRole("button", { name: "Stay on this page" }).click();
    await expect(page).toHaveURL(/\/therapy/);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Dr. Unsaved");

    // Saved, it leaves quietly.
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
    await page.getByRole("navigation").getByRole("link", { name: "Entries", exact: true }).first().click();
    await expect(page).toHaveURL(/\/entries$/);
    expect((await scope.therapySettings.get()).therapistName).toBe("Dr. Unsaved");
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test("opens a day, then its session as a sheet from the bottom, and the back gesture closes it", async ({
      page,
    }) => {
      await signUpQuietly(page, newEmail("calendar-phone"));
      const scope = await scopeOf(page);
      await scope.sessions.add({ startsOn: day(1), time: "07:15", repeat: "weekly" });
      await page.goto(`/therapy?month=${day(1).slice(0, 7)}`);
      await page.locator(`a[data-day="${day(1)}"]`).tap();
      await expect(page).toHaveURL(new RegExp(`day=${day(1)}`));
      const panel = page.getByText(date(day(1)), { exact: true }).last();
      await expect(panel).toBeInViewport();
      await page
        .getByRole("link", { name: new RegExp(`^${when(day(1), "07:15")}`) })
        .last()
        .tap();
      const sheet = page.getByRole("dialog", { name: when(day(1), "07:15") });
      await expect(sheet).toBeVisible();
      // From the bottom of the screen, where the thumb is.
      await expect(async () => {
        const box = (await sheet.boundingBox())!;
        expect(Math.round(box.y + box.height)).toBe(844);
        expect(Math.round(box.width)).toBe(390);
      }).toPass();
      await page.goBack();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(`day=${day(1)}`));
      await expect(page).not.toHaveURL(/session=/);
    });
  });

  test.describe("without JavaScript", () => {
    async function withoutScript(browser: Browser, page: Page) {
      const context = await browser.newContext({ javaScriptEnabled: false, locale: "en-GB" });
      await context.addCookies(await page.context().cookies());
      return { context, page: await context.newPage() };
    }

    test("adds a session and cancels one with plain links and forms", async ({ browser, page }) => {
      await signUpQuietly(page, newEmail("calendar-noscript"));
      const scope = await scopeOf(page);
      const plain = await withoutScript(browser, page);
      try {
        await plain.page.goto("/therapy");
        await plain.page.getByRole("link", { name: "Add a session", exact: true }).click();
        await expect(plain.page).toHaveURL(/add=/);
        const form = plain.page.getByRole("dialog", { name: "Add a session" });
        await form.getByLabel("Day", { exact: true }).fill(day(5));
        await form.getByLabel("Time", { exact: true }).fill("19:30");
        await form.getByRole("button", { name: "Add the session" }).click();
        await expect(plain.page.getByText("Added to your calendar.")).toBeVisible();
        await expect(plain.page.getByText(`Every week on ${weekday(day(5))} at 19:30.`)).toBeVisible();

        await comingUp(plain.page, day(12), "19:30").getByRole("link").click();
        await plain.page.getByRole("link", { name: "Cancel this session" }).click();
        await plain.page.getByRole("button", { name: "Cancel the session" }).click();
        await expect(
          plain.page.getByText("Cancelled. Only that session: the rest of the rhythm goes on."),
        ).toBeVisible();
        // The plain post is for sintr's own pages: another site's form keeps nothing.
        const elsewhere: Record<string, string>[] = [
          { "sec-fetch-site": "cross-site" },
          { origin: "https://elsewhere.example" },
        ];
        for (const headers of elsewhere) {
          const refused = await page.request.post("/api/therapy/sessions", {
            form: { intent: "add", day: day(6), time: "10:00", repeat: "once" },
            headers,
            maxRedirects: 0,
          });
          expect(refused.status()).toBe(403);
        }
        const calendar = await scope.sessions.calendar();
        expect(calendar.series).toEqual([
          expect.objectContaining({ startsOn: day(5), time: "19:30", repeat: "weekly" }),
        ]);
        expect(calendar.changes).toEqual([expect.objectContaining({ occursOn: day(12), movedTo: null })]);
      } finally {
        await plain.context.close();
      }
    });
  });
});
