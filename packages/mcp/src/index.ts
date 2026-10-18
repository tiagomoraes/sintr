/**
 * The MCP surface of sintr (milestone F3): the second way into the diary,
 * from the agent a person already uses. The web app mounts the HTTP
 * endpoint (`createMcpHandler`) at `/mcp`; local clients reach it through
 * the stdio bridge (`src/stdio.ts`, bundled to `dist/sintr-mcp.mjs`).
 *
 * Rules the server follows:
 * - every call carries an API token (scoped per data type, revocable,
 *   stored hashed) and runs inside that token owner's `UserScope`;
 * - a tool is listed and runs only when the token's scopes allow it;
 * - writes are held to the embedded assistant's capture rules (the
 *   person's own words, no invented numbers, the crisis screen first);
 * - nothing is sent to anyone from MCP, the therapist included;
 * - tool results carry the person's words verbatim, never paraphrased.
 */
export {
  DEFAULT_LIMITS,
  createMcpHandler,
  type McpHandler,
  type McpHandlerOptions,
  type McpLimits,
} from "./http";
export { CRISIS_PROTOCOL, accessSentence, instructions } from "./instructions";
export { RateLimiter } from "./limits";
export { SERVER_INFO, answerTool, createSintrServer } from "./server";
export {
  LIMITS,
  Refusal,
  TOOLS,
  callTool,
  findTool,
  permits,
  type Needs,
  type SintrTool,
  type ToolContext,
} from "./tools";
