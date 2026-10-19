import { apiError, runtime } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

/** Stripe's events are small; anything larger is not one of them. */
const MAX_BODY = 512 * 1024;

/**
 * The payment provider's webhook. No session and no origin: the signature
 * over the raw body is the credential, checked in the core, which then
 * reads the subscription back from the provider and applies it. 400 for a
 * bad signature, 503 to be delivered again later, 404 while payments are off.
 */
export async function POST(request: Request) {
  const { payments } = runtime();
  if (!payments) return apiError(404, "not_found");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return apiError(413, "too_large");
  const payload = await request.text();
  if (payload.length > MAX_BODY) return apiError(413, "too_large");
  const result = await runtime().handlePaymentWebhook(payload, request.headers.get("stripe-signature"));
  return Response.json(
    { received: result.status === 200, code: result.code },
    { status: result.status, headers: { "Cache-Control": "no-store" } },
  );
}
