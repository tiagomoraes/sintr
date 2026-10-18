import { mcpHandler } from "@/lib/server/mcp";

export const dynamic = "force-dynamic";

/**
 * MCP over Streamable HTTP, for an agent the person connected: the key goes
 * in `Authorization: Bearer`. Stateless; see packages/mcp/src/http.ts.
 */
function handle(request: Request): Promise<Response> {
  return mcpHandler()(request);
}

export { handle as DELETE, handle as GET, handle as POST };
