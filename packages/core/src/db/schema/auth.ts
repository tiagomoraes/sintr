import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "../columns";

/**
 * Authentication tables, managed by Better Auth through the Drizzle adapter.
 * Property names follow Better Auth's field names; SQL names are snake_case.
 *
 * Minimisation: `users.name` is kept empty. A display name, when the person
 * gives one, lives encrypted in `profiles.display_name`.
 */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** The tenant scope column: mandatory, cascades on account deletion. */
export const ownerId = () =>
  text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: ownerId(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: ownerId(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)],
);

/**
 * Short-lived verification values (email verification, password reset).
 * They exist before a user does, so this is the one table keyed by
 * `identifier` instead of `user_id`. It holds no ledger content.
 */
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_tokens_identifier_idx").on(t.identifier)],
);
