import "server-only";
import { voiceRouteFor, type VoiceRoute, type VoiceSource } from "@sintr/agent";
import type { UserScope } from "@sintr/core";
import { formatNext } from "@/lib/plan";
import type { VoiceView } from "@/lib/voice/view";
import { runtime } from "./runtime";

export type { VoiceView };

/** Who hears this person, and how: their own key's provider first, then the house. */
export async function voiceFor(scope: UserScope): Promise<{ source: VoiceSource | null; route: VoiceRoute }> {
  const own = await scope.agentSettings.credentials();
  return voiceRouteFor(own, runtime().config.house);
}

function providerName(
  route: { source: VoiceSource | null },
  provider: string | null,
  baseUrl: string | null,
) {
  if (route.source !== "own") return null;
  if (provider === "anthropic") return "Anthropic";
  if (provider === "google") return "Google";
  try {
    return baseUrl ? new URL(baseUrl).hostname : null;
  } catch {
    return null;
  }
}

export async function voiceView(scope: UserScope): Promise<VoiceView> {
  const voice = await voiceFor(scope);
  if (voice.route.kind === "none") {
    const settings = await scope.agentSettings.get();
    return {
      kind: "unavailable",
      reason: voice.route.reason,
      provider: providerName(voice, settings.provider, settings.baseUrl),
    };
  }
  const ready = { kind: "ready" as const, wav: voice.route.kind === "gemini", heardBy: heardBy(voice.route) };
  if (voice.source !== "house") return { ...ready, secondsLeft: null };
  const month = await scope.plans.current();
  const minutes = month.plan.allowance.audioMinutes;
  if (minutes === null) return { ...ready, secondsLeft: null };
  const left = minutes * 60 - month.spokenSeconds;
  if (left <= 0) return { kind: "limit", next: formatNext(month.period.next) };
  return { ...ready, secondsLeft: left };
}

const SERVICE_NAMES = { openrouter: "OpenRouter", openai: "OpenAI", groq: "Groq" } as const;

/** Who writes down what is said, as people are told: the service, or the endpoint's host. */
function heardBy(route: Exclude<VoiceRoute, { kind: "none" }>): string {
  if (route.kind === "gemini") return "Google";
  if (route.service !== "gateway") return SERVICE_NAMES[route.service];
  // The house's own provider may carry the name its operator gave it.
  const house = runtime().config.house;
  if (route.trusted && house && !house.voice.endpoint) return house.name;
  try {
    return new URL(route.baseUrl).hostname;
  } catch {
    return route.baseUrl;
  }
}
