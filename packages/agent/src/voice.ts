/**
 * Speech to text. The person speaks; one provider transcribes; the person
 * reads the transcript before it becomes anything. The audio is used for
 * that one call and dropped: never stored, never logged, never sent to the
 * assistant itself.
 *
 * Which provider transcribes follows who answers (DECISIONS 87):
 * - the house: its own provider and key, when that provider transcribes
 *   (OpenRouter's Whisper by default), or an endpoint of its own
 *   (SINTR_HOUSE_STT_*), or nobody (an Anthropic house without one);
 * - a person's own key: the best path that same provider offers, so their
 *   words still go only where they chose: OpenRouter's Whisper, OpenAI's or
 *   Groq's transcription, Gemini listening for Google. Anthropic has no way
 *   to take audio, and an endpoint sintr does not know is not guessed at:
 *   the app then says that speaking is not available, in one line.
 *
 * Keys and addresses are passed explicitly, as for the assistant (decision
 * 19), and a person's address is held to the same rules (decision 20).
 */
import type { HouseAssistant, Logger, ProviderCredentials } from "@sintr/core";
import { checkBaseUrl, DEFAULT_BASE_URLS } from "./providers";
import type { VoiceUnavailable } from "./shapes";

/** One recording: at most five minutes, and a little over what that weighs on a phone. */
export const MAX_AUDIO_SECONDS = 300;
export const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

/** The containers a browser records in, by the name transcription APIs give them. */
export type AudioFormat = "webm" | "ogg" | "m4a" | "wav" | "mp3";

const FORMATS: { pattern: RegExp; format: AudioFormat; mime: string }[] = [
  { pattern: /^audio\/webm\b/u, format: "webm", mime: "audio/webm" },
  { pattern: /^audio\/ogg\b/u, format: "ogg", mime: "audio/ogg" },
  // Safari records AAC in an MP4 container, which these APIs call m4a.
  { pattern: /^audio\/(?:mp4|m4a|x-m4a|aac)\b/u, format: "m4a", mime: "audio/mp4" },
  { pattern: /^audio\/(?:wav|wave|x-wav)\b/u, format: "wav", mime: "audio/wav" },
  { pattern: /^audio\/(?:mpeg|mp3)\b/u, format: "mp3", mime: "audio/mpeg" },
];

/** The format of a recording from its content type, or null for anything that is not audio sintr takes. */
export function audioFormat(contentType: string | null): { format: AudioFormat; mime: string } | null {
  const type = (contentType ?? "").toLowerCase().trim();
  const found = FORMATS.find((entry) => entry.pattern.test(type));
  return found ? { format: found.format, mime: found.mime } : null;
}

/** Transcription models by default, for the services sintr knows. */
const KNOWN_SERVICES: { host: string; service: WhisperService; model: string }[] = [
  { host: "openrouter.ai", service: "openrouter", model: "openai/whisper-large-v3-turbo" },
  { host: "api.openai.com", service: "openai", model: "gpt-4o-mini-transcribe" },
  { host: "api.groq.com", service: "groq", model: "whisper-large-v3-turbo" },
];

export type WhisperService = "openrouter" | "openai" | "groq" | "gateway";

export type { VoiceUnavailable };

/** How one recording becomes text. */
export type VoiceRoute =
  | {
      kind: "whisper";
      /** An OpenAI-style /audio/transcriptions endpoint. */
      service: WhisperService;
      baseUrl: string;
      apiKey: string | null;
      model: string;
      /** The installation's own address (the house), which may point anywhere. */
      trusted: boolean;
    }
  | {
      kind: "gemini";
      baseUrl: string;
      apiKey: string;
      model: string;
      trusted: boolean;
    }
  | { kind: "none"; reason: VoiceUnavailable };

export type VoiceSource = "own" | "house";

function knownService(baseUrl: string | null): (typeof KNOWN_SERVICES)[number] | null {
  if (!baseUrl) return null;
  try {
    const host = new URL(baseUrl).hostname.toLowerCase().replace(/\.+$/u, "");
    return KNOWN_SERVICES.find((known) => host === known.host) ?? null;
  } catch {
    return null;
  }
}

/** The route for one provider's credentials. `model` is an operator's choice for the house. */
function routeFor(credentials: ProviderCredentials, trusted: boolean, model: string | null): VoiceRoute {
  switch (credentials.provider) {
    case "anthropic":
      return { kind: "none", reason: "provider_has_no_audio" };
    case "google":
      if (!credentials.apiKey) return { kind: "none", reason: "provider_has_no_audio" };
      return {
        kind: "gemini",
        baseUrl: credentials.baseUrl ?? DEFAULT_BASE_URLS.google,
        apiKey: credentials.apiKey,
        // Gemini listens with the model that answers, unless the house names another.
        model: model ?? credentials.model,
        trusted,
      };
    case "openai_compatible": {
      if (!credentials.baseUrl) return { kind: "none", reason: "provider_unknown" };
      const known = knownService(credentials.baseUrl);
      // An endpoint sintr does not know is used only when its operator named the model.
      const chosen = model ?? known?.model ?? null;
      if (!chosen) return { kind: "none", reason: "provider_unknown" };
      return {
        kind: "whisper",
        service: known?.service ?? "gateway",
        baseUrl: credentials.baseUrl,
        apiKey: credentials.apiKey,
        model: chosen,
        trusted,
      };
    }
  }
}

