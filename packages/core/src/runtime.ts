import { sql } from "drizzle-orm";
import { authenticateApiToken, createAuth, type ApiTokenPrincipal, type Auth } from "./auth";
import type { Config } from "./config";
import { createDatabase } from "./db/client";
import { createLogger, type Logger } from "./log";
import { purgeExpiredAuthRecords } from "./maintenance";
import { createRepositories, type Repositories } from "./repositories";

/**
 * The composition root shared by the web app and the worker. Shells get
 * auth, user-scoped repositories and a few named operations; none of them
 * receives the raw database handle.
 */
export interface Runtime {
  readonly config: Config;
  readonly log: Logger;
  readonly auth: Auth;
  readonly repositories: Repositories;
  authenticateApiToken(token: string): Promise<ApiTokenPrincipal | null>;
  purgeExpiredAuthRecords(): Promise<{ sessions: number; verificationTokens: number }>;
  /** Readiness: true when the database answers. */
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export function createRuntime(config: Config, options: { service: string; poolSize?: number }): Runtime {
  const log = createLogger({ level: config.logLevel, service: options.service });
  const database = createDatabase(config.databaseUrl, { max: options.poolSize ?? 10 });
  return {
    config,
    log,
    auth: createAuth({ db: database.db, config, logger: log }),
    repositories: createRepositories(database.db, config.masterKey),
    authenticateApiToken: (token) => authenticateApiToken(database.db, token),
    purgeExpiredAuthRecords: () => purgeExpiredAuthRecords(database.db),
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
}
