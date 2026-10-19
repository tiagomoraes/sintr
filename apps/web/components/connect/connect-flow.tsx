"use client";

import { Button, FieldError, FieldHint, Input } from "@sintr/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import type { MakeKeyState } from "@/app/(app)/connect/actions";
import { useMessages } from "@/components/language";
import { ACCESS_ORDER, KEY_PLACEHOLDER, clientNamed } from "@/lib/connect";
import { useHydrated } from "@/lib/use-hydrated";
import { submitWith } from "@/lib/use-form-action";
import { ClientGuides } from "./client-guides";
import { CopyButton } from "./copy-button";
import { AccessMark, UseMark, type KeyView } from "./key-list";

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

const NOTHING_YET: MakeKeyState = {
  key: null,
  problems: {},
  failure: null,
  values: { name: "", access: null },
};

/** A drawn radio, the therapy form's: an open ring, filled with ink once chosen. */
const radio =
  "mt-[0.3em] size-4 shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-ink-soft bg-paper checked:border-[5px] checked:border-ink";

/**
 * The key just made, shown once: whom it is for, what it may do (its own
 * limits, as the form said them), the key with its copy button, and the line
 * that turns to "Connected" when the assistant first calls.
 */
function KeyPanel({
  made,
  status,
  onDone,
}: {
  made: NonNullable<MakeKeyState["key"]>;
  status: KeyView | undefined;
  onDone: () => void;
}) {
  const C = useMessages().connect;
  const P = C.panel;
  const hydrated = useHydrated();
  const connected = status?.used ?? false;
  return (
    <div className="mt-6 rounded-file border border-rule bg-paper p-5 shadow-card sm:p-6">
      <p className="font-medium text-ink [overflow-wrap:anywhere]">
        {P.for(made.name)}
        <AccessMark>{C.access[made.access].label}</AccessMark>
      </p>
      <p className="mt-2 text-[0.9375rem] text-ink-2">{C.access[made.access].does}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-command border border-rule bg-wash py-2 pl-4 pr-2">
        <code className="min-w-0 flex-1 basis-56 font-mono text-[0.875rem] text-ink [overflow-wrap:anywhere]">
          {made.token}
        </code>
        <CopyButton text={made.token} label={P.key} />
      </div>
      <p className="mt-3 text-[0.9375rem] text-ink">{P.copyNow}</p>
      <p className="mt-1 text-[0.9375rem] text-ink-3">{P.filled}</p>
      <p role="status" className="mt-5 border-t border-rule pt-4 text-[0.9375rem] text-ink-2">
        <UseMark used={connected} />
        {connected ? P.connected(status!.lastTalked) : hydrated ? P.waiting : P.waitingStill}
      </p>
      {/* Without JavaScript, leaving for the page as it is now hides the key just the same. */}
      <Button asChild variant="quiet" size="inline" className="mt-4 text-[0.9375rem]">
        <Link
          href="/connect"
          onClick={(event) => {
            event.preventDefault();
            onDone();
          }}
        >
          {connected ? P.done : P.hide}
        </Link>
      </Button>
    </div>
  );
}

/** The three steps, for someone connecting an assistant for the first time. */
function HowItWorks() {
  const C = useMessages().connect;
  const how = [C.how.make, C.how.give, C.how.talk];
  return (
    <ol className="mt-6 grid gap-5 sm:grid-cols-3" aria-label={C.how.label}>
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
  );
}

/**
 * The decisions first and the action last, as every product that hands out
 * a key orders them: which assistant it is for (its name in the list), what
 * it may do (chosen on purpose, nothing chosen for the person), then the
 * button, with the one thing to know before pressing it. Nothing is folded
 * away. It posts as a plain form until the page is alive, so a key can be
 * made without JavaScript; once alive it keeps what was typed if it comes
 * back with a problem.
 */
function MakeKeyForm({
  state,
  action,
  pending,
}: {
  state: MakeKeyState;
  action: (form: FormData) => void;
  pending: boolean;
}) {
  const C = useMessages().connect;
  const { problems, values } = state;
  return (
    <form
      action={action}
      onSubmit={submitWith(action)}
      className="mt-10 space-y-9"
      aria-labelledby="connect-title"
    >
      <div>
        <label htmlFor="key-name" className="block text-label font-medium text-ink">
          {C.make.name}
        </label>
        <Input
          id="key-name"
          name="name"
          required
          maxLength={80}
          autoComplete="off"
          placeholder={C.make.placeholder}
          defaultValue={values.name}
          aria-invalid={problems.name ? true : undefined}
          aria-describedby="key-name-note"
          className="mt-2"
        />
        {problems.name ? (
          <FieldError id="key-name-note">{problems.name}</FieldError>
        ) : (
          <FieldHint id="key-name-note">{C.make.hint}</FieldHint>
        )}
      </div>
      <fieldset className="min-w-0 border-0 p-0" aria-describedby="key-access-note">
        <legend className="p-0 text-label font-medium text-ink">{C.make.access}</legend>
        <div className="mt-3 space-y-2.5">
          {ACCESS_ORDER.map((access) => (
            <label
              key={access}
              className="flex cursor-pointer items-start gap-3.5 rounded-file border border-rule bg-paper px-4 py-3.5 transition-colors duration-300 hover:border-rule-strong has-[:checked]:border-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink sm:px-5 sm:py-4"
            >
              <input
                type="radio"
                name="access"
                value={access}
                required
                defaultChecked={values.access === access}
                className={radio}
              />
              <span className="min-w-0">
                <span className="block font-medium text-ink">{C.access[access].label}</span>
                <span className="mt-0.5 block text-[0.9375rem] text-ink-2">
                  {C.access[access].does} {C.access[access].when}
                </span>
              </span>
            </label>
          ))}
        </div>
        {problems.access ? (
          <FieldError id="key-access-note">{problems.access}</FieldError>
        ) : (
          <FieldHint id="key-access-note">{C.make.accessHint}</FieldHint>
        )}
      </fieldset>
      <div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button type="submit" disabled={pending}>
            {pending ? C.make.making : C.make.button}
          </Button>
          <p className="text-[0.9375rem] text-ink-3">{C.make.once}</p>
        </div>
        {state.failure ? <FieldError>{state.failure}</FieldError> : null}
      </div>
    </form>
  );
}

/**
 * The walk from nothing to a connected assistant: what it is, the decisions
 * a key is made of and the button after them, the key shown once with what
 * it may do, the steps for each assistant with the key filled in (its own
 * first, when its name says which), and a line that turns to "Connected"
 * when the assistant first calls.
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
  const [state, action, pending] = useActionState(make, NOTHING_YET);
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
          <>
            {keys.length ? null : <HowItWorks />}
            <MakeKeyForm state={state} action={action} pending={pending} />
          </>
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
            prefer={made ? clientNamed(made.name) : null}
          />
        </div>
      </section>
      {made ? <div className="mt-16">{connected}</div> : null}
    </>
  );
}
