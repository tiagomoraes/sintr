import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

/**
 * End to end: the production build of the app, started against its own
 * fresh Postgres database (created and migrated in e2e/global-setup.ts).
 * Secrets are generated per run; workers inherit them through the
 * environment of this process. The assistant is the offline rehearsal
 * model (SINTR_FAKE_AGENT): no test ever reaches a real provider.
 */
const base = process.env.DATABASE_URL;
if (!base) throw new Error("DATABASE_URL is not set: run the tests with `make test`");

const databaseUrl = new URL(base);
databaseUrl.pathname = "/sintr_test_web";
process.env.SINTR_E2E_DATABASE_URL ??= databaseUrl.toString();
process.env.SINTR_E2E_MASTER_KEY ??= randomBytes(32).toString("base64");
process.env.SINTR_E2E_AUTH_SECRET ??= randomBytes(48).toString("base64url");

const port = Number(process.env.SINTR_E2E_PORT ?? 3100);
const url = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: url, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next build && pnpm exec next start --hostname 127.0.0.1 --port ${port}`,
    url,
    timeout: 240_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      DATABASE_URL: process.env.SINTR_E2E_DATABASE_URL,
      SINTR_URL: url,
      SINTR_AUTH_SECRET: process.env.SINTR_E2E_AUTH_SECRET,
      SINTR_MASTER_KEY: process.env.SINTR_E2E_MASTER_KEY,
      SINTR_MASTER_KEY_ID: "k1",
      SINTR_LOG_LEVEL: "warn",
      SINTR_FAKE_AGENT: "1",
    },
  },
});
