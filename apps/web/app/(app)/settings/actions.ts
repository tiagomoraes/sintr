"use server";

import { ProviderSetupError, checkBaseUrl, createLanguageModel, testConnection } from "@sintr/agent";
import { rehearsalModel } from "@sintr/agent/testing";
import { ProviderKind, ValidationError, type AgentSettingsPatch } from "@sintr/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMessages } from "@/lib/server/language";
import { requireScope, runtime } from "@/lib/server/runtime";

export interface AssistantFormState {
  saved: boolean;
  problems: Record<string, string>;
}

export interface ConnectionState {
  tested: boolean;
  ok: boolean;
  /** A code from describeProviderError or the setup checks; words live in the form. */
  problem: string | null;
  rehearsal: boolean;
}

export interface PreferencesState {
  saved: boolean;
  problems: Record<string, string>;
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Save the provider, model and key. The key is sealed before it is stored. */
export async function saveAssistant(_state: AssistantFormState, form: FormData): Promise<AssistantFormState> {
  const { scope } = await requireScope();
  const said = (await getMessages()).settings.problems;
  const problems: Record<string, string> = {};
  const provider = ProviderKind.safeParse(form.get("provider"));
  if (!provider.success) return { saved: false, problems: { provider: said.provider } };
  const model = text(form, "model");
  if (!model) problems.model = said.model;
  let baseUrl: string | null = null;
  if (provider.data === "openai_compatible") {
    const checked = checkBaseUrl(text(form, "baseUrl"), runtime().config.mode);
    if (checked.ok) baseUrl = checked.url;
    else problems.baseUrl = (said.url as Record<string, string>)[checked.problem] ?? said.url.invalid_url;
    const house = runtime().config.house?.baseUrl;
    if (baseUrl && house && new URL(baseUrl).host === new URL(house).host) {
      problems.baseUrl = said.houseUrl;
    }
  }
  // The key field is never prefilled: empty means "keep the saved one".
  const key = text(form, "apiKey");
  const removeKey = form.get("removeKey") === "on" && !key;
  // A saved key stays only with the provider and address it was saved for.
  const current = await scope.agentSettings.get();
  const keyStays =
    current.hasKey && !removeKey && current.provider === provider.data && current.baseUrl === baseUrl;
  if (provider.data !== "openai_compatible" && !key && !keyStays) {
    problems.apiKey = current.hasKey && !removeKey ? said.keyOther : said.keyNeeded;
  }
  if (Object.keys(problems).length > 0) return { saved: false, problems };

  const patch: AgentSettingsPatch = {
    provider: provider.data,
    model,
    baseUrl,
    ...(key ? { apiKey: key } : removeKey ? { apiKey: null } : {}),
  };
  try {
    await scope.agentSettings.update(patch);
  } catch (error) {
    if (error instanceof ValidationError) return { saved: false, problems: { model: said.fields } };
    throw error;
  }
  if (key || removeKey) {
    await scope.auditLog.record({
      action: key ? "agent_key.saved" : "agent_key.removed",
      targetType: "agent_settings",
      metadata: { provider: provider.data },
    });
  }
  revalidatePath("/settings");
  return { saved: true, problems: {} };
}

/**
 * One real call to the saved provider. In rehearsal mode (tests) the same
 * path runs against the offline model instead, so no network is touched.
 */
export async function testAssistant(_state: ConnectionState): Promise<ConnectionState> {
  const { scope } = await requireScope();
  const { config, log } = runtime();
  const credentials = await scope.agentSettings.credentials();
  if (!credentials)
    return { tested: true, ok: false, problem: "not_configured", rehearsal: config.fakeAgent };
  if (config.fakeAgent) {
    const result = await testConnection(rehearsalModel(), log);
    return { tested: true, ok: result.ok, problem: result.ok ? null : result.problem, rehearsal: true };
  }
  try {
    const result = await testConnection(createLanguageModel(credentials, { mode: config.mode }), log);
    return { tested: true, ok: result.ok, problem: result.ok ? null : result.problem, rehearsal: false };
  } catch (error) {
    if (error instanceof ProviderSetupError)
      return { tested: true, ok: false, problem: error.code, rehearsal: false };
    throw error;
  }
}

/**
 * Back to the included assistant: the person's provider settings and key
 * are removed, so their next message goes to the house assistant, within
 * their plan. Only where there is a house assistant to go back to.
 */
export async function returnToIncludedAssistant(): Promise<void> {
  const { scope } = await requireScope();
  if (!runtime().config.house) return;
  const current = await scope.agentSettings.get();
  await scope.agentSettings.update({ provider: null, model: null, baseUrl: null, apiKey: null });
  if (current.hasKey) {
    await scope.auditLog.record({
      action: "agent_key.removed",
      targetType: "agent_settings",
      metadata: { provider: current.provider },
    });
  }
  revalidatePath("/", "layout");
  redirect("/settings?assistant=included");
}

const RETENTION: Record<string, number | null> = { keep: null, "30": 30, "90": 90, "365": 365 };

export async function savePreferences(_state: PreferencesState, form: FormData): Promise<PreferencesState> {
  const { scope } = await requireScope();
  const said = (await getMessages()).settings.problems;
  const timezone = text(form, "timezone");
  const retention = text(form, "retention");
  const problems: Record<string, string> = {};
  if (!(retention in RETENTION)) problems.retention = said.retention;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    problems.timezone = said.timezone;
  }
  if (Object.keys(problems).length > 0) return { saved: false, problems };
  await scope.profile.update({ timezone });
  await scope.agentSettings.update({ conversationRetentionDays: RETENTION[retention] ?? null });
  revalidatePath("/", "layout");
  return { saved: true, problems: {} };
}
