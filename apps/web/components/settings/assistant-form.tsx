"use client";

import type { AgentSettings, ProviderKind } from "@sintr/core";
import { Button, Checkbox, FieldError, FieldHint, Input, cn } from "@sintr/ui";
import { useActionState, useEffect, useRef, useState } from "react";
import type { AssistantFormState, ConnectionState } from "@/app/(app)/settings/actions";
import { submitWith } from "@/lib/use-form-action";

const PROVIDERS: { kind: ProviderKind; label: string; model: string }[] = [
  { kind: "openai_compatible", label: "OpenAI-compatible", model: "The model name at that endpoint" },
  { kind: "anthropic", label: "Anthropic", model: "For example claude-sonnet-5-5" },
  { kind: "google", label: "Google", model: "The Gemini model name" },
];

/** Common OpenAI-compatible endpoints. Ollama and LiteLLM run on your own machine. */
const PRESETS = [
  { label: "OpenAI", url: "https://api.openai.com/v1" },
  { label: "OpenRouter", url: "https://openrouter.ai/api/v1" },
  { label: "Ollama", url: "http://localhost:11434/v1" },
  { label: "LiteLLM", url: "http://localhost:4000" },
];

const CONNECTION_COPY: Record<string, string> = {
  not_configured: "Save a provider and a model first.",
  key_required: "This provider needs an API key.",
  base_url_required: "This provider needs its address.",
  key_refused: "The provider refused the key. Check that it is complete and still active.",
  model_not_found: "The provider does not know this model. Check its name.",
  rate_limited: "The provider is busy, or the key has reached its limit. Try again in a moment.",
  unreachable: "The provider could not be reached. Check the address, and that it is running.",
  timeout: "The provider took too long to answer.",
  provider_error: "The provider answered with an error. Check the model and the key.",
  invalid_url: "The address does not look right.",
  credentials_in_url: "The address must not contain a password.",
  https_required: "The address has to use https here.",
  private_address: "The address has to be a public one here.",
};

const segmentedOption =
  "pointer-events-none flex min-h-10 items-center rounded-pill px-4 text-[0.9375rem] font-medium text-ink-2 transition-colors duration-300 peer-hover:bg-wash peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink";

