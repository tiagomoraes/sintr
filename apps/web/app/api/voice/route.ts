import { randomUUID } from "node:crypto";
import {
  MAX_AUDIO_BYTES,
  MAX_AUDIO_SECONDS,
  audioFormat,
  languageHint,
  personTexts,
  rehearsalTranscription,
  screenForRisk,
  transcribe,
  type Recording,
} from "@sintr/agent";
import { z } from "zod";
import { loadMessages } from "@/lib/server/assistant";
import { apiError, apiScope, runtime } from "@/lib/server/runtime";
import { voiceFor } from "@/lib/server/voice";

export const dynamic = "force-dynamic";

const Query = z.object({
  seconds: z.coerce
    .number()
    .min(0)
    .max(MAX_AUDIO_SECONDS + 5),
  conversation: z.uuid().optional(),
});

/** The recording, read only up to the bound, whatever the request says its length is. */
async function boundedBytes(request: Request): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_AUDIO_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

/**
 * One recording to text. The audio is the body (its content type says the
 * container); it is held in memory for the one call to the transcriber and
 * dropped: never stored, never logged. What comes back is the text, for the
 * person to read and change before they send it, and whether the screen
 * for risk saw something in it, so the help lines open at once. Nothing
 * here writes to the diary or the conversation.
 */
export async function POST(request: Request) {
  const guard = await apiScope(request);
  if (guard instanceof Response) return guard;
  const { user, scope } = guard;
  const format = audioFormat(request.headers.get("content-type"));
  if (!format) return apiError(415, "unsupported_audio");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_AUDIO_BYTES) return apiError(413, "too_large");
  const url = new URL(request.url);
  const query = Query.safeParse({
    seconds: url.searchParams.get("seconds") ?? undefined,
    conversation: url.searchParams.get("conversation") ?? undefined,
  });
  if (!query.success) return apiError(400, "invalid_request");

  const voice = await voiceFor(scope);
  if (voice.route.kind === "none") return apiError(409, `voice_${voice.route.reason}`);
  const bytes = await boundedBytes(request);
  if (bytes === null) return apiError(413, "too_large");
  if (bytes.byteLength === 0) return apiError(400, "empty_audio");
  const recording: Recording = { bytes, format: format.format, mime: format.mime };
  const seconds = Math.max(1, Math.min(MAX_AUDIO_SECONDS, query.data.seconds));
  const { config } = runtime();
  const log = runtime().log.child({ userId: user.id, requestId: randomUUID() });

  // The house's minutes are taken before the call and settled after it; a person's own key is never counted.
  const taken = voice.source === "house" ? await scope.plans.takeAudio(seconds) : null;
  if (taken && !taken.ok) return apiError(429, "audio_limit", { next: taken.period.next });

  // A hint of the language, from the person's own writing: this conversation, or the latest one.
  const conversations = query.data.conversation ? [] : await scope.conversations.list();
  const conversationId =
    query.data.conversation ?? conversations.find((c) => c.lastMessageAt !== null)?.id ?? null;
  const writing =
    conversationId && (await scope.conversations.get(conversationId))
      ? personTexts(await loadMessages(scope, conversationId)).slice(-12)
      : [];
  const profile = await scope.profile.get();
  const language = languageHint({
    writing,
    profileLanguage: profile.language,
    houseDefault: config.house?.voice.language ?? null,
  });

  const started = Date.now();
  const result = config.fakeAgent
    ? rehearsalTranscription(recording, seconds)
    : await transcribe(voice.route, recording, { mode: config.mode, language, log });
  if (taken)
    await scope.plans.settleAudio(taken.period, taken.seconds, result.ok ? (result.seconds ?? seconds) : 0);
  if (!result.ok) {
    log.warn("voice.failed", { code: result.problem, durationMs: Date.now() - started });
    return apiError(502, result.problem);
  }
  // Codes and counts only: the seconds heard, never a word of them.
  log.info("voice.transcribed", {
    code: result.text ? `${voice.source}_ok` : `${voice.source}_nothing_heard`,
    count: Math.round(result.seconds ?? seconds),
    durationMs: Date.now() - started,
  });
  const screening = screenForRisk(result.text);
  return Response.json(
    {
      text: result.text,
      risk: screening.risk,
      language: screening.risk ? screening.language : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
