import { apiScope } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

/**
 * "Download what sintr remembers": every memory, its words, the words it
 * came from and where, as a JSON file for the person to keep. The vectors
 * are not part of it: they are numbers turned by the person's own key,
 * which mean nothing outside sintr. Audited without content.
 */
export async function GET(request: Request) {
  const guard = await apiScope(request);
  if (guard instanceof Response) return guard;
  const { scope } = guard;
  const memories = await scope.memories.list();
  await scope.auditLog.record({
    action: "data.exported",
    targetType: "memories",
    metadata: { count: memories.length },
  });
  const body = {
    v: 1,
    exportedAt: new Date().toISOString(),
    memories: memories.map((memory) => ({
      kind: memory.kind,
      text: memory.text,
      quote: memory.quote,
      source: memory.source,
      occurredAt: memory.occurredAt.toISOString(),
      correctedAt: memory.editedAt?.toISOString() ?? null,
      createdAt: memory.createdAt.toISOString(),
    })),
  };
  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sintr-memory.json"',
      "Cache-Control": "no-store",
    },
  });
}
