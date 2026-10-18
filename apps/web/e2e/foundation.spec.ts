import { expect, test } from "@playwright/test";
import { PASSWORD, closeCore, core, currentUserId, newEmail, signUp } from "./support";

const PROTECTED = ["/entries", "/checkins", "/therapy", "/reports", "/consent"];

test.afterAll(async () => {
  await closeCore();
});

test.describe("the app boots against a real Postgres", () => {
  test("reports ready only when the database answers", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("serves the entry screen with strict security headers", async ({ request }) => {
    const response = await request.get("/");
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(headers["content-security-policy"]).not.toContain("unsafe-eval");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
});

test.describe("unauthenticated access is rejected", () => {
  for (const path of PROTECTED) {
    test(`${path} redirects to sign in`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      // Relative, so the browser stays on the origin it used.
      expect(response.headers().location).toMatch(/^\/sign-in\?next=/);
      const location = new URL(response.headers().location!, "http://x");
      expect(location.pathname).toBe("/sign-in");
      expect(location.searchParams.get("next")).toBe(path);
    });
  }

  test("a forged session cookie is refused by the server-side check", async ({ request }) => {
    for (const path of PROTECTED) {
      const response = await request.get(path, {
        maxRedirects: 0,
        headers: { cookie: "sintr.session_token=forged.value" },
      });
      expect(response.status(), path).toBe(307);
      const location = new URL(response.headers().location!, "http://x");
      expect(location.pathname, path).toBe("/sign-in");
      expect(location.searchParams.get("next"), path).toBe(path);
    }
  });

  test("the session endpoint knows no one", async ({ request }) => {
    const response = await request.get("/api/auth/get-session");
    expect(response.ok()).toBe(true);
    expect(await response.json()).toBeNull();
  });

  test("closed endpoints stay closed", async ({ request }) => {
    const response = await request.post("/api/auth/update-user", { data: { name: "x" } });
    expect(response.status()).toBe(404);
  });
});

test.describe("sign up, the diary, sign out", () => {
  test("refuses to create an account without consent", async ({ page }) => {
    const email = newEmail("no-consent");
    await page.goto("/sign-up");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    // Skip the browser's own required check to reach the server's.
    await page.getByRole("checkbox").evaluate((box) => box.removeAttribute("required"));
    await page.getByRole("button", { name: "Create your diary" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "consent" })).toHaveText(
      "To keep your diary, sintr needs your consent below.",
    );
    await expect(page).toHaveURL(/\/sign-up$/);
  });

  test("shows a calm empty diary, then the person's own words, decrypted only for them", async ({
    page,
    browser,
  }) => {
    const email = newEmail("alice");
    await signUp(page, email);
    await expect(page.getByRole("heading", { level: 1, name: "Entries" })).toBeVisible();
    await expect(page.getByText("Nothing written yet.")).toBeVisible();
    for (const [label, heading] of [
      ["Check-ins", "No check-ins yet."],
      ["Therapy", "Nothing about your therapy yet."],
      ["Reports", "No reports yet."],
    ] as const) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await expect(page.getByText(heading)).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /188/ })).toBeVisible();

    // Write through the same core the app uses; the app must decrypt it for Alice.
    const aliceId = await currentUserId(page);
    const words = "a reunião de segunda e o que eu pensei depois";
    const scope = await core().repositories.forUser(aliceId);
    await scope.entries.create({ title: words, thoughts: ["eu sempre estrago tudo"] });
    await page.goto("/entries");
    await expect(page.getByText(words)).toBeVisible();

    // Bob, in a separate browser context, sees none of it.
    const bobContext = await browser.newContext();
    const bob = await bobContext.newPage();
    await signUp(bob, newEmail("bob"));
    await expect(bob.getByText("Nothing written yet.")).toBeVisible();
    await expect(bob.getByText(words)).toHaveCount(0);
    await bobContext.close();

    // Signing out ends the session on the server, not just in the browser.
    const cookies = await page.context().cookies();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    const session = cookies.find((c) => c.name === "sintr.session_token")!;
    const replay = await page.request.get("/entries", {
      maxRedirects: 0,
      headers: { cookie: `${session.name}=${session.value}` },
    });
    expect(replay.status()).toBe(307);
  });

  test("signs back in and returns to the page asked for", async ({ page }) => {
    const email = newEmail("returning");
    await signUp(page, email);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/reports");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Freports$/);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("not the right password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "match" })).toHaveText(
      "That email and password do not match.",
    );
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/reports$/);
  });
});
