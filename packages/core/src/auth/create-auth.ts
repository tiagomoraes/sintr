import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { Config } from "../config";
import type { Database } from "../db/client";
import { accounts, sessions, users, verificationTokens } from "../db/schema";
import { HEALTH_DATA_CONSENT_VERSION } from "../domain";
import type { Logger } from "../log";
import { createRepositories } from "../repositories";
import { hashPassword, verifyPassword } from "./password";

export interface AuthOptions {
  db: Database;
  config: Config;
  logger: Logger;
}

const DAY = 60 * 60 * 24;
const EMAIL = /[^\s@"'<>]+@[^\s@"'<>]+/g;

/**
 * Endpoints the product does not use yet. Email delivery (verification,
 * password reset, magic link) arrives with the email transport; until then
 * those routes are closed rather than half working. `update-user` stays
 * closed so `users.name` keeps holding nothing.
 */
export const DISABLED_AUTH_PATHS = [
  "/update-user",
  "/delete-user",
  "/change-email",
  "/request-password-reset",
  "/reset-password",
  "/send-verification-email",
  "/verify-email",
  "/sign-in/social",
  "/link-social",
];

export function createAuth({ db, config, logger }: AuthOptions) {
  const repositories = createRepositories(db, config.masterKey);
  const log = logger.child({ service: "auth" });

  return betterAuth({
    appName: "sintr",
    baseURL: config.url.origin,
    basePath: "/api/auth",
    secret: config.authSecret,
    trustedOrigins: [config.url.origin],
    telemetry: { enabled: false },
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { users, sessions, accounts, verificationTokens },
    }),
    user: { modelName: "users" },
    session: {
      modelName: "sessions",
      // Sliding sessions: a session used after `updateAge` is extended, an
      // idle one expires. Every sign-in issues a new token.
      expiresIn: 7 * DAY,
      updateAge: DAY,
      freshAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    account: { modelName: "accounts" },
    verification: { modelName: "verificationTokens" },
    emailAndPassword: {
      enabled: true,
      disableSignUp: config.signup === "closed",
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: true,
      revokeSessionsOnPasswordReset: true,
      password: { hash: hashPassword, verify: verifyPassword },
    },
    rateLimit: {
      enabled: true,
      storage: "memory",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 600, max: 10 },
      },
    },
    disabledPaths: DISABLED_AUTH_PATHS,
    advanced: {
      cookiePrefix: "sintr",
      useSecureCookies: config.url.protocol === "https:",
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
    },
    logger: {
      level: "warn",
      log: (level, message) => {
        const fields = { authMessage: message.replace(EMAIL, "[email]").slice(0, 160) };
        if (level === "error") log.error("auth.log", fields);
        else if (level === "warn") log.warn("auth.log", fields);
        else log.debug("auth.log", fields);
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        // LGPD art. 11: specific consent before any health data is kept.
        if (body.consent !== true) {
          throw new APIError("BAD_REQUEST", { message: "consent_required", code: "CONSENT_REQUIRED" });
        }
        // Minimisation: the auth table keeps no name.
        return { context: { ...ctx, body: { ...body, name: "" } } };
      }),
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user, ctx) => {
            await repositories.provision(user.id);
            const scope = await repositories.forUser(user.id);
            if (ctx?.path === "/sign-up/email") {
              const consent = await scope.consents.record({
                purpose: "health_data_processing",
                version: HEALTH_DATA_CONSENT_VERSION,
                granted: true,
              });
              await scope.auditLog.record({
                action: "consent.recorded",
                targetType: "consent",
                targetId: consent.id,
                metadata: { purpose: "health_data_processing", version: HEALTH_DATA_CONSENT_VERSION },
              });
            }
            await scope.auditLog.record({ action: "account.created" });
            log.info("auth.account_created", { userId: user.id });
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            const scope = await repositories.forUser(session.userId);
            await scope.auditLog.record({ action: "session.created", targetType: "session" });
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
