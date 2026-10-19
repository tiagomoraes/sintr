import { expect, test, type Dialog, type Locator, type Page } from "@playwright/test";
import { closeCore, newEmail, newKey, setUpAssistant, signUpQuietly } from "./support";

/**
 * F9, end to end: nothing leaves Settings unsaved. A change that is not
 * saved is asked about before every way out (a link on the page, the
 * diary's navigation, the browser's back button, a form that loads another
 * page, signing out), in the page's language, and the browser's own
 * question covers a reload and a closed tab. Staying keeps the change;
 * leaving lets it go. After a save, and with nothing changed, leaving is
 * silent.
 */

const HOUSE = process.env.SINTR_E2E_HOUSE_URL!;

test.afterAll(async () => {
  await closeCore();
});

const question = (page: Page) => page.getByRole("alertdialog");

const UNSAVED_ZONE = "Your changes to the time zone are not saved yet, and leaving now would lose them.";

/**
 * Choose another time zone than the saved one, and say which. Once the page
 * is React's (the select is held in state, and React puts it back as it
 * takes the page over): Next prefetches the links in view by then, so a
 * quiet network means the page has come alive.
 */
async function changeZone(page: Page): Promise<{ zone: Locator; saved: string; chosen: string }> {
  await page.waitForLoadState("networkidle");
  const zone = page.getByLabel("Your time zone");
  const saved = await zone.inputValue();
  const chosen = saved === "Asia/Tokyo" ? "Europe/Lisbon" : "Asia/Tokyo";
  await zone.selectOption(chosen);
  return { zone, saved, chosen };
}

/** No question of any kind, the browser's included, while `run` leaves the page. */
async function leavesQuietly(page: Page, run: () => Promise<void>) {
  const asked: string[] = [];
  const listener = (dialog: Dialog) => {
    asked.push(dialog.type());
    void dialog.accept();
  };
  page.on("dialog", listener);
  await run();
  page.off("dialog", listener);
  expect(asked).toEqual([]);
  await expect(question(page)).toHaveCount(0);
}

const nav = (page: Page) => page.getByRole("navigation", { name: "Your diary" });

