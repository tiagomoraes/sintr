import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "@sintr/core";
import { createRuntime, type Runtime } from "@sintr/core/runtime";
import { expect, test, type Page } from "@playwright/test";

let shared: Runtime | undefined;

/** The same core the app runs, pointed at the e2e database with the run's keys. */
export function core(): Runtime {
  shared ??= createRuntime(
    loadConfig({
      DATABASE_URL: process.env.SINTR_E2E_DATABASE_URL,
      SINTR_AUTH_SECRET: process.env.SINTR_E2E_AUTH_SECRET,
      SINTR_MASTER_KEY: process.env.SINTR_E2E_MASTER_KEY,
      SINTR_LOG_LEVEL: "error",
      // Sign-ups made here send their confirmation link to the same outbox as the app's.
      SINTR_EMAIL_OUTBOX: process.env.SINTR_E2E_OUTBOX,
      SINTR_URL: process.env.SINTR_E2E_URL,
    }),
    { service: "e2e", poolSize: 2 },
  );
  return shared;
}

/** Close the shared runtime; the next `core()` opens a fresh one. */
export async function closeCore(): Promise<void> {
  const runtime = shared;
  shared = undefined;
  await runtime?.close();
}

export const PASSWORD = "a sentence long enough to pass";

export function newEmail(label: string): string {
  return `${label}-${randomUUID()}@example.test`;
}

/**
 * Sign up through the real form, consent included, and land on the home. A
 * new diary opens on the welcome; these tests set it aside (welcome.spec.ts
 * walks through it).
 */
export async function signUp(page: Page, email: string): Promise<void> {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create your diary" }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole("button", { name: "Not now, take me to my diary" }).click();
  await expect(page).toHaveURL(/\/home$/);
}

/** The signed-in user's id, as the server sees it. */
export async function currentUserId(page: Page): Promise<string> {
  const response = await page.request.get("/api/auth/get-session");
  const body = (await response.json()) as { user: { id: string } } | null;
  expect(body?.user.id).toBeTruthy();
  return body!.user.id;
}

/** A key that looks real, so the at-rest checks have something to look for. */
export function newKey(): string {
  return `sk-e2e-${randomUUID().replaceAll("-", "")}`;
}

/** Choose a provider and save a key through the settings screen. */
export async function setUpAssistant(page: Page, key: string = newKey()): Promise<string> {
  await page.goto("/settings");
  await page.getByRole("button", { name: "OpenRouter" }).click();
  await page.getByLabel("Model", { exact: true }).fill("vendor/model");
  await page.getByLabel("API key", { exact: true }).fill(key);
  await page.getByRole("button", { name: "Save the assistant" }).click();
  await expect(page.getByText(`A key is saved, ending in ${key.slice(-4)}.`)).toBeVisible();
  return key;
}

/**
 * How long a step that waits on the assistant may take: a reply, a draft (two model steps and the
 * draft's checks before it is stored), a transcript, a confirmed draft being saved. Playwright's
 * default is 5 s, meant for a change on the screen; on a busy runner the rehearsal model's round trip
 * alone can take longer, and the test would fail while only waiting.
 */
export const ASSISTANT = { timeout: 30_000 } as const;

/** Preparing a report: the digest, the model's draft and its checks, the page. */
export const REPORT = { timeout: 60_000 } as const;

/** Send one message in the conversation and wait for the assistant's reply. */
export async function say(page: Page, text: string, reply: string | RegExp): Promise<void> {
  const box = page.getByLabel("Your message");
  await box.fill(text);
  await box.press("Enter");
  await expect(page.getByRole("log").getByText(reply).last()).toBeVisible(ASSISTANT);
}

/**
 * Create a person through the same auth API the sign-up form calls, but on
 * the server side, then give the browser their session cookie. For tests
 * about something other than signing up: the form is rate limited per
 * address (10 every 10 minutes), and the whole suite shares one address.
 */
export async function signUpQuietly(page: Page, email: string = newEmail("person")): Promise<void> {
  const { headers } = await core().auth.api.signUpEmail({
    body: { email, password: PASSWORD, name: "", consent: true } as never,
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((line) => line.split(";")[0]!)
    .find((pair) => pair.startsWith("sintr.session_token="));
  expect(cookie, "a session cookie").toBeDefined();
  const [name, ...value] = cookie!.split("=");
  await page
    .context()
    .addCookies([{ name: name!, value: value.join("="), url: test.info().project.use.baseURL! }]);
  await page.goto("/entries");
  await expect(page.getByRole("heading", { level: 1, name: "Entries" })).toBeVisible();
}

/** A message the app wrote to its test outbox instead of sending it. */
export interface OutboxMessage {
  to: string;
  subject: string;
  text: string;
  attachments: { filename: string; contentType: string; content: string }[];
}

/** Every message written to the outbox for `to`, oldest first. */
export function outbox(to: string): OutboxMessage[] {
  const dir = process.env.SINTR_E2E_OUTBOX!;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .map((file) => JSON.parse(readFileSync(join(dir, file), "utf8")) as OutboxMessage)
    .filter((message) => message.to === to);
}
