import { sql } from "drizzle-orm";
import type { Config } from "../config";
import { createDatabase, type DatabaseHandle } from "../db/client";
import { createLogger, type Logger } from "../log";
import { purgeExpiredAuthRecords, purgeExpiredConversations } from "../maintenance";
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
  purgeExpiredAuthRecords(): Promise<{ sessions: number; verificationTokens: number }>;
  /** Conversations past their owner's retention setting (agent_settings). */
  purgeExpiredConversations(): Promise<{ conversations: number }>;
  /** Readiness: true when the database answers. */
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export interface RuntimeOptions {
  service: string;
  poolSize?: number;
}

/** @internal Shared by createBaseRuntime and createRuntime. */
export function openBaseRuntime(
  config: Config,
  options: RuntimeOptions,
): { base: BaseRuntime; database: DatabaseHandle } {
  const log = createLogger({ level: config.logLevel, service: options.service });
  const database = createDatabase(config.databaseUrl, { max: options.poolSize ?? 10 });
  const base: BaseRuntime = {
    config,
    log,
    repositories: createRepositories(database.db, config.masterKey),
    purgeExpiredAuthRecords: () => purgeExpiredAuthRecords(database.db),
    purgeExpiredConversations: () => purgeExpiredConversations(database.db),
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
