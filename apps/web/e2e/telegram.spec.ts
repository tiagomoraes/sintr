import { expect, test, type Page } from "@playwright/test";
import { newEmail, setUpAssistant, signUpQuietly } from "./support";

/**
 * F13, the diary in Telegram's browser on an iPhone. Telegram opens a link in
 * a sheet with its own bar floating at the top (close, the address, the
 * menu), and the page's web view starts 68 points down, the bar reaching 8
 * points into it. The web view does not clip at its top, so what the page
 * has scrolled past stays drawn behind the bar, above the header
 * (Telegram-iOS, submodules/BrowserUI: BrowserScreen.swift and
 * BrowserWebContent.swift, `scrollView.clipsToBounds = false`; DECISIONS 137).
 * Chromium clips at the top of the page, so here the whole screen is the
 * page and its header is held where Telegram's web view starts: the strip
 * above the header is what Telegram shows behind its bar.
 */
const PAGE_TOP = 68;
const BAR_BOTTOM = PAGE_TOP + 8;

/** The darkest pixel in a part of the screen, from 0 (black) to 255 (white). */
async function darkestIn(page: Page, clip: { x: number; y: number; width: number; height: number }) {
  const png = await page.screenshot({ clip });
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const context = new OffscreenCanvas(image.width, image.height).getContext("2d")!;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, image.width, image.height);
    let darkest = 255;
    for (let i = 0; i < data.length; i += 4) {
      darkest = Math.min(darkest, (data[i]! + data[i + 1]! + data[i + 2]!) / 3);
    }
    return darkest;
  }, png.toString("base64"));
}

test.describe("the diary in Telegram's browser on a phone", () => {
  test.use({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });

  test("keeps the header clear of Telegram's bar, and nothing the page scrolled past shows behind it", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signUpQuietly(page, newEmail("telegram"));
    await setUpAssistant(page);
    await page.goto("/home");
    const header = page.getByRole("banner");
    const question = page.getByRole("heading", { level: 1, name: "Tell me what happened." });
    await expect(question).toBeVisible();

    // In a browser that clips at the top, the header stays at the top, its own size.
    await page.evaluate(() => window.scrollTo(0, 200));
    await expect(header).toHaveAttribute("data-scrolled", "true");
    expect(await header.boundingBox()).toEqual({ x: 0, y: 0, width: 393, height: 72 });

    // Telegram: the header stops where its web view starts, and the page scrolls
    // until its question is behind the bar, as on the phone it was reported from.
    await header.evaluate((element, top) => element.style.setProperty("top", `${top}px`), PAGE_TOP);
    await question.evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - 8));
    expect(Math.round((await question.boundingBox())!.y)).toBe(8);
    expect((await header.boundingBox())!.y).toBe(PAGE_TOP);

    // Nothing of the header is under the bar but its margin.
    for (const control of [
      header.getByRole("link", { name: "sintr, home" }),
      header.getByRole("button", { name: "Menu" }),
    ]) {
      expect((await control.boundingBox())!.y).toBeGreaterThanOrEqual(BAR_BOTTOM);
    }
    // Behind the bar there is the header's paper, not the question.
    expect(await darkestIn(page, { x: 0, y: 0, width: 393, height: PAGE_TOP })).toBeGreaterThan(240);
  });
});
