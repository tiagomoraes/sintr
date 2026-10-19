import { expect, test, type Page } from "@playwright/test";
import { closeCore, core, currentUserId, signUpQuietly } from "./support";

/**
 * F3, end to end: the production build. A person makes a key on the
 * Connect screen, an agent uses it over the MCP endpoint (plain HTTP, as
 * any remote client would), the screen says it is connected, the entry is
 * in the timeline, and disconnecting stops the key at once.
 */

const base = () => test.info().project.use.baseURL!;

test.afterAll(async () => {
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

async function makeKey(page: Page): Promise<string> {
  await page.goto("/connect");
  await expect(page.getByRole("heading", { level: 1, name: "Your other assistants" })).toBeVisible();
  await page.getByRole("button", { name: "Make a key" }).click();
  await expect(page.getByText("Copy it now: sintr shows it only this once.")).toBeVisible();
  const key = (await page
    .locator("code", { hasText: /^sintr_/ })
    .first()
    .textContent())!.trim();
  expect(key).toMatch(/^sintr_[A-Za-z0-9_-]{43}$/);
  return key;
}

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
  await expect(page.getByText("/mcp/YOUR_KEY")).toBeVisible();

  const key = await makeKey(page);
  await expect(page.getByText(/^Waiting for your assistant/)).toBeVisible();
  // The key is filled into each assistant's steps.
  await expect(page.getByText(`/mcp/${key}`)).toBeVisible();
  await page.getByRole("radio", { name: "Claude Code" }).check();
  await expect(page.getByText(`--header "Authorization: Bearer ${key}"`)).toBeVisible();

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

  // The screen notices on its own.
  await expect(page.getByText("Connected. Last talked to sintr just now, from Claude.")).toBeVisible({
    timeout: 15_000,
  });
  await page.goto("/entries");
  await expect(page.getByText("The planning meeting")).toBeVisible();

  // Shown once: after leaving the page, the key is gone for good.
  await page.goto("/connect");
  await expect(page.locator("code", { hasText: key })).toHaveCount(0);
  await expect(page.getByText(key)).toHaveCount(0);
  const list = page.getByRole("list", { name: "Connected assistants" });
  await expect(list.getByText("My assistant")).toBeVisible();
  await expect(list.getByText("Last talked to sintr just now, from Claude.")).toBeVisible();
  await expect(list.getByText(`Starts with ${key.slice(0, 12)}.`)).toBeVisible();

  // Settings shows the same keys.
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Your other assistants" })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Connected assistants" }).getByText("My assistant"),
  ).toBeVisible();

  // One click switches it off, at once.
  await page.getByRole("button", { name: "Disconnect My assistant" }).click();
  await expect(page.getByText("No assistant is connected.")).toBeVisible();
  expect((await mcp(key, initialize)).status).toBe(401);

  const scope = await core().repositories.forUser(await currentUserId(page));
  const actions = (await scope.auditLog.list()).map((event) => event.action);
  expect(actions).toEqual(
    expect.arrayContaining(["api_token.created", "mcp.entry_saved", "api_token.revoked"]),
  );
});

test("a key made with options, the address form, and only one's own keys", async ({ page, browser }) => {
  await signUpQuietly(page);
  await page.goto("/connect");
  await page.getByText("Name it, or choose what it may do").click();
  await page.getByLabel("Name").fill("ChatGPT at work");
  await page.getByRole("radio", { name: /Save only/ }).check();
  await page.getByRole("button", { name: "Make a key" }).click();
  const key = (await page
    .locator("code", { hasText: /^sintr_/ })
    .first()
    .textContent())!.trim();
  await expect(page.getByText("For ChatGPT at work")).toBeVisible();

  // A save-only key, by address (as ChatGPT sends it): it may save, and sees no reading tools.
  const listed = await mcp(key, { method: "tools/list" }, `/mcp/${key}`);
  expect(listed.status).toBe(200);
  const tools = (listed.body.result as { tools: { name: string }[] }).tools.map((tool) => tool.name).sort();
  expect(tools).toEqual(["save_checkin", "save_entry"]);

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
  await page.getByRole("button", { name: "Disconnect My assistant" }).click();
  await expect(page.getByRole("heading", { name: "Connect an assistant" })).toBeVisible();
  await expect(page.getByText(key)).toHaveCount(0);
  await expect(page.getByText(/^Waiting for your assistant/)).toHaveCount(0);
  expect((await mcp(key, initialize)).status).toBe(401);
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
