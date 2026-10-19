import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * End to end: the production build of the app, started twice against its
 * own fresh Postgres database (created and migrated in e2e/global-setup.ts):
 * once as a self-host without a house assistant (the default suite), and
 * once as the hosted app would run, with a house assistant and payments
 * (e2e/house.spec.ts). Secrets are generated per run; workers inherit them
 * through the environment of this process. The assistant is the offline
 * rehearsal model (SINTR_FAKE_AGENT), whoever's key it stands for: no test
 * ever reaches a real provider. Payments go to a fake Stripe the house
 * tests start on this machine. Email goes to an outbox directory
 * (SINTR_EMAIL_OUTBOX), never to a server.
 */
const base = process.env.DATABASE_URL;
if (!base) throw new Error("DATABASE_URL is not set: run the tests with `make test`");

const databaseUrl = new URL(base);
databaseUrl.pathname = "/sintr_test_web";
process.env.SINTR_E2E_DATABASE_URL ??= databaseUrl.toString();
process.env.SINTR_E2E_MASTER_KEY ??= randomBytes(32).toString("base64");
process.env.SINTR_E2E_AUTH_SECRET ??= randomBytes(48).toString("base64url");
process.env.SINTR_E2E_OUTBOX ??= join(tmpdir(), `sintr-e2e-outbox-${randomBytes(6).toString("hex")}`);

const port = Number(process.env.SINTR_E2E_PORT ?? 3100);
const url = `http://127.0.0.1:${port}`;
process.env.SINTR_E2E_URL ??= url;
// The hosted-like server: a house assistant, and Stripe at a fake address.
const housePort = port + 1;
const houseUrl = `http://127.0.0.1:${housePort}`;
process.env.SINTR_E2E_HOUSE_URL ??= houseUrl;
process.env.SINTR_E2E_HOUSE_KEY ??= `sk-house-e2e-${randomBytes(16).toString("hex")}`;
process.env.SINTR_E2E_STRIPE_URL ??= `http://127.0.0.1:${port + 99}`;
process.env.SINTR_E2E_WEBHOOK_SECRET ??= `whsec_${randomBytes(16).toString("hex")}`;

// Playwright passes this process's environment on, and `make` exports .env into it.
const WITHOUT_HOUSE = {
  SINTR_HOUSE_PROVIDER: "",
  SINTR_HOUSE_BASE_URL: "",
  SINTR_HOUSE_MODEL: "",
  SINTR_HOUSE_KEY: "",
  SINTR_HOUSE_NAME: "",
  SINTR_STRIPE_SECRET_KEY: "",
  SINTR_STRIPE_WEBHOOK_SECRET: "",
  SINTR_STRIPE_PRICE_PERSONAL: "",
  SINTR_STRIPE_PRICE_PRACTICE_SEAT: "",
  SINTR_STRIPE_API_URL: "",
  SINTR_PRACTICE_SEATS: "",
  SINTR_PRACTICE_PLAN: "",
};

const shared = {
  SINTR_MODE: "selfhost",
  SINTR_PERSON_PLAN: "free",
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  DATABASE_URL: process.env.SINTR_E2E_DATABASE_URL,
  SINTR_AUTH_SECRET: process.env.SINTR_E2E_AUTH_SECRET,
  SINTR_MASTER_KEY: process.env.SINTR_E2E_MASTER_KEY,
  SINTR_MASTER_KEY_ID: "k1",
  SINTR_LOG_LEVEL: "warn",
  SINTR_FAKE_AGENT: "1",
  SINTR_EMAIL_OUTBOX: process.env.SINTR_E2E_OUTBOX,
  ...(process.env.SINTR_CHROMIUM_PATH ? { SINTR_CHROMIUM_PATH: process.env.SINTR_CHROMIUM_PATH } : {}),
};

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: url, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `pnpm run build && pnpm exec next start --hostname 127.0.0.1 --port ${port}`,
      url,
      timeout: 240_000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      // A self-host without a house assistant or payments, whatever the local .env says.
      env: { ...shared, SINTR_URL: url, ...WITHOUT_HOUSE },
    },
    {
      // The same build, started once the first server is up (and so the build is done).
      command: `node e2e/when-up.mjs ${url}/api/health && pnpm exec next start --hostname 127.0.0.1 --port ${housePort}`,
      url: houseUrl,
      timeout: 300_000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...shared,
        SINTR_URL: houseUrl,
        SINTR_HOUSE_PROVIDER: "anthropic",
        SINTR_HOUSE_MODEL: "claude-house-e2e",
        SINTR_HOUSE_KEY: process.env.SINTR_E2E_HOUSE_KEY,
        SINTR_HOUSE_NAME: "Anthropic",
        SINTR_STRIPE_SECRET_KEY: "sk_test_e2e",
        SINTR_STRIPE_WEBHOOK_SECRET: process.env.SINTR_E2E_WEBHOOK_SECRET,
        SINTR_STRIPE_PRICE_PERSONAL: "price_e2epersonal",
        SINTR_STRIPE_PRICE_PRACTICE_SEAT: "price_e2eseat",
        SINTR_STRIPE_API_URL: process.env.SINTR_E2E_STRIPE_URL,
        // As on the hosted offer: one seat for a practice without a plan of its own.
        SINTR_PRACTICE_SEATS: "1",
        SINTR_PRACTICE_PLAN: "Free",
      },
    },
  ],
});
