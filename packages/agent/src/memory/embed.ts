/**
 * A memory's words, or what the person just said, as a vector: one call to
 * the route's provider. Keys and addresses are passed explicitly and a
 * person's address is held to the hosted offer's rules, redirects refused
 * (decisions 19 and 20), as for speech. Only a code comes back on failure:
 * the provider's message may quote the words, so it is dropped.
 */
import type { EmbeddingSpace, Logger } from "@sintr/core";
import { checkBaseUrl, type BaseUrlProblem } from "../providers";
import type { EmbeddingRoute } from "./route";

/** Gemini's vectors are asked for at this length, the same as OpenAI's small model. */
const GEMINI_DIMENSIONS = 1536;

export type EmbeddingProblem =
  | "key_refused"
  | "model_not_found"
  | "rate_limited"
  | "unreachable"
  | "timeout"
  | "provider_error"
  | BaseUrlProblem;

export type Embedding =
  { ok: true; space: EmbeddingSpace; vectors: number[][] } | { ok: false; problem: EmbeddingProblem };

export interface EmbedOptions {
  mode: "selfhost" | "saas";
  /** For tests: a fetch that never reaches the network. */
  fetch?: typeof fetch;
  log?: Logger;
  timeoutMs?: number;
}

function problemFromStatus(status: number): EmbeddingProblem {
  if (status === 401 || status === 403) return "key_refused";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  return "provider_error";
}

function problemFromError(error: unknown): EmbeddingProblem {
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") return "timeout";
  if (error instanceof TypeError) return "unreachable";
  return "provider_error";
}

function isVector(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 1 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/** Vectors of one length, one per text, or null when the answer is not that. */
function checked(vectors: unknown[], count: number): number[][] | null {
  if (vectors.length !== count || !vectors.every(isVector)) return null;
  const length = vectors[0]?.length;
  return vectors.every((v) => v.length === length) ? vectors : null;
}

/** The texts as vectors, in order, through the route. */
export async function embedTexts(
  route: Exclude<EmbeddingRoute, { kind: "none" }>,
  texts: readonly string[],
  options: EmbedOptions,
): Promise<Embedding> {
  if (texts.length === 0) return { ok: false, problem: "provider_error" };
  const strict = options.mode === "saas" && !route.trusted;
  const address = checkBaseUrl(route.baseUrl, strict ? "saas" : "selfhost");
  if (!address.ok) return { ok: false, problem: address.problem };
  const doFetch = options.fetch ?? globalThis.fetch;
  const signal = AbortSignal.timeout(options.timeoutMs ?? 30_000);
  // A person's public host must not bounce their words somewhere internal.
  const redirect: "error" | "follow" = strict ? "error" : "follow";
  const fail = (problem: EmbeddingProblem, status: number | null = null): Embedding => {
    options.log?.warn("memory.embedding_failed", { code: problem, status });
    return { ok: false, problem };
  };
  try {
    if (route.kind === "openai") {
      const response = await doFetch(`${address.url}/embeddings`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(route.apiKey ? { authorization: `Bearer ${route.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: route.model, input: texts, encoding_format: "float" }),
        signal,
        redirect,
      });
      if (!response.ok) return fail(problemFromStatus(response.status), response.status);
      const body = (await response.json().catch(() => null)) as {
        data?: { index?: unknown; embedding?: unknown }[];
      } | null;
      const data = Array.isArray(body?.data) ? [...body.data] : [];
      data.sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0));
      const vectors = checked(
        data.map((item) => item.embedding),
        texts.length,
      );
      if (!vectors) return fail("provider_error");
      return { ok: true, space: { model: route.model, dimensions: vectors[0]!.length }, vectors };
    }

    const response = await doFetch(
      `${address.url}/models/${encodeURIComponent(route.model)}:batchEmbedContents`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": route.apiKey },
        body: JSON.stringify({
          requests: texts.map((text) => ({
            model: `models/${route.model}`,
            content: { parts: [{ text }] },
            taskType: "SEMANTIC_SIMILARITY",
            outputDimensionality: GEMINI_DIMENSIONS,
          })),
        }),
        signal,
        redirect,
      },
    );
    if (!response.ok) return fail(problemFromStatus(response.status), response.status);
    const body = (await response.json().catch(() => null)) as { embeddings?: { values?: unknown }[] } | null;
    const vectors = checked(
      (body?.embeddings ?? []).map((item) => item.values),
      texts.length,
    );
    if (!vectors) return fail("provider_error");
    return { ok: true, space: { model: route.model, dimensions: vectors[0]!.length }, vectors };
  } catch (error) {
    const problem = problemFromError(error);
    options.log?.warn("memory.embedding_failed", { code: problem, error });
    return { ok: false, problem };
  }
}

/* The rehearsal embedder (SINTR_FAKE_AGENT) */

const REHEARSAL_DIMENSIONS = 256;
/** The rehearsal embedder's model name, the space its vectors are in. */
export const REHEARSAL_MODEL = "rehearsal";

/** FNV-1a, 32 bits: a word's place among the rehearsal's dimensions. */
function hash(word: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < word.length; i += 1) {
    h ^= word.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * A deterministic, offline embedder for the tests and for rehearsing the
 * app without a key: each word of three letters or more (case and accents
 * folded) adds to one of 256 dimensions, so texts that share words are
 * near each other. It never touches the network, and it means nothing
 * beyond shared words.
 */
export function rehearsalEmbedding(texts: readonly string[]): Embedding {
  const vectors = texts.map((text) => {
    const vector = new Array<number>(REHEARSAL_DIMENSIONS).fill(0);
    const words = text
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= 3);
    for (const word of words) {
      const h = hash(word);
      vector[h % REHEARSAL_DIMENSIONS]! += h & 0x10000 ? 1 : -1;
    }
    // A text without words still has a direction.
    if (!vector.some((value) => value !== 0)) vector[0] = 1;
    return vector;
  });
  return { ok: true, space: { model: REHEARSAL_MODEL, dimensions: REHEARSAL_DIMENSIONS }, vectors };
}