test.describe("leaving Settings with a change not saved", () => {
  test("asks before a link, and staying keeps the change", async ({ page }) => {
    await signUpQuietly(page, newEmail("unsaved-link"));
    await page.goto("/settings");
    const { zone, saved, chosen } = await changeZone(page);

    // A link in the diary's navigation.
    await nav(page).getByRole("link", { name: "Entries" }).click();
    const asked = question(page);
    await expect(asked).toBeVisible();
    await expect(asked).toHaveAccessibleName(UNSAVED_ZONE);
    // Staying is the default: it has focus, and it is the filled pill.
    const stay = asked.getByRole("button", { name: "Stay on this page" });
    await expect(stay).toBeFocused();
    await stay.click();
    await expect(asked).toBeHidden();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(zone).toHaveValue(chosen);

    // A link inside the page asks the same, and leaving knowingly lets the change go.
    await page.getByRole("link", { name: "Go through the welcome again" }).click();
    await expect(asked).toHaveAccessibleName(UNSAVED_ZONE);
    await asked.getByRole("button", { name: "Leave without saving" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Here is the welcome again." })).toBeVisible();
    await page.goto("/settings");
    await expect(zone).toHaveValue(saved);
  });

  test("names everything unsaved on the page, in the page's order, and a change undone is no change", async ({
    page,
  }) => {
    await signUpQuietly(page, newEmail("unsaved-all"));
    await setUpAssistant(page);
    await page.reload();
    // The assistant's form: the box that removes the saved key.
    const remove = page.getByRole("checkbox", { name: "Remove the saved key" });
    await remove.check();
    await page.getByLabel("Language", { exact: true }).selectOption("pt-BR");
    await page.getByRole("radio", { name: "30 days after the last message" }).check();
    await changeZone(page);
    await page.getByRole("link", { name: "Connect one" }).click();
    await expect(question(page)).toHaveAccessibleName(
      "Your changes to the assistant, the language, the time zone and how long to keep conversations are not saved yet, and leaving now would lose them.",
    );
    await page.keyboard.press("Escape");

    // Undone by hand, a change is no longer one.
    await remove.uncheck();
    await page.getByLabel("Language", { exact: true }).selectOption("");
    await page.getByRole("radio", { name: "Until I delete them" }).check();
    await nav(page).getByRole("link", { name: "Check-ins" }).click();
    await expect(question(page)).toHaveAccessibleName(UNSAVED_ZONE);
  });

  test("counts a change made before the page came alive", async ({ page }) => {
    await signUpQuietly(page, newEmail("unsaved-early"));
    // A slow phone: the page's HTML is there and its scripts are not yet.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/_next/static/chunks/**", async (route) => {
      await held;
      await route.continue();
    });
    await page.goto("/settings", { waitUntil: "commit" });
    const radio = page.getByRole("radio", { name: "30 days after the last message" });
    await radio.check();
    release();
    await page.waitForLoadState("networkidle");
    await expect(radio).toBeChecked();
    await nav(page).getByRole("link", { name: "Entries" }).click();
    await expect(question(page)).toHaveAccessibleName(
      "Your changes to how long to keep conversations are not saved yet, and leaving now would lose them.",
    );
  });

  test("the keyboard alone answers it, and focus comes back to where it was", async ({ page }) => {
    await signUpQuietly(page, newEmail("unsaved-keys"));
    await page.goto("/settings");
    await changeZone(page);
    const link = nav(page).getByRole("link", { name: "Therapy" });
    await link.focus();
    await page.keyboard.press("Enter");
    const asked = question(page);
    await expect(asked).toBeVisible();
    await expect(asked.getByRole("button", { name: "Stay on this page" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(asked).toBeHidden();
    await expect(link).toBeFocused();
    await expect(page).toHaveURL(/\/settings$/);

    // Enter on Stay stays; Tab, then Enter, leaves.
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(asked).toBeHidden();
    await expect(link).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(asked.getByRole("button", { name: "Leave without saving" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Your therapy" })).toBeVisible();
  });

  test("asks before the browser's back button within the app", async ({ page }) => {
    await signUpQuietly(page, newEmail("unsaved-back"));
    // Into Settings from Entries, as a person moves: one page of the app, then another.
    await nav(page).getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    const { zone, chosen } = await changeZone(page);

    // The question holds the step back, so the browser's own wait for it is not awaited here.
    void page.goBack().catch(() => null);
    const asked = question(page);
    await expect(asked).toHaveAccessibleName(UNSAVED_ZONE);
    await asked.getByRole("button", { name: "Stay on this page" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(zone).toHaveValue(chosen);

    void page.goBack().catch(() => null);
    await asked.getByRole("button", { name: "Leave without saving" }).click();
    await expect(page).toHaveURL(/\/entries$/);
    await expect(page.getByRole("heading", { level: 1, name: "Entries" })).toBeVisible();
  });

  test("a reload and a closed tab get the browser's own question", async ({ page }) => {
    await signUpQuietly(page, newEmail("unsaved-reload"));
    await page.goto("/settings");
    const { zone, saved } = await changeZone(page);

    // Reload: the browser asks; leaving reloads the page as it was saved.
    const reloadAsked = page.waitForEvent("dialog");
    const reloaded = page.reload();
    const dialog = await reloadAsked;
    expect(dialog.type()).toBe("beforeunload");
    await dialog.accept();
    await reloaded;
    await expect(zone).toHaveValue(saved);

    // Closing the tab: the browser asks, and staying keeps the page open.
    await changeZone(page);
    const closeAsked = page.waitForEvent("dialog");
    await page.close({ runBeforeUnload: true });
    const closing = await closeAsked;
    expect(closing.type()).toBe("beforeunload");
    await closing.dismiss();
    expect(page.isClosed()).toBe(false);
  });

  test("asks before signing out, and before a language form takes the page with it", async ({ page }) => {
    await signUpQuietly(page, newEmail("unsaved-forms"));
    await page.goto("/settings");
    await changeZone(page);

    await page.getByRole("button", { name: "Sign out" }).click();
    const asked = question(page);
    await expect(asked).toHaveAccessibleName(UNSAVED_ZONE);
    await asked.getByRole("button", { name: "Stay on this page" }).click();
    await expect(page).toHaveURL(/\/settings$/);

    // The offer at the foot of the page loads the page again in another language.
    await page.getByRole("button", { name: "Ler o sintr em português" }).click();
    await expect(asked).toHaveAccessibleName(UNSAVED_ZONE);
    await asked.getByRole("button", { name: "Stay on this page" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();

    // The language's own change is saved by sending it; the time zone would be lost with the page.
    const language = page.getByLabel("Language", { exact: true });
    await language.selectOption("pt-BR");
    await page.locator("form").filter({ has: language }).getByRole("button").click();
    await expect(asked).toHaveAccessibleName(UNSAVED_ZONE);
    await asked.getByRole("button", { name: "Leave without saving" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Ajustes" })).toBeVisible();
  });
});

test.describe("leaving Settings quietly", () => {
  test("after a save, every form leaves without a word", async ({ page }) => {
    await signUpQuietly(page, newEmail("unsaved-saved"));
    await setUpAssistant(page);
    await leavesQuietly(page, async () => {
      await nav(page).getByRole("link", { name: "Entries" }).click();
      await expect(page).toHaveURL(/\/entries$/);
    });

    await page.goto("/settings");
    const { chosen } = await changeZone(page);
    await page.getByRole("radio", { name: "90 days after the last message" }).check();
    await page
      .getByRole("form", { name: "Time zone and conversations" })
      .getByRole("button", { name: "Save" })
      .click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
    await page.getByLabel("Model", { exact: true }).fill("vendor/another-model");
    await page.getByRole("button", { name: "Save the assistant" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toHaveCount(2);
    await leavesQuietly(page, async () => {
      await page.reload();
      await nav(page).getByRole("link", { name: "Check-ins" }).click();
      await expect(page).toHaveURL(/\/checkins$/);
    });
    await page.goto("/settings");
    await expect(page.getByLabel("Your time zone")).toHaveValue(chosen);

    // The language, sent alone, takes nothing else with it: no question at all.
    await leavesQuietly(page, async () => {
      const language = page.getByLabel("Language", { exact: true });
      await language.selectOption("pt-BR");
      await page.locator("form").filter({ has: language }).getByRole("button").click();
      await expect(page.getByRole("heading", { level: 1, name: "Ajustes" })).toBeVisible();
    });
  });

  test("with nothing changed, no way out is interrupted", async ({ page }) => {
    await signUpQuietly(page, newEmail("unsaved-none"));
    await leavesQuietly(page, async () => {
      await page.goto("/settings");
      await page.getByRole("link", { name: "Go through the welcome again" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Here is the welcome again." })).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(/\/settings$/);
      await page.reload();
      await nav(page).getByRole("link", { name: "Entries" }).click();
      await expect(page).toHaveURL(/\/entries$/);
    });
  });
});

test.describe("in Portuguese", () => {
  test("the question speaks the page's language", async ({ page }) => {
    await signUpQuietly(page, newEmail("nao-salvo"));
    await page.goto("/settings");
    // The person's own choice of language, saved alone: nothing else would be lost, so nothing asks.
    await leavesQuietly(page, async () => {
      const language = page.getByLabel("Language", { exact: true });
      await language.selectOption("pt-BR");
      await page.locator("form").filter({ has: language }).getByRole("button").click();
      await expect(page.getByRole("heading", { level: 1, name: "Ajustes" })).toBeVisible();
    });
    await page.getByLabel("Idioma", { exact: true }).selectOption("");
    await page.getByLabel("Seu fuso horário", { exact: true }).selectOption("Asia/Tokyo");
    await page
      .getByRole("navigation", { name: "Seu diário" })
      .getByRole("link", { name: "Registros" })
      .click();
    const asked = question(page);
    await expect(asked).toHaveAccessibleName(
      "As mudanças no idioma e no fuso horário ainda não foram salvas e, se você sair agora, elas se perdem.",
    );
    await expect(asked.getByRole("button", { name: "Ficar nesta página" })).toBeFocused();
    await asked.getByRole("button", { name: "Sair sem salvar" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Registros" })).toBeVisible();
  });
});

test.describe("on a phone", () => {
  test("the menu's links ask too, and staying leaves the menu open", async ({ browser }) => {
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await phone.newPage();
    await signUpQuietly(page, newEmail("unsaved-phone"));
    await page.goto("/settings");
    await changeZone(page);
    await page.getByRole("button", { name: "Menu" }).click();
    const menu = page.getByRole("dialog", { name: "Your diary" });
    await menu.getByRole("link", { name: /^Reports/ }).click();
    const asked = question(page);
    await expect(asked).toHaveAccessibleName(UNSAVED_ZONE);
    // A sheet from the bottom of the screen, full width, once it has come up.
    await asked.evaluate((dialog) =>
      Promise.all(dialog.getAnimations().map((animation) => animation.finished)),
    );
    const box = (await asked.boundingBox())!;
    expect(Math.round(box.y + box.height)).toBe(844);
    expect(Math.round(box.width)).toBe(390);
    await asked.getByRole("button", { name: "Stay on this page" }).tap();
    await expect(asked).toBeHidden();
    await expect(menu).toBeVisible();
    await menu.getByRole("link", { name: /^Reports/ }).tap();
    await asked.getByRole("button", { name: "Leave without saving" }).tap();
    await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
    await phone.close();
  });
});

test.describe("on the house", () => {
  test.use({ baseURL: HOUSE });

  test("going back to the included assistant asks first, since it opens Settings again", async ({ page }) => {
    await signUpQuietly(page, newEmail("unsaved-house"));
    await page.goto("/settings");
    await page.getByText("Use your own key instead").click();
    await page.getByRole("button", { name: "OpenRouter" }).click();
    await page.getByLabel("Model", { exact: true }).fill("vendor/model");
    await page.getByLabel("API key", { exact: true }).fill(newKey());
    await page.getByRole("button", { name: "Save the assistant" }).click();
    await expect(page.getByText(/A key is saved/)).toBeVisible();
    await page.reload();
    const { zone, chosen } = await changeZone(page);

    await page.getByRole("button", { name: "Go back to the included assistant" }).click();
    const asked = question(page);
    await expect(asked).toHaveAccessibleName(UNSAVED_ZONE);
    await asked.getByRole("button", { name: "Stay on this page" }).click();
    await expect(page.getByText(/You are using your own key/)).toBeVisible();
    await expect(zone).toHaveValue(chosen);

    await page.getByRole("button", { name: "Go back to the included assistant" }).click();
    await asked.getByRole("button", { name: "Leave without saving" }).click();
    await expect(page.getByText(/The assistant is included\./)).toBeVisible();
  });
});
