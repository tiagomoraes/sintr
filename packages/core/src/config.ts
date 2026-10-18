import { z } from "zod";
import { parseMasterKey, type MasterKey } from "./crypto/keys";
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
});

export interface Config {
  databaseUrl: string;
  url: URL;
  mode: "selfhost" | "saas";
  signup: "open" | "closed";
  authSecret: string;
  masterKey: MasterKey;
  logLevel: LogLevel;
}

export class ConfigError extends Error {
  override readonly name = "ConfigError";
}

/**
 * Validate the environment. Error messages name the variables only, never
 * their values, so a misconfigured secret is not echoed into logs.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    // Zod 4 issue messages describe the expectation, not the received value.
    const problems = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`,
    );
    throw new ConfigError(`invalid configuration: ${problems.join("; ")}`);
  }
  const e = parsed.data;
  let masterKey: MasterKey;
  try {
    masterKey = parseMasterKey(e.SINTR_MASTER_KEY, e.SINTR_MASTER_KEY_ID);
  } catch (error) {
    throw new ConfigError(`invalid configuration: SINTR_MASTER_KEY: ${(error as Error).message}`);
  }
  return {
    databaseUrl: e.DATABASE_URL,
    url: new URL(e.SINTR_URL),
    mode: e.SINTR_MODE,
    signup: e.SINTR_SIGNUP,
    authSecret: e.SINTR_AUTH_SECRET,
    masterKey,
    logLevel: e.SINTR_LOG_LEVEL,
  };
}
