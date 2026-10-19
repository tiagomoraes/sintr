"use client";

import type { AgentSettings, ProviderKind } from "@sintr/core";
import { Button, Checkbox, FieldError, FieldHint, Input, cn } from "@sintr/ui";
import { useActionState, useEffect, useRef, useState } from "react";
import type { AssistantFormState, ConnectionState } from "@/app/(app)/settings/actions";
import { submitWith } from "@/lib/use-form-action";
import { useMessages } from "@/components/language";

/** The providers offered; the one that is not a name is said in the catalog. */
const PROVIDERS: { kind: ProviderKind; name: string | null }[] = [
  { kind: "openai_compatible", name: null },
  { kind: "anthropic", name: "Anthropic" },
  { kind: "google", name: "Google" },
];

/** Common OpenAI-compatible endpoints. Ollama and LiteLLM run on your own machine. */
const PRESETS = [
  { label: "OpenAI", url: "https://api.openai.com/v1" },
  { label: "OpenRouter", url: "https://openrouter.ai/api/v1" },
  { label: "Ollama", url: "http://localhost:11434/v1" },
  { label: "LiteLLM", url: "http://localhost:4000" },
];

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
  const { form: F, test: T } = useMessages().settings;
  const connectionProblems: Record<string, string> = T.problems;
  const [state, saveAction, saving] = useActionState(save, { saved: false, problems: {} });
  const [connection, testAction, testing] = useActionState(test, {
    tested: false,
    ok: false,
    problem: null,
    rehearsal,
  });
  const [provider, setProvider] = useState<ProviderKind>(settings.provider ?? "openai_compatible");
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl ?? "");
  const label = (option: (typeof PROVIDERS)[number]) => option.name ?? F.compatible;
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
      <form onSubmit={submitWith(saveAction)} className="space-y-8" aria-label={F.label}>
        <fieldset className="min-w-0 border-0 p-0">
          <legend className="p-0 text-label font-medium text-ink">{F.provider}</legend>
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
                <span className={segmentedOption}>{label(option)}</span>
              </label>
            ))}
          </div>
          <FieldHint>
            {provider === "openai_compatible" ? F.compatibleHint : F.directHint(label(current))}
          </FieldHint>
          {state.problems.provider ? <FieldError>{state.problems.provider}</FieldError> : null}
        </fieldset>

        {provider === "openai_compatible" ? (
          <div>
            <label htmlFor="assistant-url" className="block text-label font-medium text-ink">
              {F.url}
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
            <FieldHint>{F.urlHint}</FieldHint>
            {state.problems.baseUrl ? <FieldError>{state.problems.baseUrl}</FieldError> : null}
          </div>
        ) : null}

        <div>
          <label htmlFor="assistant-model" className="block text-label font-medium text-ink">
            {F.model}
          </label>
          <Input
            id="assistant-model"
            name="model"
            autoComplete="off"
            spellCheck={false}
            defaultValue={settings.model ?? ""}
            placeholder={F.models[current.kind]}
            className="mt-2"
            aria-invalid={state.problems.model ? true : undefined}
          />
          {state.problems.model ? <FieldError>{state.problems.model}</FieldError> : null}
        </div>

        <div>
          <label htmlFor="assistant-key" className="block text-label font-medium text-ink">
            {F.key}
          </label>
          <Input
            ref={keyRef}
            id="assistant-key"
            name="apiKey"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={settings.hasKey ? F.keyKeep : F.keyPaste}
            className="mt-2"
            aria-invalid={state.problems.apiKey ? true : undefined}
          />
          <FieldHint>
            {settings.hasKey
              ? F.keySaved(settings.keyHint)
              : provider === "openai_compatible"
                ? F.keyOptional
                : F.keyFrom}
          </FieldHint>
          {settings.hasKey ? (
            <label className="mt-3 flex items-start gap-3 text-[0.9375rem] text-ink-2">
              <Checkbox ref={removeRef} name="removeKey" />
              {F.keyRemove}
            </label>
          ) : null}
          {state.problems.apiKey ? <FieldError>{state.problems.apiKey}</FieldError> : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button type="submit" disabled={saving}>
            {F.save}
          </Button>
          {state.saved ? (
            <p role="status" className="text-[0.9375rem] text-ink-2">
              {F.saved}
            </p>
          ) : null}
        </div>
      </form>

      <form onSubmit={submitWith(testAction)} className="border-t border-rule pt-6" aria-label={T.label}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button type="submit" variant="outline" size="sm" disabled={testing}>
            {testing ? T.testing : T.label}
          </Button>
          <p className="text-[0.9375rem] text-ink-3">{T.note}</p>
        </div>
        {connection.tested ? (
          <p role="status" className="mt-4 text-[0.9375rem] text-ink">
            {connection.ok
              ? connection.rehearsal
                ? T.rehearsal
                : T.ok
              : (connectionProblems[connection.problem ?? ""] ?? T.problems.provider_error)}
          </p>
        ) : null}
      </form>
    </div>
  );
}
