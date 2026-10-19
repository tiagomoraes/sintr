import { sql } from "drizzle-orm";
import type { Config } from "../config";
import { createDatabase, type DatabaseHandle } from "../db/client";
import { createEmailTransport, type EmailTransport } from "../email";
import { createLogger, type Logger } from "../log";
import { purgeExpiredAuthRecords, purgeExpiredConversations, purgeStaleInvites } from "../maintenance";
import { sendPracticeNotices } from "../practice/notices";
import { reportSchedules, type PersonSchedule } from "../report/schedules";
import { createRepositories, type Repositories } from "../repositories";

/**
 * What every shell gets: configuration, the redacting logger, user-scoped
 * repositories and a few named operations. No shell receives the raw
 * database handle. This part has no auth dependency, so the worker bundle
 * stays free of Better Auth and native password hashing.
 */
export interface BaseRuntime {
  readonly config: Config;
  readonly log: Logger;
  readonly repositories: Repositories;
  /** How email leaves this installation (`available` is false when it is off). */
  readonly email: EmailTransport;
  /** Everyone with a therapy session to prepare a report for. Clear metadata only. */
  reportSchedules(now?: Date): Promise<PersonSchedule[]>;
  purgeExpiredAuthRecords(): Promise<{ sessions: number; verificationTokens: number }>;
  /** Conversations past their owner's retention setting (agent_settings). */
  purgeExpiredConversations(): Promise<{ conversations: number }>;
  /** Invites a month past being usable. */
  purgeStaleInvites(now?: Date): Promise<{ invites: number }>;
  /** Email professionals who asked for it that reports arrived (a link and a count). */
  notifyPractices(now?: Date): Promise<{ sent: number }>;
  /** Readiness: true when the database answers. */
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export interface RuntimeOptions {
  service: string;
  poolSize?: number;
  /** Replace the configured transport (tests). */
  email?: EmailTransport;
}

/** @internal Shared by createBaseRuntime and createRuntime. */
export function openBaseRuntime(
  config: Config,
  options: RuntimeOptions,
): { base: BaseRuntime; database: DatabaseHandle } {
  const log = createLogger({ level: config.logLevel, service: options.service });
  const database = createDatabase(config.databaseUrl, { max: options.poolSize ?? 10 });
  const emailTransport = options.email ?? createEmailTransport(config.email);
  const base: BaseRuntime = {
    config,
    log,
    repositories: createRepositories(database.db, config.masterKey, { practiceDefaults: config.practice }),
    email: emailTransport,
    reportSchedules: (now) => reportSchedules(database.db, now),
    purgeExpiredAuthRecords: () => purgeExpiredAuthRecords(database.db),
    purgeExpiredConversations: () => purgeExpiredConversations(database.db),
    purgeStaleInvites: (now) => purgeStaleInvites(database.db, now),
    notifyPractices: (now) =>
      sendPracticeNotices({
        db: database.db,
        email: emailTransport,
        origin: config.url.origin,
        log,
        ...(now ? { now } : {}),
      }),
    async ping() {
      try {
        await database.db.execute(sql`select 1`);
        return true;
      } catch {
        return false;
      }
    },
    close: () => database.close(),
  };
  return { base, database };
}

export function createBaseRuntime(config: Config, options: RuntimeOptions): BaseRuntime {
  return openBaseRuntime(config, options).base;
}
