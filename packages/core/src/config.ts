import { z } from "zod";
import { parseMasterKey, type MasterKey } from "./crypto/keys";
import type { PracticePlan } from "./domain";
import type { EmailConfig } from "./email/transport";
import type { LogLevel } from "./log";

/**
 * Runtime configuration, read from the environment. Self-host and SaaS run
 * the same code; `SINTR_MODE` is the switch between them. Every variable is
 * documented in `.env.example`.
 */

const EnvSchema = z.object({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// URL"),
  SINTR_URL: z.url().default("http://localhost:3000"),
  SINTR_MODE: z.enum(["selfhost", "saas"]).default("selfhost"),
  SINTR_SIGNUP: z.enum(["open", "closed"]).default("open"),
  SINTR_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  SINTR_MASTER_KEY: z.string().min(1, "is required"),
  SINTR_MASTER_KEY_ID: z.string().default("k1"),
  SINTR_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  // Tests only (commented out in .env.example): see `fakeAgent` below.
  SINTR_FAKE_AGENT: z.enum(["0", "1"]).default("0"),
  // Email (optional): an SMTP server for the report send, notices, password
  // reset and email verification. Without it, those features say they are off.
  SINTR_SMTP_HOST: z
    .string()
    .regex(/^[A-Za-z0-9.-]+$/, "must be a host name")
    .optional(),
  SINTR_SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
  SINTR_SMTP_SECURITY: z.enum(["starttls", "tls", "none"]).default("starttls"),
  SINTR_SMTP_USER: z.string().optional(),
  SINTR_SMTP_PASSWORD: z.string().optional(),
  SINTR_EMAIL_FROM: z
    .string()
    .regex(/^[^\r\n]*@[^\r\n]*$/, "must be an address, such as sintr <diary@example.com>")
    .optional(),
  // Tests only: write emails to this directory instead of sending them.
  SINTR_EMAIL_OUTBOX: z.string().optional(),
  // The Chromium that prints reports; Playwright's own when unset.
  SINTR_CHROMIUM_PATH: z.string().optional(),
  // The seats of a practice that has no grant of its own: a number, or
  // "unlimited". Unlimited on a self-host; none on the hosted offer until granted.
  SINTR_PRACTICE_SEATS: z
    .string()
    .regex(/^(unlimited|\d{1,6})$/, 'must be a whole number or "unlimited"')
    .optional(),
  // The name of that plan, as the practice sees it.
  SINTR_PRACTICE_PLAN: z.string().min(1).max(60).optional(),
});

export interface Config {
  databaseUrl: string;
  url: URL;
  mode: "selfhost" | "saas";
  signup: "open" | "closed";
  authSecret: string;
  masterKey: MasterKey;
  logLevel: LogLevel;
  /**
   * Replace every assistant provider with a scripted, offline one, so the
   * end-to-end tests never reach a real model. The app says so on screen.
   * Refused in SaaS mode.
   */
  fakeAgent: boolean;
  /** How email leaves this installation, if at all. */
  email: EmailConfig;
  /** A Chromium binary to print reports with; null uses Playwright's own. */
  chromiumPath: string | null;
  /** The plan and seats of a practice without a grant (seats null: unlimited). */
  practice: PracticePlan;
}

export class ConfigError extends Error {
  override readonly name = "ConfigError";
}

/**
 * Validate the environment. Error messages name the variables only, never
 * their values, so a misconfigured secret is not echoed into logs.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  // An empty value in .env means "not set".
  const given = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ""));
  const parsed = EnvSchema.safeParse(given);
  if (!parsed.success) {
    // Zod 4 issue messages describe the expectation, not the received value.
    const problems = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`,
    );
    throw new ConfigError(`invalid configuration: ${problems.join("; ")}`);
  }
  const e = parsed.data;
  if (e.SINTR_FAKE_AGENT === "1" && e.SINTR_MODE === "saas") {
    throw new ConfigError("invalid configuration: SINTR_FAKE_AGENT: is not allowed in saas mode");
  }
  if (e.SINTR_EMAIL_OUTBOX && e.SINTR_MODE === "saas") {
    throw new ConfigError("invalid configuration: SINTR_EMAIL_OUTBOX: is not allowed in saas mode");
  }
  if (e.SINTR_SMTP_HOST && !e.SINTR_EMAIL_FROM) {
    throw new ConfigError("invalid configuration: SINTR_EMAIL_FROM: is required with SINTR_SMTP_HOST");
  }
  if (e.SINTR_SMTP_HOST && e.SINTR_SMTP_SECURITY === "none" && e.SINTR_MODE === "saas") {
    throw new ConfigError("invalid configuration: SINTR_SMTP_SECURITY: none is not allowed in saas mode");
  }
  const from = e.SINTR_EMAIL_FROM ?? "sintr <sintr@localhost>";
  const email: EmailConfig = e.SINTR_EMAIL_OUTBOX
    ? { kind: "outbox", dir: e.SINTR_EMAIL_OUTBOX, from }
    : e.SINTR_SMTP_HOST
      ? {
          kind: "smtp",
          host: e.SINTR_SMTP_HOST,
          port: e.SINTR_SMTP_PORT,
          security: e.SINTR_SMTP_SECURITY,
          user: e.SINTR_SMTP_USER ?? null,
          password: e.SINTR_SMTP_PASSWORD ?? null,
          from,
        }
      : { kind: "off" };
  let masterKey: MasterKey;
  try {
    masterKey = parseMasterKey(e.SINTR_MASTER_KEY, e.SINTR_MASTER_KEY_ID);
  } catch (error) {
    throw new ConfigError(`invalid configuration: SINTR_MASTER_KEY: ${(error as Error).message}`);
  }
  const seats = e.SINTR_PRACTICE_SEATS ?? (e.SINTR_MODE === "saas" ? "0" : "unlimited");
  const practice: PracticePlan = {
    plan: e.SINTR_PRACTICE_PLAN ?? (e.SINTR_MODE === "saas" ? "Hosted" : "Self-hosted"),
    seats: seats === "unlimited" ? null : Number(seats),
  };
  return {
    databaseUrl: e.DATABASE_URL,
    url: new URL(e.SINTR_URL),
    mode: e.SINTR_MODE,
    signup: e.SINTR_SIGNUP,
    authSecret: e.SINTR_AUTH_SECRET,
    masterKey,
    logLevel: e.SINTR_LOG_LEVEL,
    fakeAgent: e.SINTR_FAKE_AGENT === "1",
    email,
    chromiumPath: e.SINTR_CHROMIUM_PATH ?? null,
    practice,
  };
}
