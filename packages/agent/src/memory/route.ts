/**
 * Who reads the diary for the memory, and who places each memory by
 * meaning (DECISIONS 115). It follows who answers, as speech does
 * (decision 87):
 * - the house: its own provider and key, when that provider has embeddings
 *   (OpenRouter's `openai/text-embedding-3-small` by default), or an
 *   endpoint of its own (SINTR_HOUSE_EMBED_*), or nobody (an Anthropic house
 *   without one, or SINTR_HOUSE_EMBED_MODEL=off);
 * - a person's own key: the same provider, so their words still go only
 *   where they chose: OpenRouter, OpenAI, or Gemini for Google. Anthropic
 *   has no embeddings, and an endpoint sintr does not know is not guessed
 *   at: the app then says the memory is not available, in one line.
 *
 * The model that reads the diary is always the one that answers the
 * person (their own key, or the house's), so the providers the person is
 * told about are the assistant's and the embeddings', and nobody else.
 */
import type { HouseAssistant, ProviderCredentials } from "@sintr/core";
import { DEFAULT_BASE_URLS } from "../providers";
import type { MemoryUnavailable } from "../shapes";

export type { MemoryUnavailable };

export type EmbeddingService = "openrouter" | "openai" | "gateway";

/** How a memory's words become a vector. */
export type EmbeddingRoute =
  | {
      kind: "openai";
      /** An OpenAI-style /embeddings endpoint. */
      service: EmbeddingService;
      baseUrl: string;
      apiKey: string | null;
      model: string;
      /** The installation's own address (the house), which may point anywhere. */
      trusted: boolean;
    }
  | { kind: "gemini"; baseUrl: string; apiKey: string; model: string; trusted: boolean }
  | { kind: "none"; reason: MemoryUnavailable };

export type MemorySource = "own" | "house";

/** Embedding models by default, for the services sintr knows, and the name people are told. */
const KNOWN_SERVICES: { host: string; service: EmbeddingService; model: string; name: string }[] = [
  {
    host: "openrouter.ai",
    service: "openrouter",
    model: "openai/text-embedding-3-small",
    name: "OpenRouter",
  },
  { host: "api.openai.com", service: "openai", model: "text-embedding-3-small", name: "OpenAI" },
];

/** Gemini's embeddings model. */
export const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";

function hostOf(baseUrl: string | null): string | null {
  if (!baseUrl) return null;
  try {
    return new URL(baseUrl).hostname.toLowerCase().replace(/\.+$/u, "");
  } catch {
    return null;
  }
}

function knownService(baseUrl: string | null) {
  const host = hostOf(baseUrl);
  return host ? (KNOWN_SERVICES.find((known) => host === known.host) ?? null) : null;
}

/** The route for one provider's credentials. `model` is an operator's choice for the house. */
function routeFor(credentials: ProviderCredentials, trusted: boolean, model: string | null): EmbeddingRoute {
  switch (credentials.provider) {
    case "anthropic":
      return { kind: "none", reason: "provider_has_no_embeddings" };
    case "google":
      if (!credentials.apiKey) return { kind: "none", reason: "provider_has_no_embeddings" };
      return {
        kind: "gemini",
        baseUrl: credentials.baseUrl ?? DEFAULT_BASE_URLS.google,
        apiKey: credentials.apiKey,
        model: model ?? GEMINI_EMBEDDING_MODEL,
        trusted,
      };
    case "openai_compatible": {
      if (!credentials.baseUrl) return { kind: "none", reason: "provider_unknown" };
      const known = knownService(credentials.baseUrl);
      // An endpoint sintr does not know is used only when its operator named the model.
      const chosen = model ?? known?.model ?? null;
      if (!chosen) return { kind: "none", reason: "provider_unknown" };
      return {
        kind: "openai",
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
 * Who would place a person's memories by meaning: their own key's provider
 * first (it is who they chose to receive their words), then the house.
 * Never the house for someone on their own key.
 */
export function memoryRouteFor(
  own: ProviderCredentials | null,
  house: HouseAssistant | null,
): { source: MemorySource | null; route: EmbeddingRoute } {
  if (own) return { source: "own", route: routeFor(own, false, null) };
  if (!house) return { source: null, route: { kind: "none", reason: "not_configured" } };
  const { memory } = house;
  if (memory.off) return { source: "house", route: { kind: "none", reason: "off" } };
  if (memory.endpoint) {
    const credentials: ProviderCredentials = {
      provider: "openai_compatible",
      baseUrl: memory.endpoint.baseUrl,
      apiKey: memory.endpoint.apiKey,
      model: memory.model ?? "",
    };
    return { source: "house", route: routeFor(credentials, true, memory.model) };
  }
  return { source: "house", route: routeFor(house, true, memory.model) };
}

/** A provider as people are told about it: a known service's name, Anthropic, Google, or the address's host. */
export function providerName(credentials: Pick<ProviderCredentials, "provider" | "baseUrl">): string | null {
  if (credentials.provider === "anthropic") return "Anthropic";
  if (credentials.provider === "google") return "Google";
  return knownService(credentials.baseUrl)?.name ?? hostOf(credentials.baseUrl);
}

/**
 * Who receives the person's diary when the memory is on, as the consent
 * names them: the provider that answers them (and reads the diary), then
 * the one that places memories by meaning, when it is another. On the
 * house, the answering provider carries the name its operator gave it.
 */
export function memoryRecipients(
  own: ProviderCredentials | null,
  house: HouseAssistant | null,
  route: { source: MemorySource | null; route: EmbeddingRoute },
): string[] {
  if (route.route.kind === "none" || !route.source) return [];
  const answers = route.source === "own" ? providerName(own!) : house!.name;
  const embeds =
    route.route.kind === "gemini"
      ? "Google"
      : route.source === "house" && !house!.memory.endpoint
        ? house!.name
        : (knownService(route.route.baseUrl)?.name ?? hostOf(route.route.baseUrl));
  return [...new Set([answers, embeds].filter((name): name is string => !!name))];
}
