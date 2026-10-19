"use client";

import { Button, FieldError, Input, Textarea, cn } from "@sintr/ui";
import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import type { CheckinFormState } from "@/app/(app)/checkins/actions";
import { useHydrated } from "@/lib/use-hydrated";
import { useMessages } from "@/components/language";

const VALUES = ["0", "1", "2", "3", "4", "5"] as const;
const SCALES = ["mood", "energy", "anxiety"] as const;
type Scale = (typeof SCALES)[number];
const STEPS = [...SCALES, "sleep", "note"] as const;
/** Which step holds the field a problem is about. */
const STEP_OF: Record<string, number> = { mood: 0, energy: 1, anxiety: 2, sleepHours: 3, occurredAt: 4 };

function ScaleStep({
  name,
  value,
  onChoose,
  problem,
}: {
  name: Scale;
  value: string;
  onChoose: (value: string, byPointer: boolean) => void;
  problem?: string | undefined;
}) {
  const C = useMessages().checkin;
  const copy = C.scales[name];
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="p-0 font-serif text-title-small text-ink sm:text-[1.75rem]">{copy.question}</legend>
      <p className="mt-2 text-[0.9375rem] text-ink-3">{copy.hint}</p>
      <div className="mt-6 grid max-w-[24rem] grid-cols-6 gap-2">
        {VALUES.map((option) => (
          <label key={option} className="relative" onPointerUp={() => onChoose(option, true)}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChoose(option, false)}
              className="peer absolute inset-0 cursor-pointer opacity-0"
            />
            <span className="pointer-events-none flex aspect-square items-center justify-center rounded-full border border-rule bg-paper font-serif text-[1.375rem] tabular-nums text-ink-2 transition-[background-color,color,border-color,transform] duration-300 ease-out-expo peer-hover:border-rule-strong peer-checked:scale-105 peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
              {option}
            </span>
          </label>
        ))}
      </div>
      {/* "Not given" is where every scale starts: no value is chosen for the person. */}
      <input type="radio" name={name} value="none" checked={value === "none"} readOnly hidden />
      {problem ? <FieldError>{problem}</FieldError> : null}
    </fieldset>
  );
}

/**
 * The quick check-in as a few taps: mood, energy, anxiety, sleep, a line
 * about the day, one a screen. A tap on a number moves on; any question can
 * be skipped, and "Save it now" keeps what was given so far. It is one form
 * underneath, so without JavaScript every question shows at once and it
 * still saves.
 */
