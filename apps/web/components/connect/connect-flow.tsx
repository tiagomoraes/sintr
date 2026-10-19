"use client";

import { Button, FieldError, FieldHint, Input } from "@sintr/ui";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import type { MakeKeyState } from "@/app/(app)/connect/actions";
import { useMessages } from "@/components/language";
import { ACCESS_ORDER, KEY_PLACEHOLDER } from "@/lib/connect";
import { useHydrated } from "@/lib/use-hydrated";
import { submitWith } from "@/lib/use-form-action";
import { ClientGuides } from "./client-guides";
import { CopyButton } from "./copy-button";
import { UseMark, type KeyView } from "./key-list";

/** While a new key waits for its first call, look again every few seconds (only while the page is in view). */
function useRefreshWhile(waiting: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!waiting) return;
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > 15 * 60_000) clearInterval(timer);
      else if (document.visibilityState === "visible") router.refresh();
    }, 4000);
    return () => clearInterval(timer);
  }, [waiting, router]);
}

function KeyPanel({
  made,
  status,
  onDone,
}: {
  made: { token: string; name: string };
  status: KeyView | undefined;
  onDone: () => void;
}) {
  const P = useMessages().connect.panel;
  const connected = status?.used ?? false;
  return (
    <div className="mt-6 rounded-file border border-rule bg-paper p-5 shadow-card sm:p-6">
      <p className="font-medium text-ink [overflow-wrap:anywhere]">{P.for(made.name)}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-command border border-rule bg-wash py-2 pl-4 pr-2">
        <code className="min-w-0 flex-1 basis-56 font-mono text-[0.875rem] text-ink [overflow-wrap:anywhere]">
          {made.token}
        </code>
        <CopyButton text={made.token} label={P.key} />
      </div>
      <p className="mt-3 text-[0.9375rem] text-ink">{P.copyNow}</p>
      <p className="mt-1 text-[0.9375rem] text-ink-3">{P.filled}</p>
      <p role="status" className="mt-5 border-t border-rule pt-4 text-[0.9375rem] text-ink-2">
        <UseMark used={connected} />
        {connected ? P.connected(status!.lastTalked) : P.waiting}
      </p>
      <Button type="button" variant="quiet" size="inline" onClick={onDone} className="mt-4 text-[0.9375rem]">
        {P.hide}
      </Button>
    </div>
  );
}

/**
 * The walk from nothing to a connected assistant: what it is, one button
 * for a key (shown once), the steps for each assistant with the key filled
 * in, and a line that turns to "Connected" when the assistant first calls.
 */
export function ConnectFlow({
  appUrl,
  reachableHere,
  keys,
  make,
  connected,
}: {
  appUrl: string;
  reachableHere: boolean;
  keys: readonly KeyView[];
  make: (state: MakeKeyState, form: FormData) => Promise<MakeKeyState>;
  /** The keys that work, rendered on the server: first for a returning person, after the steps during a setup. */
  connected: ReactNode;
}) {
  const C = useMessages().connect;
  const how = [C.how.make, C.how.give, C.how.talk];
  const hydrated = useHydrated();
  const [state, action, pending] = useActionState(make, { key: null, problem: null });
  const [hiddenId, setHiddenId] = useState<string | null>(null);
  const [listedId, setListedId] = useState<string | null>(null);
  const fresh = state.key && state.key.id !== hiddenId ? state.key : null;
  const status = fresh ? keys.find((key) => key.id === fresh.id) : undefined;
  if (fresh && status && listedId !== fresh.id) setListedId(fresh.id);
  // Listed once and gone now: it was disconnected, so it is not shown or waited for any more.
  const made = fresh && !(listedId === fresh.id && !status) ? fresh : null;
  useRefreshWhile(Boolean(made && !status?.used));

  return (
    <>
      {made ? null : connected}
      <section aria-labelledby="connect-title" className="max-w-[40rem]">
        <h2 id="connect-title" className="font-serif text-title-small font-normal text-ink">
          {made ? C.heading.made : keys.length ? C.heading.another : C.heading.first}
        </h2>
        {made ? (
          <KeyPanel made={made} status={status} onDone={() => setHiddenId(made.id)} />
        ) : (
          <form onSubmit={submitWith(action)} className="mt-6" aria-label={C.make.button}>
            <Button type="submit" disabled={!hydrated || pending}>
              {pending ? C.make.making : C.make.button}
            </Button>
            {state.problem ? <FieldError>{state.problem}</FieldError> : null}
            <details className="group mt-5">
              <summary className="cursor-pointer list-none text-[0.9375rem] font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden="true"
                  className="mr-2.5 inline-block size-[7px] -translate-y-px rotate-[-45deg] border-b-[1.5px] border-r-[1.5px] border-current transition-transform duration-[400ms] group-open:rotate-45 motion-reduce:transition-none"
                />
                {C.make.more}
              </summary>
              <div className="mt-5 space-y-6">
                <div>
                  <label htmlFor="key-name" className="block text-label font-medium text-ink">
                    {C.make.name} <span className="font-normal text-ink-3">{C.make.optional}</span>
                  </label>
                  <Input
                    id="key-name"
                    name="name"
                    maxLength={80}
                    autoComplete="off"
                    placeholder={C.make.placeholder}
                    className="mt-2"
                  />
                  <FieldHint>{C.make.hint}</FieldHint>
                </div>
                <fieldset className="min-w-0 border-0 p-0">
                  <legend className="p-0 text-label font-medium text-ink">{C.make.access}</legend>
                  <div className="mt-3 space-y-3">
                    {ACCESS_ORDER.map((access) => (
                      <label key={access} className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="access"
                          value={access}
                          defaultChecked={access === "read_write"}
                          className="mt-1 size-4 shrink-0 accent-ink"
                        />
                        <span>
                          <span className="block font-medium text-ink">{C.access[access].label}</span>
                          <span className="block text-[0.9375rem] text-ink-2">{C.access[access].hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </details>
          </form>
        )}
        {made ? null : (
          <ol className="mt-10 grid gap-5 sm:grid-cols-3" aria-label={C.how.label}>
            {how.map((step, index) => (
              <li
                key={step.title}
                className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 border-t border-ink pt-4 sm:block"
              >
                <span
                  aria-hidden="true"
                  className="font-serif text-[1.375rem] font-light leading-[1.2] text-ink-soft sm:text-[1.75rem] sm:leading-none"
                >
                  {index + 1}
                </span>
                <div>
                  <p className="font-serif text-[1.125rem] text-ink sm:mt-2">{step.title}</p>
                  <p className="mt-1 text-[0.9375rem] text-ink-2 sm:mt-1.5">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="setup-title" className="mt-16 max-w-[40rem] border-t border-rule pt-12">
        <h2 id="setup-title" className="font-serif text-title-small font-normal text-ink">
          {C.setup.title}
        </h2>
        <p className="mt-3 max-w-[36em] text-ink-2">
          {made ? C.setup.made : C.setup.waiting(KEY_PLACEHOLDER)}
        </p>
        <div className="mt-8">
          <ClientGuides
            appUrl={appUrl}
            keyText={made?.token ?? KEY_PLACEHOLDER}
            reachableHere={reachableHere}
          />
        </div>
      </section>
      {made ? <div className="mt-16">{connected}</div> : null}
    </>
  );
}
