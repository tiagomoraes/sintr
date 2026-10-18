import { runtime } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

/** Readiness for Docker and Caddy: the app runs and the database answers. */
export async function GET() {
  const ok = await runtime().ping();
  return Response.json(
    { status: ok ? "ok" : "unavailable" },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
