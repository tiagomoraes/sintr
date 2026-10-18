import { authenticateApiToken, createAuth, type ApiTokenPrincipal, type Auth } from "../auth";
import type { Config } from "../config";
import { openBaseRuntime, type BaseRuntime, type RuntimeOptions } from "./base";

export { createBaseRuntime, type BaseRuntime, type RuntimeOptions } from "./base";

/** The web shell's runtime: the base plus Better Auth and API token lookup. */
export interface Runtime extends BaseRuntime {
  readonly auth: Auth;
  /** Resolve an MCP bearer token; `client` is the name the client gave at `initialize`. */
  authenticateApiToken(token: string, use?: { client?: string | null }): Promise<ApiTokenPrincipal | null>;
}

export function createRuntime(config: Config, options: RuntimeOptions): Runtime {
  const { base, database } = openBaseRuntime(config, options);
  return {
    ...base,
    auth: createAuth({ db: database.db, config, logger: base.log, email: base.email }),
    authenticateApiToken: (token, use) => authenticateApiToken(database.db, token, use),
  };
}
