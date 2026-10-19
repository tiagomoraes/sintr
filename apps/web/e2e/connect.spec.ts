import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { closeCore, core, currentUserId, signUpQuietly } from "./support";

/**
 * F3 and F12, end to end: the production build. A person names a key,
 * chooses what it may do and only then makes it, on the Connect screen; it
 * is shown once, with what it may do; an agent uses it over the MCP
 * endpoint (plain HTTP, as any remote client would), the screen says it is
 * connected, the entry is in the timeline, and disconnecting stops the key
 * at once. The same works without JavaScript.
 */

const base = () => test.info().project.use.baseURL!;
const sql = postgres(process.env.SINTR_E2E_DATABASE_URL!, { max: 1, onnotice: () => undefined });

test.afterAll(async () => {
  await sql.end();
  await closeCore();
});

/** One JSON-RPC call to the MCP endpoint, as an agent's client sends it. */
async function mcp(key: string, body: Record<string, unknown>, path = "/mcp") {
  const response = await fetch(new URL(path, base()), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
      ...(path === "/mcp" ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, ...body }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

const initialize = {
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "claude-ai", version: "1.0" },
  },
};

/** The key shown once on the page, read off the screen. */
async function shownKey(page: Page): Promise<string> {
  await expect(page.getByText("Copy it now: sintr shows it only this once.")).toBeVisible();
  const key = (await page
    .locator("code", { hasText: /^sintr_/ })
    .first()
    .textContent())!.trim();
  expect(key).toMatch(/^sintr_[A-Za-z0-9_-]{43}$/);
  return key;
}

/** Name a key, choose what it may do, then make it. */
async function makeKey(page: Page, name = "Claude on my laptop", access = "Read and save"): Promise<string> {
  await page.goto("/connect");
  await expect(page.getByRole("heading", { level: 1, name: "Your other assistants" })).toBeVisible();
  await page.getByLabel("Which assistant is it for?").fill(name);
  await page.getByRole("radio", { name: new RegExp(`^${access}`) }).check();
  await page.getByRole("button", { name: "Make the key" }).click();
  return shownKey(page);
}

/** The text on screen, among the steps of every assistant (only the chosen one's are shown). */
const shown = (page: Page, text: string) => page.getByText(text).filter({ visible: true });

