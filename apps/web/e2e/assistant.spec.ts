import { expect, test, type Page } from "@playwright/test";
import {
  ASSISTANT,
  closeCore,
  core,
  currentUserId,
  newEmail,
  say,
  setUpAssistant,
  signUpQuietly,
} from "./support";

/**
 * F8, end to end: the assistant is a resident of the whole diary. Every page
 * of the person's diary but the home carries it in a corner that opens the
 * same conversation beside the page, by voice (Chromium's fake microphone,
 * written down by the rehearsal transcriber) or in writing, as far as a
 * confirmed entry, without leaving the page. One pool of light travels
 * between the home's middle and the corner; with reduced motion it is
 * simply in each place.
 */

const HEARD = "The meeting on Monday, when my manager asked about the deadline in front of everyone.";
const THOUGHTS = "I thought: I am going to let everyone down. Anxiety 80, shame 60.";
const QUESTION = /What went through your mind right then/;
const DRAFTED = /You can confirm it, change anything, or tell me what to fix/;

/** The pages of the person's diary that carry the assistant in a corner. */
const CORNERED = ["/entries", "/checkins", "/therapy", "/reports", "/sharing", "/connect", "/settings"];

test.use({ permissions: ["microphone"] });

test.afterAll(async () => {
  await closeCore();
});

const corner = (page: Page) => page.getByRole("button", { name: /^Talk to sintr/ });
const panel = (page: Page) => page.getByRole("dialog", { name: "Talk to sintr" });

/** Click a section in the side list: a move inside the app, not a new page load. */
async function goTo(page: Page, name: string, path: RegExp) {
  await page.getByRole("navigation", { name: "Your diary" }).getByRole("link", { name, exact: true }).click();
  await expect(page).toHaveURL(path);
}

