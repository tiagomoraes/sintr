import { eq } from "drizzle-orm";
import { createFieldCipher, type MasterKey } from "../crypto";
import type { Database } from "../db/client";
import { profiles, therapySettings, users } from "../db/schema";
import { sanitizeError } from "../errors";
import type { ScopeContext } from "./context";
import { conversationsRepository } from "./conversations";
import { loadDataKey } from "./data-keys";
import { apiTokensRepository, auditLogRepository } from "./integration";
import { checkinsRepository, entriesRepository, insightsRepository, therapyNotesRepository } from "./ledger";
import { consentsRepository, reportsRepository } from "./reports";
import { profileRepository, therapySettingsRepository } from "./settings";

export { API_TOKEN_PREFIX, hashApiToken } from "./integration";
export type { ListRange } from "./ledger";

/**
 * Data access for one user. Every repository below is bound to `userId` at
 * construction and adds it to every query; none accepts another user's id.
 */
export interface UserScope {
  readonly userId: string;
  readonly profile: ReturnType<typeof profileRepository>;
  readonly therapySettings: ReturnType<typeof therapySettingsRepository>;
  readonly entries: ReturnType<typeof entriesRepository>;
  readonly checkins: ReturnType<typeof checkinsRepository>;
  readonly therapyNotes: ReturnType<typeof therapyNotesRepository>;
  readonly insights: ReturnType<typeof insightsRepository>;
  readonly reports: ReturnType<typeof reportsRepository>;
  readonly consents: ReturnType<typeof consentsRepository>;
  readonly conversations: ReturnType<typeof conversationsRepository>;
  readonly apiTokens: ReturnType<typeof apiTokensRepository>;
  readonly auditLog: ReturnType<typeof auditLogRepository>;
  /** Run several operations atomically, with the same scope. */
  transaction<T>(fn: (scope: UserScope) => Promise<T>): Promise<T>;
  /** Hard delete: the account and, by cascade, every row it owns. */
  deleteAccount(): Promise<void>;
}

export interface Repositories {
  forUser(userId: string): Promise<UserScope>;
  /** Create the key, profile and therapy settings rows of a new user. */
  provision(userId: string): Promise<void>;
}

/** Wrap every method so driver errors leave the core sanitized. */
function guard<T extends object>(repository: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(repository)) {
    out[key] =
      typeof value === "function"
        ? async (...args: unknown[]) => {
            try {
              return await (value as (...a: unknown[]) => Promise<unknown>)(...args);
            } catch (error) {
              throw sanitizeError(error);
            }
          }
        : value;
  }
  return out as T;
}

function buildScope(ctx: ScopeContext): UserScope {
  return {
    userId: ctx.userId,
    profile: guard(profileRepository(ctx)),
    therapySettings: guard(therapySettingsRepository(ctx)),
    entries: guard(entriesRepository(ctx)),
    checkins: guard(checkinsRepository(ctx)),
    therapyNotes: guard(therapyNotesRepository(ctx)),
    insights: guard(insightsRepository(ctx)),
    reports: guard(reportsRepository(ctx)),
    consents: guard(consentsRepository(ctx)),
    conversations: guard(conversationsRepository(ctx)),
    apiTokens: guard(apiTokensRepository(ctx)),
    auditLog: guard(auditLogRepository(ctx)),
    async transaction(fn) {
      try {
        return await ctx.db.transaction((tx) => fn(buildScope({ ...ctx, db: tx })));
      } catch (error) {
        throw sanitizeError(error);
      }
    },
    async deleteAccount() {
      try {
        await ctx.db.delete(users).where(eq(users.id, ctx.userId));
      } catch (error) {
        throw sanitizeError(error);
      }
    },
  };
}

export function createRepositories(db: Database, masterKey: MasterKey): Repositories {
  return {
    async forUser(userId) {
      try {
        const dek = await loadDataKey(db, masterKey, userId);
        return buildScope({ db, userId, cipher: createFieldCipher(dek, userId) });
      } catch (error) {
        throw sanitizeError(error);
      }
    },

    async provision(userId) {
      try {
        await loadDataKey(db, masterKey, userId);
        await db.insert(profiles).values({ userId }).onConflictDoNothing();
        await db.insert(therapySettings).values({ userId }).onConflictDoNothing();
      } catch (error) {
        throw sanitizeError(error);
      }
    },
  };
}
