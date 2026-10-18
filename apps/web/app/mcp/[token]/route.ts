import { mcpHandler } from "@/lib/server/mcp";

export const dynamic = "force-dynamic";

/**
 * The same endpoint with the key as the last part of the address, for
 * clients that take only a URL (ChatGPT, and Claude without request
 * headers). The address is then a secret: it is never logged.
 */
async function handle(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  return mcpHandler()(request, token);
}

export { handle as DELETE, handle as GET, handle as POST };