export function CheckinSteps({
  action,
  cancelHref,
}: {
  action: (state: CheckinFormState, form: FormData) => Promise<CheckinFormState>;
  cancelHref: string;
}) {
  const C = useMessages().checkin;
  const [state, formAction, pending] = useActionState(action, { problems: {}, failure: null });
  const hydrated = useHydrated();
  const [step, setStep] = useState(0);
  const [scales, setScales] = useState<Record<Scale, string>>({
    mood: "none",
    energy: "none",
    anxiety: "none",
  });
  const [when, setWhen] = useState(false);
  // A problem from the server takes the person to the question it is about.
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    const first = Object.keys(state.problems).find((field) => field in STEP_OF);
    if (first) setStep(STEP_OF[first]!);
  }
  const last = STEPS.length - 1;
  const next = () => setStep((current) => Math.min(last, current + 1));

  const section = (index: number, children: ReactNode) => (
    <section
      key={STEPS[index]}
      hidden={hydrated && step !== index}
      className={cn(
        "min-h-[16rem]",
        hydrated ? "sintr-rise" : "border-t border-rule pt-8 first:border-t-0 first:pt-0",
      )}
    >
      {children}
    </section>
  );

  return (
    <form action={formAction} className="max-w-[40rem]" aria-label={C.allAtOnce}>
      {hydrated ? (
        <p className="mb-6 flex items-center gap-3 text-caption text-ink-3">
          <span aria-hidden="true" className="flex gap-1.5">
            {STEPS.map((name, i) => (
              <span
                key={name}
                className={cn("h-[3px] w-5 rounded-pill", i <= step ? "bg-ink" : "bg-rule-strong")}
              />
            ))}
          </span>
          {C.progress(step + 1, STEPS.length)}
        </p>
      ) : null}
      <div className="space-y-8">
        {SCALES.map((name, index) =>
          section(
            index,
            <ScaleStep
              name={name}
              value={scales[name]}
              problem={state.problems[name]}
              onChoose={(value, byPointer) => {
                setScales((current) => ({ ...current, [name]: value }));
                // A tap is an answer; arrow keys only move the choice.
                if (byPointer) setTimeout(next, 280);
              }}
            />,
          ),
        )}
        {section(
          3,
          <div>
            <h2 className="font-serif text-title-small font-normal text-ink sm:text-[1.75rem]">
              {C.sleep.question}
            </h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <div>
                <label htmlFor="checkin-sleep" className="block text-label font-medium text-ink">
                  {C.sleep.hours}
                </label>
                <Input
                  id="checkin-sleep"
                  name="sleepHours"
                  inputMode="decimal"
                  placeholder={C.sleep.hoursPlaceholder}
                  className="mt-2 h-14 text-[1.125rem] tabular-nums"
                  aria-invalid={state.problems.sleepHours ? true : undefined}
                />
                {state.problems.sleepHours ? <FieldError>{state.problems.sleepHours}</FieldError> : null}
              </div>
              <div>
                <label htmlFor="checkin-quality" className="block text-label font-medium text-ink">
                  {C.sleep.quality}
                </label>
                <Input
                  id="checkin-quality"
                  name="sleepQuality"
                  placeholder={C.sleep.qualityPlaceholder}
                  className="mt-2 h-14"
                />
              </div>
            </div>
          </div>,
        )}
        {section(
          4,
          <div>
            <h2 className="font-serif text-title-small font-normal text-ink sm:text-[1.75rem]">
              {C.note.question}
            </h2>
            <label htmlFor="checkin-note" className="mt-6 block text-label font-medium text-ink">
              {C.note.label}
            </label>
            <Textarea id="checkin-note" name="note" rows={3} className="mt-2" />
            <p className="mt-2 text-caption text-ink-3">{C.note.hint}</p>
            <div className="mt-6">
              {when || !hydrated ? (
                <>
                  <label htmlFor="checkin-when" className="block text-label font-medium text-ink">
                    {C.note.when}
                  </label>
                  <Input
                    id="checkin-when"
                    type="datetime-local"
                    name="occurredAt"
                    className="mt-2 max-w-xs"
                  />
                  <p className="mt-2 text-caption text-ink-3">{C.note.whenHint}</p>
                  {state.problems.occurredAt ? <FieldError>{state.problems.occurredAt}</FieldError> : null}
                </>
              ) : (
                <p className="text-[0.9375rem] text-ink-3">
                  {C.note.now}{" "}
                  <button
                    type="button"
                    onClick={() => setWhen(true)}
                    className="text-ink underline decoration-rule-strong underline-offset-[0.28em] hover:decoration-ink"
                  >
                    {C.note.change}
                  </button>
                </p>
              )}
            </div>
          </div>,
        )}
      </div>
      {state.failure ? <FieldError className="mt-6">{state.failure}</FieldError> : null}
      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
        {hydrated && step < last ? (
          <>
            {step < SCALES.length && scales[STEPS[step] as Scale] === "none" ? (
              // On a number question the tap is the answer; moving on without one is the quiet way.
              <Button type="button" variant="outline" onClick={next}>
                {C.skip}
              </Button>
            ) : (
              <Button type="button" onClick={next} className="max-sm:w-full">
                {C.next}
              </Button>
            )}
            <Button type="submit" variant="quiet" size="inline" disabled={pending}>
              {C.saveNow}
            </Button>
          </>
        ) : (
          <Button type="submit" disabled={pending} className="max-sm:w-full">
            {C.save}
          </Button>
        )}
        {hydrated && step > 0 ? (
          <Button type="button" variant="quiet" size="inline" onClick={() => setStep(step - 1)}>
            {C.back}
          </Button>
        ) : (
          <Link
            href={cancelHref}
            className="text-[0.9375rem] text-ink-2 underline decoration-rule-strong underline-offset-[0.28em] hover:text-ink"
          >
            {C.cancel}
          </Link>
        )}
      </div>
    </form>
  );
}
