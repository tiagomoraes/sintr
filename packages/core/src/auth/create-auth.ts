import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { Config } from "../config";
import type { Database } from "../db/client";
import { accounts, sessions, users, verificationTokens } from "../db/schema";
import { HEALTH_DATA_CONSENT_VERSION } from "../domain";
import {
  emailOff,
  passwordResetEmail,
  verificationEmail,
  type EmailMessage,
  type EmailTransport,
} from "../email";
import { personLanguage } from "../language";
import type { Logger } from "../log";
import { createRepositories } from "../repositories";
import { hashPassword, verifyPassword } from "./password";

export interface AuthOptions {
  db: Database;
  config: Config;
  logger: Logger;
  /** Password reset and email verification are on only when email is available. */
  email?: EmailTransport;
  /**
   * The language a request is read in, as the web's pages resolve it: the
   * person's own choice, the installation's language, the browser's
   * (DECISIONS 98). `chosen` says it was the person's choice. Without it,
   * emails follow the profile and the installation.
   */
  languageFor?: (headers: Headers, userId: string | null) => Promise<RequestLanguage>;
}

export interface RequestLanguage {
  code: string;
  chosen: boolean;
}

const DAY = 60 * 60 * 24;
const EMAIL = /[^\s@"'<>]+@[^\s@"'<>]+/g;

/**
 * Endpoints the product does not use. `update-user` stays closed so
 * `users.name` keeps holding nothing; changing the email and the magic link
 * are not offered yet.
 */
export const DISABLED_AUTH_PATHS = [
  "/update-user",
  "/delete-user",
  "/change-email",
  "/sign-in/social",
  "/link-social",
];

/**
 * Password reset and email verification need email. Without a transport
 * they are closed rather than half working (and links are never logged).
 */
export const EMAIL_AUTH_PATHS = [
  "/request-password-reset",
  "/reset-password",
  "/reset-password/:token",
  "/send-verification-email",
  "/verify-email",
];

const HOUR = 60 * 60;

export function createAuth({ db, config, logger, email = emailOff, languageFor }: AuthOptions) {
  const repositories = createRepositories(db, config.masterKey);
  const log = logger.child({ service: "auth" });
  // Sending is not awaited and never throws back: neither a failure nor the
  // time a mail server takes (or finding the person's language) may tell the
  // browser whether an address has an account. Only codes are logged.
  const deliver = async (message: () => Promise<EmailMessage>, kind: string) => {
    void message()
      .then((built) => email.send(built))
      .then(
        () => log.info("auth.email_sent", { code: kind }),
        (error: unknown) => log.warn("auth.email_failed", { code: kind, error }),
      );
  };
  // The language of an email about the account: as the request is read, else as the profile says.
  const languageOf = async (userId: string, request: Request | undefined): Promise<string | null> => {
    if (request && languageFor) return (await languageFor(request.headers, userId)).code;
    try {
      return personLanguage(await (await repositories.forUser(userId)).profile.get(), config.language);
    } catch {
      return config.language;
    }
  };

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
      resetPasswordTokenExpiresIn: HOUR,
      ...(email.available
        ? {
            sendResetPassword: async (
              { user, url }: { user: { id: string; email: string }; url: string },
              request?: Request,
            ) =>
              deliver(
                async () =>
                  passwordResetEmail({ to: user.email, url, language: await languageOf(user.id, request) }),
                "password_reset",
              ),
          }
        : {}),
    },
    ...(email.available
      ? {
          emailVerification: {
            sendOnSignUp: true,
            autoSignInAfterVerification: true,
            expiresIn: HOUR,
            sendVerificationEmail: async (
              { user, url }: { user: { id: string; email: string }; url: string },
              request?: Request,
            ) =>
              deliver(
                async () =>
                  verificationEmail({ to: user.email, url, language: await languageOf(user.id, request) }),
                "verification",
              ),
          },
        }
      : {}),
    rateLimit: {
      enabled: true,
      storage: "memory",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 600, max: 10 },
        "/request-password-reset": { window: 600, max: 5 },
        "/send-verification-email": { window: 600, max: 5 },
      },
    },
    disabledPaths: email.available ? DISABLED_AUTH_PATHS : [...DISABLED_AUTH_PATHS, ...EMAIL_AUTH_PATHS],
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
            // The language the sign-up page was read in is the one sintr spoke to them in; one they
            // chose on the way there (DECISIONS 98) is their choice from the start.
            const headers = ctx?.headers ?? ctx?.request?.headers;
            if (languageFor && headers) {
              const language = await languageFor(headers, null);
              await scope.profile.update({
                seenLocale: language.code,
                ...(language.chosen ? { locale: language.code } : {}),
              });
            }
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