/**
 * Who would transcribe a person's speech, and how: their own key's
 * provider first (it is who they chose to receive their words), then the
 * house. Never the house for someone on their own key: their words would
 * go somewhere they did not choose.
 */
export function voiceRouteFor(
  own: ProviderCredentials | null,
  house: HouseAssistant | null,
): { source: VoiceSource | null; route: VoiceRoute } {
  if (own) return { source: "own", route: routeFor(own, false, null) };
  if (!house) return { source: null, route: { kind: "none", reason: "not_configured" } };
  const { voice } = house;
  if (voice.off) return { source: "house", route: { kind: "none", reason: "off" } };
  if (voice.endpoint) {
    const credentials: ProviderCredentials = {
      provider: "openai_compatible",
      baseUrl: voice.endpoint.baseUrl,
      apiKey: voice.endpoint.apiKey,
      model: voice.model ?? "",
    };
    return { source: "house", route: routeFor(credentials, true, voice.model) };
  }
  return { source: "house", route: routeFor(house, true, voice.model) };
}

/* Transcribing */

export type TranscriptionProblem =
  | "key_refused"
  | "model_not_found"
  | "rate_limited"
  | "unsupported_audio"
  | "unreachable"
  | "timeout"
  | "provider_error"
  | "invalid_url"
  | "credentials_in_url"
  | "https_required"
  | "private_address";

export type Transcription =
  | {
      ok: true;
      text: string;
      /** How long the provider says the audio was, when it says; null otherwise. */
      seconds: number | null;
    }
  | { ok: false; problem: TranscriptionProblem };

export interface Recording {
  bytes: Uint8Array;
  format: AudioFormat;
  mime: string;
}

export interface TranscribeOptions {
  mode: "selfhost" | "saas";
  /** A hint of the language spoken (ISO 639-1); none lets the provider tell. */
  language?: string | null;
  /** For tests: a fetch that never reaches the network. */
  fetch?: typeof fetch;
  log?: Logger;
  timeoutMs?: number;
}

const LANGUAGE_NAMES: Record<string, string> = {
  pt: "Portuguese",
  es: "Spanish",
  en: "English",
};

/** What Gemini is asked to do with the audio: write it down, nothing else. */
export function geminiInstruction(language: string | null | undefined): string {
  const hint = language ? LANGUAGE_NAMES[language] : undefined;
  return [
    "Transcribe this recording word for word, in the language it is spoken in.",
    hint ? `The speaker usually speaks ${hint}.` : "",
    "Write only what was said: no comment, no summary, no translation, no labels and no timestamps.",
    "If nothing is said, write nothing.",
  ]
    .filter(Boolean)
    .join(" ");
}

function problemFromStatus(status: number): TranscriptionProblem {
  if (status === 401 || status === 403) return "key_refused";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 413 || status === 415 || status === 422) return "unsupported_audio";
  return "provider_error";
}

function problemFromError(error: unknown): TranscriptionProblem {
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") return "timeout";
  if (error instanceof TypeError) return "unreachable";
  return "provider_error";
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
}

/** "  hello  " to "hello"; providers sometimes pad or quote the whole text. */
function cleanTranscript(text: string): string {
  return text.replace(/\r\n?/gu, "\n").trim();
}

/**
 * One recording to text, through its route. Only a code comes back on
 * failure: the provider's message may quote the audio, so it is dropped.
 */
