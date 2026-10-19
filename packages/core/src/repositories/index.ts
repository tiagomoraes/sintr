import { eq } from "drizzle-orm";
import { createFieldCipher, type MasterKey } from "../crypto";
import type { Database } from "../db/client";
import { profiles, therapySettings, users } from "../db/schema";
import type { InvitePreview, PlanId, PracticePlan } from "../domain";
import { sanitizeError } from "../errors";
import { agentSettingsRepository, proposalsRepository } from "./agent";
import { conversationsRepository } from "./conversations";
import { loadDataKey } from "./data-keys";
import { apiTokensRepository, auditLogRepository } from "./integration";
import { checkinsRepository, entriesRepository, insightsRepository, therapyNotesRepository } from "./ledger";
import type { SharingContext } from "./links";
import { memoriesRepository } from "./memories";
import { plansRepository } from "./plans";
import { practiceRepository } from "./practice";
import { consentsRepository, reportsRepository } from "./reports";
import { profileRepository, therapySettingsRepository } from "./settings";
import { noticesRepository, previewInvite, sharingRepository } from "./sharing";

export { API_TOKEN_PREFIX, hashApiToken } from "./integration";
export type { ListRange } from "./ledger";
export type { AcceptInvite } from "./sharing";
export { practiceLine } from "./links";
export { MEMORIES_PER_SOURCE, spaceId, type NearMemory, type ReadSource } from "./memories";
export { decodeSubscription, resolvePlan, usagePeriod } from "./plans";

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
  readonly agentSettings: ReturnType<typeof agentSettingsRepository>;
  readonly proposals: ReturnType<typeof proposalsRepository>;
  readonly apiTokens: ReturnType<typeof apiTokensRepository>;
  readonly auditLog: ReturnType<typeof auditLogRepository>;
  /** The practice this account opened, if any: the professional's side. */
  readonly practice: ReturnType<typeof practiceRepository>;
  /** The person's links with practices and what they share through them. */
  readonly sharing: ReturnType<typeof sharingRepository>;
  readonly notices: ReturnType<typeof noticesRepository>;
  /** The person's plan, and how much of the house assistant they used this month. */
  readonly plans: ReturnType<typeof plansRepository>;
  /** What sintr remembers of the person, for their own assistant (F10). */
  readonly memories: ReturnType<typeof memoriesRepository>;
  /** Run several operations atomically, with the same scope. */
  transaction<T>(fn: (scope: UserScope) => Promise<T>): Promise<T>;
  /** Hard delete: the account and, by cascade, every row it owns. */
  deleteAccount(): Promise<void>;
}

export interface Repositories {
  forUser(userId: string): Promise<UserScope>;
  /** Create the key, profile and therapy settings rows of a new user. */
  provision(userId: string): Promise<void>;
  /** Who is inviting with this code, for /join; `viewerId` is the signed-in account, if any. */
  previewInvite(code: string, viewerId: string | null, now?: Date): Promise<InvitePreview>;
}

export interface RepositoryOptions {
  /** The plan and seats of a practice without a grant of its own. Unlimited by default. */
  practiceDefaults?: PracticePlan;
  /** The plan of a person without a subscription or a grant. Free by default. */
  personPlan?: PlanId;
}

type BuildContext = SharingContext & { readonly personPlan: PlanId };

export const SELF_HOST_PLAN: PracticePlan = { plan: "Self-hosted", seats: null };

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

function buildScope(ctx: BuildContext): UserScope {
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
    agentSettings: guard(agentSettingsRepository(ctx)),
    proposals: guard(proposalsRepository(ctx)),
    apiTokens: guard(apiTokensRepository(ctx)),
    auditLog: guard(auditLogRepository(ctx)),
    practice: guard(practiceRepository(ctx)),
    sharing: guard(sharingRepository(ctx)),
    notices: guard(noticesRepository(ctx)),
    plans: guard(plansRepository(ctx)),
    memories: guard(memoriesRepository(ctx)),
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

export function createRepositories(
  db: Database,
  masterKey: MasterKey,
  options: RepositoryOptions = {},
): Repositories {
  const practiceDefaults = options.practiceDefaults ?? SELF_HOST_PLAN;
  const personPlan = options.personPlan ?? "free";
  return {
    async forUser(userId) {
      try {
        const dek = await loadDataKey(db, masterKey, userId);
        return buildScope({
          db,
          userId,
          cipher: createFieldCipher(dek, userId),
          kek: masterKey,
          practiceDefaults,
          personPlan,
        });
      } catch (error) {
        throw sanitizeError(error);
      }
    },

    async previewInvite(code, viewerId, now) {
      try {
        return await previewInvite(db, { kek: masterKey }, code, viewerId, now);
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