test("make a key, connect an agent, see it connected, find the entry, disconnect", async ({ page }) => {
  await signUpQuietly(page);
  await page.goto("/connect");
  await expect(
    page.getByText(
      "If you already talk to ChatGPT, Claude, Gemini or Hermes, they can keep your diary here",
      { exact: false },
    ),
  ).toBeVisible();
  // Before a key exists the steps show a placeholder, never a real key.
  await expect(shown(page, "/mcp/YOUR_KEY")).toBeVisible();

  const key = await makeKey(page);
  await expect(page.getByText(/^Waiting for your assistant/)).toBeVisible();
  // Shown with what it may do: its own limits, as the form said them.
  await expect(page.getByText("For Claude on my laptop")).toBeVisible();
  await expect(
    page.getByText(
      "It saves what you say yes to, and can also read your recent days, your entries and your therapy notes.",
    ),
  ).toBeVisible();
  // The key is filled into each assistant's steps, its own (named) first.
  await expect(page.getByRole("radio", { name: "Claude", exact: true })).toBeChecked();
  await expect(shown(page, `/mcp/${key}`)).toBeVisible();
  await page.getByRole("radio", { name: "Claude Code" }).check();
  await expect(shown(page, `--header "Authorization: Bearer ${key}"`)).toBeVisible();

  const hello = await mcp(key, initialize);
  expect(hello.status).toBe(200);
  expect(JSON.stringify(hello.body)).toContain("CVV on 188");
  const saved = await mcp(key, {
    method: "tools/call",
    params: {
      name: "save_entry",
      arguments: {
        title: "The planning meeting",
        thoughts: ["I will never catch up"],
        emotions: [{ name: "anxiety", intensity: 70 }],
        personWords: ["The planning meeting again. I thought: I will never catch up. Anxiety, 70."],
        personConfirmed: true,
      },
    },
  });
  expect(JSON.stringify(saved.body)).toContain('\\"saved\\":true');

  // The screen notices on its own, and there is nothing left to save.
  await expect(page.getByText("Connected. Last talked to sintr just now, from Claude.")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("link", { name: "Done" })).toBeVisible();
  await page.goto("/entries");
  await expect(page.getByText("The planning meeting")).toBeVisible();

  // Shown once: after leaving the page, the key is gone for good.
  await page.goto("/connect");
  await expect(page.locator("code", { hasText: key })).toHaveCount(0);
  await expect(page.getByText(key)).toHaveCount(0);
  const list = page.getByRole("list", { name: "Connected assistants" });
  const row = list.getByRole("listitem").filter({ hasText: "Claude on my laptop" });
  await expect(row.getByText("Read and save", { exact: true })).toBeVisible();
  await expect(row.getByText("Last talked to sintr just now, from Claude.")).toBeVisible();
  await expect(row.getByText(`Starts with ${key.slice(0, 12)}.`)).toBeVisible();
  await expect(row.getByText(/Quiet for over two months/)).toHaveCount(0);
  // A returning person goes straight to the form: the three steps were for the first time.
  await expect(page.getByRole("heading", { name: "Connect another assistant" })).toBeVisible();
  await expect(page.getByRole("list", { name: "How it works" })).toHaveCount(0);

  // Settings shows the same keys.
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Your other assistants" })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Connected assistants" }).getByText("Claude on my laptop"),
  ).toBeVisible();

  // One click switches it off, at once.
  await page.getByRole("button", { name: "Disconnect Claude on my laptop" }).click();
  await expect(page.getByText("No assistant is connected.")).toBeVisible();
  expect((await mcp(key, initialize)).status).toBe(401);

  const scope = await core().repositories.forUser(await currentUserId(page));
  const actions = (await scope.auditLog.list()).map((event) => event.action);
  expect(actions).toEqual(
    expect.arrayContaining(["api_token.created", "mcp.entry_saved", "api_token.revoked"]),
  );
});

test("the decisions come first, nothing is chosen for the person, and the button comes last", async ({
  page,
}) => {
  await signUpQuietly(page);
  await page.goto("/connect");
  // The first time, the three steps say what is about to happen, before anything is asked.
  await expect(page.getByRole("heading", { name: "Connect an assistant" })).toBeVisible();
  await expect(page.getByRole("list", { name: "How it works" })).toBeVisible();

  const form = page.getByRole("form", { name: "Connect an assistant" });
  const name = form.getByLabel("Which assistant is it for?");
  const accesses = form.getByRole("radio");
  const button = form.getByRole("button", { name: "Make the key" });
  // Nothing folded away: the name and the three accesses are in view, and none is chosen.
  await expect(form.locator("details")).toHaveCount(0);
  await expect(name).toBeVisible();
  await expect(accesses).toHaveCount(3);
  for (const access of await accesses.all()) {
    await expect(access).toBeVisible();
    await expect(access).not.toBeChecked();
  }
  // In the order a person decides: the name, what it may do (the one that reads nothing first), the button.
  const order = await form.evaluate((element) =>
    [...element.querySelectorAll("input:not([type=hidden]), button")].map(
      (field) =>
        (field as HTMLInputElement).value ||
        (field as HTMLInputElement).name ||
        (field as HTMLElement).textContent,
    ),
  );
  expect(order).toEqual(["name", "write", "read_write", "read", "Make the key"]);
  // Each access says what it does and when to choose it.
  await expect(
    form.getByText(
      "It saves the entries and check-ins you say yes to, and never reads your diary back. Choose it if you only want help writing things down.",
    ),
  ).toBeVisible();
  await expect(form.getByText("sintr shows the key once, right after you make it.")).toBeVisible();

  // Pressed before deciding, nothing is made.
  await button.click();
  await expect(page.getByText("Copy it now")).toHaveCount(0);
  await name.fill("Gemini");
  await button.click();
  await expect(page.getByText("Copy it now")).toHaveCount(0);

  // The server asks for both too, and keeps what was typed.
  await form.evaluate((element) => ((element as HTMLFormElement).noValidate = true));
  await button.click();
  await expect(form.getByText("Choose what your assistant may do.")).toBeVisible();
  await expect(name).toHaveValue("Gemini");
  await name.fill("  ");
  await form.getByRole("radio", { name: /^Read only/ }).check();
  await button.click();
  await expect(
    form.getByText("Write which assistant it is for, so you can find it in your list later."),
  ).toBeVisible();
  await expect(form.getByRole("radio", { name: /^Read only/ })).toBeChecked();
  expect(
    await core()
      .repositories.forUser(await currentUserId(page))
      .then((s) => s.apiTokens.list()),
  ).toEqual([]);
});

