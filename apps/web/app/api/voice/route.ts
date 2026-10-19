import { randomUUID } from "node:crypto";
import {
  MAX_AUDIO_BYTES,
  MAX_AUDIO_SECONDS,
  audioFormat,
  countedSeconds,
  languageHint,
  personTexts,
  rehearsalTranscription,
  screenForRisk,
  transcribe,
  type Recording,
  type Transcription,
} from "@sintr/agent";
import { z } from "zod";
import { loadMessages } from "@/lib/server/assistant";
import { currentLanguage } from "@/lib/server/language";
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
  // Gemini is sent WAV, which says its own length.
  if (voice.route.kind === "gemini" && recording.format !== "wav") return apiError(415, "unsupported_audio");
  // Counted by the browser's measure, never under what the recording's size makes it.
  const counted = countedSeconds({ claimed: query.data.seconds, recording });
  if (counted.tooLong) return apiError(413, "too_long");
  const seconds = counted.seconds;
  const { config } = runtime();
  const log = runtime().log.child({ userId: user.id, requestId: randomUUID() });

  // A hint of the language, from the person's own writing: this conversation, or the latest one.
  const conversations = query.data.conversation ? [] : await scope.conversations.list();
  const conversationId =
    query.data.conversation ?? conversations.find((c) => c.lastMessageAt !== null)?.id ?? null;
  const writing =
    conversationId && (await scope.conversations.get(conversationId))
      ? personTexts(await loadMessages(scope, conversationId)).slice(-12)
      : [];
  // Then the language the person reads sintr in, when something set it (not English by default alone).
  const reading = await currentLanguage();
  const language = languageHint({
    writing,
    personLanguage: reading.source === "default" ? null : reading.code,
    houseDefault: config.house?.voice.language ?? null,
  });

  // The house's seconds are taken right before the call and always settled after it, to what was
  // really heard (all of them back if nothing was); a person's own key is never counted.
  const taken = voice.source === "house" ? await scope.plans.takeAudio(seconds) : null;
  if (taken && !taken.ok) return apiError(429, "audio_limit", { next: taken.period.next });
  const started = Date.now();
  let heard = 0;
  let result: Transcription;
  try {
    result = config.fakeAgent
      ? rehearsalTranscription(recording, seconds)
      : await transcribe(voice.route, recording, { mode: config.mode, language, log });
    if (result.ok) heard = result.seconds ?? counted.measured ?? seconds;
  } finally {
    if (taken) await scope.plans.settleAudio(taken.period, taken.seconds, heard);
  }
  if (!result.ok) {
    log.warn("voice.failed", { code: result.problem, durationMs: Date.now() - started });
    return apiError(502, result.problem);
  }
  // Codes and counts only: the seconds heard, never a word of them.
  log.info("voice.transcribed", {
    code: result.text ? `${voice.source}_ok` : `${voice.source}_nothing_heard`,
    count: Math.round(heard),
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
