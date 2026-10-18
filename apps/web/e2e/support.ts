import { randomUUID } from "node:crypto";
import { loadConfig } from "@sintr/core";
import { createRuntime, type Runtime } from "@sintr/core/runtime";
import { expect, type Page } from "@playwright/test";

let shared: Runtime | undefined;

/** The same core the app runs, pointed at the e2e database with the run's keys. */
export function core(): Runtime {
  shared ??= createRuntime(
    loadConfig({
      DATABASE_URL: process.env.SINTR_E2E_DATABASE_URL,
      SINTR_AUTH_SECRET: process.env.SINTR_E2E_AUTH_SECRET,
      SINTR_MASTER_KEY: process.env.SINTR_E2E_MASTER_KEY,
      SINTR_LOG_LEVEL: "error",
    }),
    { service: "e2e", poolSize: 2 },
  );
  return shared;
}

export const PASSWORD = "a sentence long enough to pass";

export function newEmail(label: string): string {
  return `${label}-${randomUUID()}@example.test`;
}

/** Sign up through the real form, consent included, and land in the diary. */
export async function signUp(page: Page, email: string): Promise<void> {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create your diary" }).click();
  await expect(page).toHaveURL(/\/entries$/);
}

/** The signed-in user's id, as the server sees it. */
export async function currentUserId(page: Page): Promise<string> {
  const response = await page.request.get("/api/auth/get-session");
  const body = (await response.json()) as { user: { id: string } } | null;
  expect(body?.user.id).toBeTruthy();
  return body!.user.id;
}
