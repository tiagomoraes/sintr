import "server-only";
import { createMcpHandler, type McpHandler } from "@sintr/mcp";
import { runtime } from "./runtime";

const holder = globalThis as typeof globalThis & { __sintrMcp?: McpHandler };

/**
 * The MCP endpoint of this process. One handler, so its limits (calls per
 * key, wrong keys per address) count across requests. The token is its
 * only credential: it never reads the session cookie.
 */
export function mcpHandler(): McpHandler {
  holder.__sintrMcp ??= createMcpHandler({
    authenticate: (token, use) => runtime().authenticateApiToken(token, use),
    repositories: runtime().repositories,
    appUrl: runtime().config.url,
    log: runtime().log.child({ route: "/mcp" }),
  });
  return holder.__sintrMcp;
}
