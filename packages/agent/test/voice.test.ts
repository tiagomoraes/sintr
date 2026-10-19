import type { HouseAssistant, ProviderCredentials } from "@sintr/core";
import { describe, expect, it } from "vitest";
import {
  MAX_AUDIO_SECONDS,
  REHEARSAL_TRANSCRIPT,
  audioFormat,
  countedSeconds,
  geminiInstruction,
  languageHint,
  rehearsalTranscription,
  transcribe,
  voiceRouteFor,
  wavSeconds,
  writingLanguage,
  type Recording,
  type VoiceRoute,
} from "../src/voice";

/**
 * F6: speech to text. Which provider hears a person, and how the request
 * looks on the wire, against a fetch that never leaves the process. No
 * test here reaches a real provider.
 */

const OPENROUTER_HOUSE: HouseAssistant = {
  provider: "openai_compatible",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "anthropic/claude-haiku-5.5",
  apiKey: "sk-or-house-0123456789",
  name: "OpenRouter",
  voice: { off: false, endpoint: null, model: null, language: null },
};
const ANTHROPIC_HOUSE: HouseAssistant = {
  provider: "anthropic",
  baseUrl: null,
  model: "claude-haiku-5-5",
  apiKey: "sk-ant-house-0123456789",
  name: "Anthropic",
  voice: { off: false, endpoint: null, model: null, language: null },
};
const own = (
  provider: ProviderCredentials["provider"],
  baseUrl: string | null,
  apiKey = "sk-own-1234",
): ProviderCredentials => ({
  provider,
  baseUrl,
  model: provider === "google" ? "gemini-2.5-flash" : "own-model",
  apiKey,
});

const RECORDING: Recording = {
  bytes: new Uint8Array(Array.from({ length: 2048 }, (_, i) => i % 251)),
  format: "webm",
  mime: "audio/webm",
};

/** A fetch that answers from `reply` and keeps every request. */
function endpoint(reply: (request: Request) => Response | Promise<Response>) {
  const requests: Request[] = [];
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request.clone());
    return reply(request);
  }) as typeof globalThis.fetch;
  return { fetch, requests };
}

describe("who hears a person's speech", () => {
  it("is the house's own provider: OpenRouter's Whisper on the house key, by default", () => {
    expect(voiceRouteFor(null, OPENROUTER_HOUSE)).toEqual({
      source: "house",
      route: {
        kind: "whisper",
        service: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "sk-or-house-0123456789",
        model: "openai/whisper-large-v3-turbo",
        trusted: true,
      },
    });
    // The operator may name another model, or turn speaking off.
    const named = {
      ...OPENROUTER_HOUSE,
      voice: { ...OPENROUTER_HOUSE.voice, model: "openai/whisper-large-v3" },
    };
    expect(voiceRouteFor(null, named).route).toMatchObject({ model: "openai/whisper-large-v3" });
    const off = { ...OPENROUTER_HOUSE, voice: { ...OPENROUTER_HOUSE.voice, off: true } };
    expect(voiceRouteFor(null, off)).toEqual({ source: "house", route: { kind: "none", reason: "off" } });
  });

  it("is nobody for an Anthropic house, unless it has an endpoint of its own", () => {
    expect(voiceRouteFor(null, ANTHROPIC_HOUSE)).toEqual({
      source: "house",
      route: { kind: "none", reason: "provider_has_no_audio" },
    });
    const withEndpoint: HouseAssistant = {
      ...ANTHROPIC_HOUSE,
      voice: {
        off: false,
        endpoint: { baseUrl: "https://openrouter.ai/api/v1", apiKey: "sk-or-voice" },
        model: null,
        language: "pt",
      },
    };
    expect(voiceRouteFor(null, withEndpoint).route).toEqual({
      kind: "whisper",
      service: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "sk-or-voice",
      model: "openai/whisper-large-v3-turbo",
      trusted: true,
    });
    // A gateway sintr does not know is used only when its operator named the model.
    const gateway: HouseAssistant = {
      ...ANTHROPIC_HOUSE,
      voice: {
        off: false,
        endpoint: { baseUrl: "http://whisper:8000/v1", apiKey: null },
        model: null,
        language: null,
      },
    };
    expect(voiceRouteFor(null, gateway).route).toEqual({ kind: "none", reason: "provider_unknown" });
    const named: HouseAssistant = { ...gateway, voice: { ...gateway.voice, model: "large-v3" } };
    expect(voiceRouteFor(null, named).route).toMatchObject({
      kind: "whisper",
      service: "gateway",
      model: "large-v3",
    });
  });

  it("is the person's own provider when they brought a key, never the house", () => {
    const route = (credentials: ProviderCredentials) => voiceRouteFor(credentials, OPENROUTER_HOUSE);
    expect(route(own("openai_compatible", "https://openrouter.ai/api/v1"))).toEqual({
      source: "own",
      route: {
        kind: "whisper",
        service: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "sk-own-1234",
        model: "openai/whisper-large-v3-turbo",
        trusted: false,
      },
    });
    expect(route(own("openai_compatible", "https://api.openai.com/v1")).route).toMatchObject({
      service: "openai",
      model: "gpt-4o-mini-transcribe",
    });
    expect(route(own("openai_compatible", "https://api.groq.com/openai/v1")).route).toMatchObject({
      service: "groq",
      model: "whisper-large-v3-turbo",
    });
    expect(route(own("google", null)).route).toEqual({
      kind: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: "sk-own-1234",
      model: "gemini-2.5-flash",
      trusted: false,
    });
    // Anthropic takes no audio; a local endpoint is not guessed at. Neither falls back to the house.
    expect(route(own("anthropic", null))).toEqual({
      source: "own",
      route: { kind: "none", reason: "provider_has_no_audio" },
    });
    expect(route(own("openai_compatible", "http://localhost:11434/v1", ""))).toEqual({
      source: "own",
      route: { kind: "none", reason: "provider_unknown" },
    });
  });

  it("is nobody when there is neither a house nor a key", () => {
    expect(voiceRouteFor(null, null)).toEqual({
      source: null,
      route: { kind: "none", reason: "not_configured" },
    });
  });
});

