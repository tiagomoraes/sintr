/**
 * One MCP server for one token: the instructions, and the tools that
 * token's scopes allow (the others are not even listed). Built per request,
 * so nothing of one person's call outlives it.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { NotFoundError, ValidationError } from "@sintr/core";
import { instructions } from "./instructions";
import { Refusal, TOOLS, callTool, permits, type SintrTool, type ToolContext } from "./tools";

export const SERVER_INFO = { name: "sintr", title: "sintr", version: "0.3.0" } as const;

function text(value: unknown, isError = false): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }], ...(isError ? { isError } : {}) };
}

/**
 * Run a tool and answer the way an agent can act on: the result as JSON, or
 * `isError` with reasons. Reasons name fields and rules, never the person's
 * words; what failed inside sintr is logged as a code and answered plainly.
 */
export async function answerTool(
  tool: SintrTool,
  args: unknown,
  context: ToolContext,
): Promise<CallToolResult> {
  const started = Date.now();
  const done = (status: string) =>
    context.log.info("mcp.tool", {
      code: tool.name,
      status,
      tokenId: context.tokenId,
      durationMs: Date.now() - started,
    });
  try {
    const result = await callTool(tool, args, context);
    done("ok");
    return text(result);
  } catch (error) {
    if (error instanceof Refusal) {
      done("refused");
      return text(
        { saved: tool.readOnly ? undefined : false, refused: true, problems: error.problems },
        true,
      );
    }
    if (error instanceof NotFoundError) {
      done("not_found");
      return text(
        { refused: true, problems: [`${error.message}: nothing with this id in this person's diary`] },
        true,
      );
    }
    if (error instanceof ValidationError) {
      done("refused");
      return text(
        { refused: true, problems: error.fields.map((field) => `${field}: not a valid value`) },
        true,
      );
    }
    context.log.warn("mcp.tool_failed", { code: tool.name, tokenId: context.tokenId, error });
    return text(
      {
        refused: false,
        problems: ["sintr could not do this just now, and nothing was changed. Try again in a moment."],
      },
      true,
    );
  }
}

export function createSintrServer(context: ToolContext): McpServer {
  const server = new McpServer(SERVER_INFO, {
    instructions: instructions(context.scopes),
    capabilities: { tools: { listChanged: false } },
  });
  for (const tool of TOOLS) {
    if (!permits(tool.needs, context.scopes)) continue;
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        annotations: {
          title: tool.title,
          readOnlyHint: tool.readOnly,
          destructiveHint: false,
          idempotentHint: tool.readOnly,
          openWorldHint: false,
        },
      },
      (args) => answerTool(tool, args, context),
    );
  }
  return server;
}