export async function transcribe(
  route: Exclude<VoiceRoute, { kind: "none" }>,
  recording: Recording,
  options: TranscribeOptions,
): Promise<Transcription> {
  const strict = options.mode === "saas" && !route.trusted;
  const checked = checkBaseUrl(route.baseUrl, strict ? "saas" : "selfhost");
  if (!checked.ok) return { ok: false, problem: checked.problem };
  const doFetch = options.fetch ?? globalThis.fetch;
  const signal = AbortSignal.timeout(options.timeoutMs ?? 90_000);
  // A person's public host must not bounce their audio somewhere internal.
  const redirect: "error" | "follow" = strict ? "error" : "follow";
  try {
    if (route.kind === "whisper") {
      const form = new FormData();
      form.set("model", route.model);
      form.set(
        "file",
        new Blob([new Uint8Array(recording.bytes)], { type: recording.mime }),
        `speech.${recording.format}`,
      );
      form.set("response_format", "json");
      form.set("temperature", "0");
      if (options.language) form.set("language", options.language);
      const response = await doFetch(`${checked.url}/audio/transcriptions`, {
        method: "POST",
        headers: route.apiKey ? { authorization: `Bearer ${route.apiKey}` } : {},
        body: form,
        signal,
        redirect,
      });
      if (!response.ok) {
        options.log?.warn("voice.transcription_failed", {
          code: problemFromStatus(response.status),
          status: response.status,
        });
        return { ok: false, problem: problemFromStatus(response.status) };
      }
      const body = (await response.json().catch(() => null)) as {
        text?: unknown;
        duration?: unknown;
        usage?: { seconds?: unknown };
      } | null;
      if (!body || typeof body.text !== "string") return { ok: false, problem: "provider_error" };
      const seconds =
        typeof body.usage?.seconds === "number"
          ? body.usage.seconds
          : typeof body.duration === "number"
            ? body.duration
            : null;
      return { ok: true, text: cleanTranscript(body.text), seconds };
    }

    const response = await doFetch(
      `${checked.url}/models/${encodeURIComponent(route.model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": route.apiKey },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: recording.mime, data: toBase64(recording.bytes) } },
                { text: geminiInstruction(options.language) },
              ],
            },
          ],
          generationConfig: { temperature: 0 },
        }),
        signal,
        redirect,
      },
    );
    if (!response.ok) {
      options.log?.warn("voice.transcription_failed", {
        code: problemFromStatus(response.status),
        status: response.status,
      });
      return { ok: false, problem: problemFromStatus(response.status) };
    }
    const body = (await response.json().catch(() => null)) as {
      candidates?: { content?: { parts?: { text?: unknown }[] } }[];
    } | null;
    const parts = body?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return { ok: false, problem: "provider_error" };
    const text = parts.map((part) => (typeof part.text === "string" ? part.text : "")).join("");
    return { ok: true, text: cleanTranscript(text), seconds: null };
  } catch (error) {
    const problem = problemFromError(error);
    options.log?.warn("voice.transcription_failed", { code: problem, error });
    return { ok: false, problem };
  }
}

/* The rehearsal transcriber (SINTR_FAKE_AGENT) */

/** What the rehearsal transcriber hears in any recording. */
export const REHEARSAL_TRANSCRIPT =
  "The meeting on Monday, when my manager asked about the deadline in front of everyone.";

/**
 * A deterministic, offline transcriber, for the tests and for rehearsing
 * the app without a key: it checks that a recording arrived and answers
 * with the same sentence every time. It never touches the network.
 */
export function rehearsalTranscription(recording: Recording, seconds: number): Transcription {
  if (recording.bytes.byteLength < 64) return { ok: false, problem: "unsupported_audio" };
  return { ok: true, text: REHEARSAL_TRANSCRIPT, seconds: Math.max(1, Math.round(seconds)) };
}

/* The language of the person's own writing */

const MARKERS: Record<"pt" | "es" | "en", readonly string[]> = {
  pt: "não nao você voce muito também tambem estou isso então entao meu minha é foi uma com pra para mas eu ele ela quando porque já tô aí fiquei hoje ontem achei senti do da no na os as um".split(
    " ",
  ),
  es: "no yo muy también estoy eso entonces pero mi el los las del fue una con para cuando porque ya hoy ayer sentí me lo qué un".split(
    " ",
  ),
  en: "the and i to of it was my me that in is he she when because but so just with for not felt what today yesterday a".split(
    " ",
  ),
};

/** Words that are markers of more than one language say nothing about which. */
const SHARED = new Set(
  Object.values(MARKERS)
    .flat()
    .filter((word, index, all) => all.indexOf(word) !== index),
);

/**
 * The language the person writes in (Portuguese, Spanish or English), from
 * their own messages, when it is clear: enough telling words and one
 * language well ahead. Null otherwise, and the transcriber listens for it.
 */
export function writingLanguage(texts: readonly string[]): "pt" | "es" | "en" | null {
  const words = texts
    .join(" ")
    .toLowerCase()
    .split(/[^\p{L}']+/u)
    .filter((word) => word && !SHARED.has(word));
  const scores = (Object.keys(MARKERS) as ("pt" | "es" | "en")[])
    .map((language) => ({
      language,
      score: words.filter((word) => MARKERS[language].includes(word)).length,
    }))
    .sort((a, b) => b.score - a.score);
  const [first, second] = scores;
  if (!first || first.score < 3) return null;
  if (second && first.score < second.score * 2 + 1) return null;
  return first.language;
}

/**
 * The hint given to the transcriber, in order: the person's own writing,
 * the report language they chose (anything but the default, English, is a
 * choice they made), then the installation's default. Null lets the
 * provider tell from the audio.
 */
export function languageHint(input: {
  writing: readonly string[];
  profileLanguage: string;
  houseDefault: string | null;
}): string | null {
  const written = writingLanguage(input.writing);
  if (written) return written;
  const chosen = input.profileLanguage.toLowerCase().slice(0, 2);
  if (chosen === "pt" || chosen === "es") return chosen;
  return input.houseDefault;
}