describe("transcribing", () => {
  const whisper = voiceRouteFor(null, OPENROUTER_HOUSE).route as Extract<VoiceRoute, { kind: "whisper" }>;

  it("sends the recording to /audio/transcriptions with the key, the model and the language", async () => {
    const fake = endpoint(() =>
      Response.json({ text: "  Fui à reunião de segunda.  ", usage: { seconds: 9.2 } }),
    );
    const result = await transcribe(whisper, RECORDING, { mode: "saas", language: "pt", fetch: fake.fetch });
    expect(result).toEqual({ ok: true, text: "Fui à reunião de segunda.", seconds: 9.2 });
    const [request] = fake.requests;
    expect(request!.url).toBe("https://openrouter.ai/api/v1/audio/transcriptions");
    expect(request!.method).toBe("POST");
    expect(request!.headers.get("authorization")).toBe("Bearer sk-or-house-0123456789");
    const form = await request!.formData();
    expect(form.get("model")).toBe("openai/whisper-large-v3-turbo");
    expect(form.get("language")).toBe("pt");
    expect(form.get("response_format")).toBe("json");
    const file = form.get("file") as File;
    expect(file.name).toBe("speech.webm");
    expect(file.type).toBe("audio/webm");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(RECORDING.bytes);
  });

  it("leaves the language to the provider when there is no hint, and reads a verbose duration", async () => {
    const fake = endpoint(() => Response.json({ text: "hello", duration: 3.5 }));
    const result = await transcribe(whisper, RECORDING, { mode: "selfhost", fetch: fake.fetch });
    expect(result).toEqual({ ok: true, text: "hello", seconds: 3.5 });
    expect((await fake.requests[0]!.formData()).has("language")).toBe(false);
  });

  it("asks Gemini to write down what was said, and nothing else", async () => {
    const gemini = voiceRouteFor(own("google", null, "AIza-own-key"), null).route as Extract<
      VoiceRoute,
      { kind: "gemini" }
    >;
    const wav: Recording = { ...RECORDING, format: "wav", mime: "audio/wav" };
    const fake = endpoint(() =>
      Response.json({
        candidates: [{ content: { parts: [{ text: "Fui à reunião " }, { text: "de segunda.\n" }] } }],
      }),
    );
    const result = await transcribe(gemini, wav, { mode: "saas", language: "pt", fetch: fake.fetch });
    expect(result).toEqual({ ok: true, text: "Fui à reunião de segunda.", seconds: null });
    const request = fake.requests[0]!;
    expect(request.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
    expect(request.headers.get("x-goog-api-key")).toBe("AIza-own-key");
    const body = (await request.json()) as {
      contents: { parts: ({ inlineData: { mimeType: string; data: string } } | { text: string })[] }[];
    };
    const [audio, instruction] = body.contents[0]!.parts;
    expect(audio).toEqual({
      inlineData: { mimeType: "audio/wav", data: Buffer.from(wav.bytes).toString("base64") },
    });
    expect(instruction).toEqual({ text: geminiInstruction("pt") });
    expect(geminiInstruction("pt")).toMatch(/word for word.*usually speaks Portuguese.*no translation/su);
  });

  it("reports a code, never the provider's words", async () => {
    const cases: [number, string][] = [
      [401, "key_refused"],
      [403, "key_refused"],
      [404, "model_not_found"],
      [429, "rate_limited"],
      [400, "unsupported_audio"],
      [413, "unsupported_audio"],
      [500, "provider_error"],
    ];
    for (const [status, problem] of cases) {
      const fake = endpoint(
        () => new Response(JSON.stringify({ error: { message: "the audio said: secret" } }), { status }),
      );
      expect(await transcribe(whisper, RECORDING, { mode: "saas", fetch: fake.fetch })).toEqual({
        ok: false,
        problem,
      });
    }
    const broken = endpoint(() => {
      throw new TypeError("fetch failed");
    });
    expect(await transcribe(whisper, RECORDING, { mode: "saas", fetch: broken.fetch })).toEqual({
      ok: false,
      problem: "unreachable",
    });
    const odd = endpoint(() => Response.json({ transcript: "not the field" }));
    expect(await transcribe(whisper, RECORDING, { mode: "saas", fetch: odd.fetch })).toEqual({
      ok: false,
      problem: "provider_error",
    });
  });

  it("holds a person's own address to the hosted offer's rules, and refuses redirects there", async () => {
    const local = {
      ...whisper,
      baseUrl: "http://192.168.1.20:8000/v1",
      service: "gateway" as const,
      trusted: false,
    };
    const fake = endpoint(() => Response.json({ text: "never" }));
    expect(await transcribe(local, RECORDING, { mode: "saas", fetch: fake.fetch })).toEqual({
      ok: false,
      problem: "https_required",
    });
    expect(fake.requests).toHaveLength(0);
    const person = { ...whisper, trusted: false };
    let redirect: string | undefined;
    const watch = (async (_input: string | URL | Request, init?: RequestInit) => {
      redirect = init?.redirect;
      return Response.json({ text: "ok" });
    }) as typeof fetch;
    await transcribe(person, RECORDING, { mode: "saas", fetch: watch });
    expect(redirect).toBe("error");
    // The house's own address is the operator's, and may be private.
    const house = { ...whisper, baseUrl: "http://whisper:8000/v1", service: "gateway" as const };
    const ok = endpoint(() => Response.json({ text: "heard" }));
    expect(await transcribe(house, RECORDING, { mode: "saas", fetch: ok.fetch })).toMatchObject({ ok: true });
  });
});

describe("the rehearsal transcriber", () => {
  it("hears the same sentence in any real recording, offline", () => {
    expect(rehearsalTranscription(RECORDING, 7.6)).toEqual({
      ok: true,
      text: REHEARSAL_TRANSCRIPT,
      seconds: 8,
    });
    expect(rehearsalTranscription({ ...RECORDING, bytes: new Uint8Array(10) }, 3)).toEqual({
      ok: false,
      problem: "unsupported_audio",
    });
  });
});

describe("recordings", () => {
  it("are taken in the containers browsers record in", () => {
    expect(audioFormat("audio/webm;codecs=opus")).toEqual({ format: "webm", mime: "audio/webm" });
    expect(audioFormat("audio/mp4")).toEqual({ format: "m4a", mime: "audio/mp4" });
    expect(audioFormat("audio/x-m4a")).toEqual({ format: "m4a", mime: "audio/mp4" });
    expect(audioFormat("audio/ogg; codecs=opus")).toEqual({ format: "ogg", mime: "audio/ogg" });
    expect(audioFormat("audio/wav")).toEqual({ format: "wav", mime: "audio/wav" });
    expect(audioFormat("text/plain")).toBeNull();
    expect(audioFormat(null)).toBeNull();
  });
});

/** A WAV file of `seconds` of silence at 16 kHz mono, 16-bit. */
function wav(seconds: number, extraChunk = false): Uint8Array {
  const data = Math.round(seconds * 16_000) * 2;
  const extra = extraChunk ? 8 + 6 : 0;
  const bytes = new Uint8Array(44 + extra + data);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + extra + data, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16_000, true);
  view.setUint32(28, 32_000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  let offset = 36;
  if (extraChunk) {
    text(36, "LIST");
    view.setUint32(40, 6, true);
    offset += 14;
  }
  text(offset, "data");
  view.setUint32(offset + 4, data, true);
  return bytes;
}

describe("how long a recording is, as the server counts it", () => {
  it("reads a WAV file's length from its header, past other chunks", () => {
    expect(wavSeconds(wav(2.5))).toBeCloseTo(2.5);
    expect(wavSeconds(wav(1, true))).toBeCloseTo(1);
    expect(wavSeconds(new Uint8Array(100))).toBeNull();
  });

  it("takes the browser's measure, never under what the size makes it, and WAV exactly", () => {
    const webm = (bytes: number): Recording => ({
      bytes: new Uint8Array(bytes),
      format: "webm",
      mime: "audio/webm",
    });
    // An honest minute at 64 kbit/s: the browser's 60 seconds stand.
    expect(countedSeconds({ claimed: 60, recording: webm(480_000) })).toMatchObject({
      seconds: 60,
      tooLong: false,
    });
    // A browser claiming one second for three megabytes is counted for at least 94 of them.
    expect(countedSeconds({ claimed: 1, recording: webm(3_000_000) }).seconds).toBeCloseTo(93.75);
    expect(countedSeconds({ claimed: Number.NaN, recording: webm(10) }).seconds).toBe(1);
    // A WAV file says its own length, whatever is claimed.
    const recording: Recording = { bytes: wav(12), format: "wav", mime: "audio/wav" };
    expect(countedSeconds({ claimed: 1, recording })).toMatchObject({ measured: 12, seconds: 12 });
    // Clearly longer than a recording may be: refused before anything is taken or sent.
    expect(countedSeconds({ claimed: 1, recording: webm(12_000_000) }).tooLong).toBe(true);
    const long: Recording = { bytes: wav(MAX_AUDIO_SECONDS + 30), format: "wav", mime: "audio/wav" };
    expect(countedSeconds({ claimed: 10, recording: long }).tooLong).toBe(true);
  });
});

describe("the language of the person's own writing", () => {
  it("is told by the words they use, when it is clear", () => {
    expect(writingLanguage(["Hoje eu fiquei muito nervosa na reunião, não consegui falar nada."])).toBe("pt");
    expect(writingLanguage(["Hoy estoy muy cansada, pero fue un buen día con mi hermana."])).toBe("es");
    expect(writingLanguage(["My manager asked about the deadline and I felt that I was failing."])).toBe(
      "en",
    );
    // Too little to tell, or two languages at once: no guess.
    expect(writingLanguage(["ok"])).toBeNull();
    expect(writingLanguage([])).toBeNull();
    expect(writingLanguage(["the meeting foi muito ruim and I was não"])).toBeNull();
  });

  it("gives the transcriber its hint: the writing, then a chosen language, then the installation's", () => {
    const portuguese = ["Ontem eu achei que ia dar tudo errado, mas não deu."];
    expect(languageHint({ writing: portuguese, profileLanguage: "en", houseDefault: "es" })).toBe("pt");
    expect(languageHint({ writing: [], profileLanguage: "pt-BR", houseDefault: "en" })).toBe("pt");
    expect(languageHint({ writing: [], profileLanguage: "es", houseDefault: null })).toBe("es");
    // English is the default everyone starts with, so it says nothing of what they speak.
    expect(languageHint({ writing: [], profileLanguage: "en", houseDefault: "pt" })).toBe("pt");
    expect(languageHint({ writing: [], profileLanguage: "en", houseDefault: null })).toBeNull();
  });
});