test("a key that may only save, the address form, and only one's own keys", async ({ page, browser }) => {
  await signUpQuietly(page);
  const key = await makeKey(page, "ChatGPT at work", "Save only");
  const made = page.getByRole("region", { name: "Your new key" });
  await expect(made.getByText("For ChatGPT at work")).toBeVisible();
  await expect(made.getByText("Save only", { exact: true })).toBeVisible();
  // The steps open on the assistant the key is named after.
  await expect(page.getByRole("radio", { name: "ChatGPT", exact: true })).toBeChecked();
  await expect(shown(page, `/mcp/${key}`)).toBeVisible();

  // A save-only key, by address (as ChatGPT sends it): it may save, and sees no reading tools.
  const listed = await mcp(key, { method: "tools/list" }, `/mcp/${key}`);
  expect(listed.status).toBe(200);
  const tools = (listed.body.result as { tools: { name: string }[] }).tools.map((tool) => tool.name).sort();
  expect(tools).toEqual(["save_checkin", "save_entry"]);

  // Hidden, the key is gone and the next one starts from nothing.
  await page.getByRole("link", { name: "I saved it, hide the key" }).click();
  await expect(page.getByText(key)).toHaveCount(0);
  const next = page.getByRole("form", { name: "Connect another assistant" });
  await expect(next.getByLabel("Which assistant is it for?")).toHaveValue("");
  for (const access of await next.getByRole("radio").all()) await expect(access).not.toBeChecked();

  // Someone else sees none of it.
  const other = await browser.newPage();
  await signUpQuietly(other);
  await other.goto("/connect");
  await expect(other.getByText("ChatGPT at work")).toHaveCount(0);
  await expect(other.getByRole("heading", { name: "Connect an assistant" })).toBeVisible();
  await other.close();
});

test("a key disconnected while it is still shown disappears, and is not waited for", async ({ page }) => {
  await signUpQuietly(page);
  const key = await makeKey(page);
  await page.getByRole("button", { name: "Disconnect Claude on my laptop" }).click();
  await expect(page.getByRole("heading", { name: "Connect an assistant" })).toBeVisible();
  await expect(page.getByText(key)).toHaveCount(0);
  await expect(page.getByText(/^Waiting for your assistant/)).toHaveCount(0);
  expect((await mcp(key, initialize)).status).toBe(401);
});

