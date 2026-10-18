import {
  InvalidStateError,
  NotFoundError,
  ValidationError,
  type CheckinInput,
  type EntryInput,
} from "@sintr/core";
import { z } from "zod";
import { proposalView } from "@/lib/server/assistant";
import { apiError, apiScope, runtime } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

const Decision = z.discriminatedUnion("action", [
  // `values`: the person's edited version of the draft, if they changed it.
  z.object({ action: z.literal("confirm"), values: z.record(z.string(), z.unknown()).optional() }),
  z.object({ action: z.literal("discard") }),
]);

/**
 * The person's decision on a draft from the conversation. Confirming is the
 * explicit yes that turns it into an entry or a check-in; nothing else does.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await apiScope(request);
  if (guard instanceof Response) return guard;
  const { scope } = guard;
  const { id } = await params;
  const parsed = Decision.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_request");
  const proposal = await scope.proposals.get(id);
  if (!proposal) return apiError(404, "not_found");

  try {
    if (parsed.data.action === "discard") {
      return Response.json(proposalView(await scope.proposals.discard(id)));
    }
    const values = parsed.data.values as EntryInput | CheckinInput | undefined;
    const { proposal: saved } = await scope.proposals.confirm(id, values);
    return Response.json(proposalView(saved));
  } catch (error) {
    if (error instanceof InvalidStateError) {
      const current = await scope.proposals.get(id);
      return apiError(409, "already_decided", current ? { proposal: proposalView(current) } : {});
    }
    if (error instanceof ValidationError) return apiError(400, "invalid", { fields: error.fields });
    if (error instanceof NotFoundError) return apiError(404, "not_found");
    runtime().log.error("api.proposal_failed", { route: "/api/proposals", error });
    return apiError(500, "failed");
  }
}