export function AssistantForm({
  settings,
  save,
  test,
  rehearsal,
}: {
  settings: AgentSettings;
  save: (state: AssistantFormState, form: FormData) => Promise<AssistantFormState>;
  test: (state: ConnectionState) => Promise<ConnectionState>;
  rehearsal: boolean;
}) {
  const [state, saveAction, saving] = useActionState(save, { saved: false, problems: {} });
  const [connection, testAction, testing] = useActionState(test, {
    tested: false,
    ok: false,
    problem: null,
    rehearsal,
  });
  const [provider, setProvider] = useState<ProviderKind>(settings.provider ?? "openai_compatible");
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl ?? "");
  const current = PROVIDERS.find((p) => p.kind === provider)!;
  const keyRef = useRef<HTMLInputElement>(null);
  const removeRef = useRef<HTMLInputElement>(null);
  // A saved key leaves the page: the field is emptied once it is stored.
  useEffect(() => {
    if (!state.saved) return;
    if (keyRef.current) keyRef.current.value = "";
    if (removeRef.current) removeRef.current.checked = false;
  }, [state]);

  return (
    <div className="space-y-10">
      <form onSubmit={submitWith(saveAction)} className="space-y-8" aria-label="The assistant">
        <fieldset className="min-w-0 border-0 p-0">
          <legend className="p-0 text-label font-medium text-ink">Provider</legend>
          <div className="mt-3 inline-flex max-w-full flex-wrap gap-1 rounded-[26px] border border-rule bg-paper p-1">
            {PROVIDERS.map((option) => (
              <label key={option.kind} className="relative">
                <input
                  type="radio"
                  name="provider"
                  value={option.kind}
                  checked={provider === option.kind}
                  onChange={() => setProvider(option.kind)}
                  className="peer absolute inset-0 cursor-pointer opacity-0"
                />
                <span className={segmentedOption}>{option.label}</span>
              </label>
            ))}
          </div>
          <FieldHint>
            {provider === "openai_compatible"
              ? "Any endpoint that speaks the OpenAI chat API: OpenAI itself, OpenRouter, Ollama, LiteLLM and others."
              : `sintr talks to ${current.label} directly, with your key.`}
          </FieldHint>
          {state.problems.provider ? <FieldError>{state.problems.provider}</FieldError> : null}
        </fieldset>

        {provider === "openai_compatible" ? (
          <div>
            <label htmlFor="assistant-url" className="block text-label font-medium text-ink">
              Address of the endpoint
            </label>
            <Input
              id="assistant-url"
              name="baseUrl"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.openai.com/v1"
              className="mt-2"
              aria-invalid={state.problems.baseUrl ? true : undefined}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setBaseUrl(preset.url)}
                  className={cn(
                    "inline-flex min-h-8 items-center rounded-pill border px-3.5 text-[0.8125rem] font-medium transition-colors duration-300",
                    baseUrl === preset.url
                      ? "border-ink bg-ink text-paper"
                      : "border-rule text-ink-2 hover:border-rule-strong hover:text-ink",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <FieldHint>
              When sintr runs in Docker, a model on the same machine is at http://host.docker.internal instead
              of localhost.
            </FieldHint>
            {state.problems.baseUrl ? <FieldError>{state.problems.baseUrl}</FieldError> : null}
          </div>
        ) : null}

        <div>
          <label htmlFor="assistant-model" className="block text-label font-medium text-ink">
            Model
          </label>
          <Input
            id="assistant-model"
            name="model"
            autoComplete="off"
            spellCheck={false}
            defaultValue={settings.model ?? ""}
            placeholder={current.model}
            className="mt-2"
            aria-invalid={state.problems.model ? true : undefined}
          />
          {state.problems.model ? <FieldError>{state.problems.model}</FieldError> : null}
        </div>

        <div>
          <label htmlFor="assistant-key" className="block text-label font-medium text-ink">
            API key
          </label>
          <Input
            ref={keyRef}
            id="assistant-key"
            name="apiKey"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={settings.hasKey ? "Leave empty to keep the saved key" : "Paste your key"}
            className="mt-2"
            aria-invalid={state.problems.apiKey ? true : undefined}
          />
          <FieldHint>
            {settings.hasKey
              ? `A key is saved${settings.keyHint ? `, ending in ${settings.keyHint}` : ""}. It is never shown again, and changing the provider or its address removes it.`
              : provider === "openai_compatible"
                ? "Optional for a local endpoint such as Ollama."
                : "From your account with the provider."}
          </FieldHint>
          {settings.hasKey ? (
            <label className="mt-3 flex items-start gap-3 text-[0.9375rem] text-ink-2">
              <Checkbox ref={removeRef} name="removeKey" />
              Remove the saved key
            </label>
          ) : null}
          {state.problems.apiKey ? <FieldError>{state.problems.apiKey}</FieldError> : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button type="submit" disabled={saving}>
            Save the assistant
          </Button>
          {state.saved ? (
            <p role="status" className="text-[0.9375rem] text-ink-2">
              Saved.
            </p>
          ) : null}
        </div>
      </form>

      <form
        onSubmit={submitWith(testAction)}
        className="border-t border-rule pt-6"
        aria-label="Test the connection"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button type="submit" variant="outline" size="sm" disabled={testing}>
            {testing ? "Testing" : "Test the connection"}
          </Button>
          <p className="text-[0.9375rem] text-ink-3">
            One short request to the provider, with the saved settings.
          </p>
        </div>
        {connection.tested ? (
          <p role="status" className="mt-4 text-[0.9375rem] text-ink">
            {connection.ok
              ? connection.rehearsal
                ? "The rehearsal assistant answered. It is offline and scripted, so nothing left this machine."
                : "The assistant answered. You are ready to talk."
              : (CONNECTION_COPY[connection.problem ?? ""] ?? CONNECTION_COPY.provider_error)}
          </p>
        ) : null}
      </form>
    </div>
  );
}