test("without JavaScript: name it, choose, make it, see it once with its steps, switch it off", async ({
  page,
  browser,
}) => {
  await signUpQuietly(page);
  const bare = await browser.newContext({ javaScriptEnabled: false });
  await bare.addCookies(await page.context().cookies());
  const html = await bare.newPage();
  await html.goto("/connect");
  // The browser's own checks ask for both decisions before anything is sent.
  await html.getByRole("button", { name: "Make the key" }).click();
  await expect(html.getByText("Copy it now")).toHaveCount(0);
  await html.getByLabel("Which assistant is it for?").fill("Hermes on the server");
  await html.getByRole("radio", { name: /^Read only/ }).check();
  await html.getByRole("button", { name: "Make the key" }).click();

  const key = await shownKey(html);
  const made = html.getByRole("region", { name: "Your new key" });
  await expect(made.getByText("For Hermes on the server")).toBeVisible();
  await expect(made.getByText("Read only", { exact: true })).toBeVisible();
  // Without a script to look again, it says how to see it connected.
  await expect(html.getByText(/open this page again to see it connected/)).toBeVisible();
  // The steps are its own first, with the key filled in, and another assistant's are one tap away.
  await expect(html.getByRole("radio", { name: "Hermes", exact: true })).toBeChecked();
  await expect(shown(html, "hermes mcp add sintr")).toBeVisible();
  await html.getByRole("radio", { name: "Claude Code" }).check();
  await expect(shown(html, `--header "Authorization: Bearer ${key}"`)).toBeVisible();
  await expect(shown(html, "hermes mcp add sintr")).toHaveCount(0);

  // A read-only key sees only the tools that read.
  const listed = await mcp(key, { method: "tools/list" });
  const tools = (listed.body.result as { tools: { name: string }[] }).tools.map((tool) => tool.name);
  expect(tools).not.toContain("save_entry");
  expect(tools).toContain("recent_context");

  // Hiding it is leaving for the page as it is now: the key is gone for good.
  await html.getByRole("link", { name: "I saved it, hide the key" }).click();
  await expect(html.getByText(key)).toHaveCount(0);
  const row = html
    .getByRole("list", { name: "Connected assistants" })
    .getByRole("listitem")
    .filter({ hasText: "Hermes on the server" });
  // The call above was its first: the list says so, and what it may do.
  await expect(row.getByText("Last talked to sintr just now.")).toBeVisible();
  await expect(row.getByText("Read only", { exact: true })).toBeVisible();
  await html.getByRole("button", { name: "Disconnect Hermes on the server" }).click();
  await expect(html.getByRole("heading", { name: "Connect an assistant" })).toBeVisible();
  expect((await mcp(key, initialize)).status).toBe(401);
  await bare.close();
});

test("a key quiet for a long while is pointed out as one to switch off", async ({ page }) => {
  await signUpQuietly(page);
  await makeKey(page, "Gemini at home", "Read and save");
  await makeKey(page, "Claude at work", "Save only");
  const userId = await currentUserId(page);
  await sql`
    update api_tokens set created_at = now() - interval '200 days', last_used_at = now() - interval '90 days'
    where user_id = ${userId} and name = 'Gemini at home'`;
  await page.goto("/connect");
  const list = page.getByRole("list", { name: "Connected assistants" });
  const quiet = list.getByRole("listitem").filter({ hasText: "Gemini at home" });
  await expect(
    quiet.getByText("Quiet for over two months. If you no longer use it, disconnect it."),
  ).toBeVisible();
  await expect(quiet.getByText("Read and save", { exact: true })).toBeVisible();
  const fresh = list.getByRole("listitem").filter({ hasText: "Claude at work" });
  await expect(fresh.getByText("Save only", { exact: true })).toBeVisible();
  await expect(fresh.getByText(/Quiet for over two months/)).toHaveCount(0);
  await expect(
    page.getByText("To change what an assistant may do, give it a new key and disconnect the old one."),
  ).toBeVisible();
});

test("the Connect screen fits a phone, and the bridge can be downloaded", async ({ browser }) => {
  const phone = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await phone.newPage();
  await signUpQuietly(page);
  for (const path of ["/connect", "/settings"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${path} scrolls sideways on a phone`).toBe(0);
  }
  await makeKey(page);
  for (const name of ["Claude", "ChatGPT", "Gemini", "Claude Code", "Hermes"]) {
    await page.getByRole("radio", { name, exact: true }).check();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${name} steps scroll sideways on a phone`).toBe(0);
  }
  await phone.close();

  const bridge = await fetch(new URL("/sintr-mcp.mjs", base()));
  expect(bridge.status).toBe(200);
  expect((await bridge.text()).startsWith("#!/usr/bin/env node")).toBe(true);
});