test.describe("the assistant everywhere", () => {
  test("waits in the corner of every page of the diary, but not in its room or a practice", async ({
    page,
  }) => {
    await signUpQuietly(page, newEmail("corner"));
    // Nothing to offer before there is an assistant: no corner at all.
    await expect(corner(page)).toHaveCount(0);
    await setUpAssistant(page);
    // Saving a key brings the assistant to the corner of the page the person is on, without a reload.
    await expect(corner(page)).toBeVisible();
    for (const path of CORNERED) {
      await page.goto(path);
      await expect(corner(page), path).toBeVisible();
      // The help lines are on every page that carries the assistant.
      await expect(page.getByRole("contentinfo").getByRole("link", { name: /188/ }), path).toBeVisible();
    }
    // The home is the assistant's own room; the practice's pages are the professional's desk.
    await page.goto("/home");
    await expect(page.getByRole("heading", { level: 1, name: "Tell me what happened." })).toBeVisible();
    await expect(corner(page)).toHaveCount(0);
    await page.goto("/practice");
    await expect(page.getByRole("heading", { level: 1, name: "Your practice" })).toBeVisible();
    await expect(corner(page)).toHaveCount(0);
  });

  test("speaks beside a page, drafts, writes the entry, and leaves the person where they were", async ({
    page,
  }) => {
    test.slow();
    await signUpQuietly(page, newEmail("corner-voice"));
    await setUpAssistant(page);
    const scope = await core().repositories.forUser(await currentUserId(page));
    await page.goto("/entries");
    await expect(page.getByText("Nothing written yet.")).toBeVisible();

    await corner(page).click();
    const beside = panel(page);
    await expect(beside).toBeVisible();
    await expect(beside.getByRole("heading", { name: "Tell me what happened." })).toBeVisible();
    // Speak is one tap away there, and the help lines are under the box.
    await beside.getByRole("button", { name: "Speak instead of typing" }).click();
    const listening = beside.getByRole("group", { name: "Listening" });
    await expect(listening.getByText("0:01")).toBeVisible();
    await listening.getByRole("button", { name: "Done" }).click();
    await expect(beside.getByText("Here is what I heard. Change anything, then send it.")).toBeVisible(
      ASSISTANT,
    );
    await expect(beside.getByLabel("Your message")).toHaveValue(HEARD);
    await expect(beside.getByRole("link", { name: "Call CVV, 188" })).toBeVisible();
    // Heard, not sent: nothing exists yet.
    expect(await scope.conversations.list()).toEqual([]);

    await beside.getByLabel("Your message").press("Enter");
    await expect(page.getByRole("log").getByText(QUESTION).last()).toBeVisible(ASSISTANT);
    await say(page, THOUGHTS, DRAFTED);
    // The page is the same page; the conversation did not take its address.
    await expect(page).toHaveURL(/\/entries$/);
    await beside
      .getByRole("article", { name: "Draft entry, waiting for you" })
      .getByRole("button", { name: "Confirm" })
      .click();
    await expect(beside.getByRole("article", { name: "Saved entry" })).toBeVisible(ASSISTANT);
    const [entry] = await scope.entries.list();
    expect(entry?.situation).toBe(HEARD);
    // The page under the conversation reads it again, in place.
    await expect(
      page
        .getByRole("main")
        .getByText(/Monday/)
        .first(),
    ).toBeVisible(ASSISTANT);

    // Escape closes it, and focus goes back to the corner, on the same page.
    await page.keyboard.press("Escape");
    await expect(beside).toHaveCount(0);
    await expect(corner(page)).toBeFocused();
    await expect(page).toHaveURL(/\/entries$/);

    // The same conversation, beside another page.
    await goTo(page, "Therapy", /\/therapy$/);
    await corner(page).click();
    await expect(panel(page).getByRole("article", { name: "Saved entry" })).toBeVisible();
    await expect(panel(page).getByRole("log").getByText(HEARD).first()).toBeVisible();
    // And in the home's room, which takes it up at its own address.
    await goTo(page, "Home", /\/(home|talk\/[0-9a-f-]{36})$/);
    await expect(page).toHaveURL(/\/talk\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("main").getByRole("article", { name: "Saved entry" })).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
  });

  test("is reached by keyboard, closes with Escape and lets focus leave it", async ({ page }) => {
    await signUpQuietly(page, newEmail("corner-keys"));
    await setUpAssistant(page);
    await page.goto("/reports");
    await corner(page).focus();
    await page.keyboard.press("Enter");
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByLabel("Your message")).toBeFocused();
    // Not a trap: Tab goes on past the end of the conversation, and it stays open beside the page.
    for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest("#assistant-panel")))).toBe(
      false,
    );
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);
    await expect(corner(page)).toBeFocused();
  });

  test("carries one pool from the home's middle to the corner, and with reduced motion it is simply there", async ({
    page,
  }) => {
    await signUpQuietly(page, newEmail("corner-travel"));
    await setUpAssistant(page);
    await page.goto("/home");
    const flight = page.locator(".sintr-flight");
    await expect(flight).toBeHidden();
    await goTo(page, "Entries", /\/entries$/);
    // On its way: the travelling pool shows, takes no pointer, and gives way to the corner's own.
    await expect(flight).toBeVisible();
    await expect(flight).toHaveCSS("pointer-events", "none");
    await expect(corner(page)).toBeEnabled();
    await expect(flight).toBeHidden({ timeout: 5_000 });
    await expect(page.locator(".sintr-corner__light .sintr-pool")).toHaveCSS("visibility", "visible");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => {
      const layer = document.querySelector(".sintr-flight")!;
      (window as unknown as { flew: boolean }).flew = false;
      new MutationObserver(() => {
        if (!(layer as HTMLElement).hidden) (window as unknown as { flew: boolean }).flew = true;
      }).observe(layer, { attributes: true });
    });
    await goTo(page, "Home", /\/home$/);
    await expect(page.getByRole("heading", { level: 1, name: "Tell me what happened." })).toBeVisible();
    await goTo(page, "Entries", /\/entries$/);
    await corner(page).click();
    await expect(panel(page)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { flew: boolean }).flew)).toBe(false);
    await expect(panel(page).locator(".sintr-pool")).toHaveCSS("visibility", "visible");
  });
});

test.describe("the assistant on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("opens as a sheet from the bottom, and a tap on the page beside it closes it", async ({ page }) => {
    await signUpQuietly(page, newEmail("corner-phone"));
    await setUpAssistant(page);
    await page.goto("/checkins");
    await corner(page).tap();
    const sheet = panel(page);
    await expect(sheet).toBeVisible();
    // Measured once it has come up.
    await sheet.evaluate((element) => Promise.all(element.getAnimations().map((a) => a.finished)));
    const box = (await sheet.boundingBox())!;
    expect(box.width).toBe(390);
    expect(Math.round(box.y + box.height)).toBe(844);
    expect(box.height).toBeLessThan(844);
    // On a phone it does not reach for the keyboard by itself.
    await expect(sheet.getByLabel("Your message")).not.toBeFocused();
    await page.mouse.click(195, 40);
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/\/checkins$/);
  });
});
