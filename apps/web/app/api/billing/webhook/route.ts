import { apiError, runtime } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

/** Stripe's events are small; anything larger is not one of them. */
const MAX_BODY = 512 * 1024;

/** The raw body, read only up to the bound, whatever the request says its length is. */
async function boundedText(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

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
  const payload = await boundedText(request);
  if (payload === null) return apiError(413, "too_large");
  const result = await runtime().handlePaymentWebhook(payload, request.headers.get("stripe-signature"));
  return Response.json(
    { received: result.status === 200, code: result.code },
    { status: result.status, headers: { "Cache-Control": "no-store" } },
  );
}
