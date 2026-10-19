import type { HouseAssistant, Meter, Taken, UserScope } from "@sintr/core";
import type { LanguageModel } from "ai";
import { ProviderSetupError, createLanguageModel } from "./providers";
import { rehearsalModel } from "./testing";

/** What deciding the assistant needs from the configuration. */
export interface AssistantConfig {
  mode: "selfhost" | "saas";
  /** SINTR_FAKE_AGENT: every call goes to the offline rehearsal model (tests). */
  fakeAgent: boolean;
  /** The installation's own assistant, if it has one. */
  house: HouseAssistant | null;
}

/** "own": the person's own key, never counted. "house": the installation's, within the person's plan. */
export type AssistantSource = "own" | "house";

export type AssistantProblem = "not_configured" | ProviderSetupError["code"];

export type ResolvedAssistant =
  | { ok: true; source: AssistantSource; model: LanguageModel; rehearsal: boolean }
  | { ok: false; source: AssistantSource | null; problem: AssistantProblem };

/**
 * The model behind a person's conversation and report. Their own key comes
 * first, whenever they saved one: their words then go only to the provider
 * they chose, and a broken key of theirs is reported, never replaced by the
 * house's (that would send their words somewhere they did not choose).
 * Without one, the house assistant, if the installation has one. With
 * neither, `not_configured`: the app points to the door for a key.
 */
export async function resolveAssistant(
  scope: UserScope,
  config: AssistantConfig,
  options: { fetch?: typeof fetch } = {},
): Promise<ResolvedAssistant> {
  const own = await scope.agentSettings.credentials();
  const source: AssistantSource | null = own ? "own" : config.house ? "house" : null;
  const credentials = own ?? config.house;
  if (!source || !credentials) return { ok: false, source: null, problem: "not_configured" };
  // A person's own provider is never the house's own address: that would be the house, uncounted.
  if (own && config.house?.baseUrl && sameHost(own.baseUrl, config.house.baseUrl)) {
    return { ok: false, source: "own", problem: "private_address" };
  }
  if (config.fakeAgent) return { ok: true, source, model: rehearsalModel(), rehearsal: true };
  try {
    const model = createLanguageModel(credentials, {
      mode: config.mode,
      ...(source === "house" ? { trusted: true } : {}),
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
    return { ok: true, source, model, rehearsal: false };
  } catch (error) {
    if (error instanceof ProviderSetupError) return { ok: false, source, problem: error.code };
    throw error;
  }
}

function sameHost(a: string | null, b: string): boolean {
  try {
    return a !== null && new URL(a).host.toLowerCase() === new URL(b).host.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * One unit of the house assistant's monthly meter: taken right before the
 * model runs, given back to the same month if the call fails. A person's own
 * key is never metered, so nothing of this runs for them.
 */
export interface Metered {
  take(): Promise<Taken>;
  giveBack(): Promise<void>;
}

export function metered(
  scope: UserScope,
  meter: Exclude<Meter, "audioMinutes">,
  now: () => Date = () => new Date(),
): Metered {
  let taken: Taken | null = null;
  return {
    async take() {
      taken = await scope.plans.take(meter, now());
      return taken;
    },
    async giveBack() {
      if (!taken?.ok) return;
      const { period } = taken;
      taken = null;
      await scope.plans.giveBack(meter, period);
    },
  };
}
