"use client";

import { Button, FieldError, Input, Rise, RoomLight, Wordmark, cn, type RoomScene } from "@sintr/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  acceptInWelcome,
  beginWelcome,
  finishWelcome,
  saveName,
  saveSession,
  saveTherapist,
} from "@/app/welcome/actions";
import { AcceptAsPersonForm } from "@/components/sharing/join-forms";
import { SupportStrip } from "@/components/talk/support-strip";
import { InvitePromises } from "@/components/sharing/invite-promises";
import { timeOfDay } from "@/lib/time-of-day";
import { t } from "@/messages";

/** A practice's invite the person arrived with, as the invite's own page would show it. */
export interface WelcomeInvite {
  code: string;
  who: string;
  professionalName: string;
  details: string | null;
  /** The practice as shown; the consent names exactly this. */
  shown: string;
  /** The name the person put on their reports, if any, printed on every report they share. */
  reportName: string | null;
}

type Step = "start" | "name" | "invite" | "therapist" | "session" | "ready";

const SCENES: Record<Step, RoomScene> = {
  start: "welcome",
  name: "name",
  invite: "invite",
  therapist: "therapist",
  session: "session",
  ready: "ready",
};

const W = t.welcome;
const noSubscription = () => () => undefined;

/** "America/Sao_Paulo" as "Sao Paulo". */
function place(zone: string): string {
  return (zone.split("/").at(-1) ?? zone).replaceAll("_", " ");
}

function StepFrame({
  index,
  of,
  heading,
  body,
  children,
}: {
  index: number | null;
  of: number;
  heading: ReactNode;
  body?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full max-w-[36rem] flex-1 flex-col pt-[clamp(20px,7vh,88px)]">
      {index !== null ? (
        <Rise as="p" index={0} className="mb-5 flex items-center gap-3 text-caption text-ink-3">
          <span aria-hidden="true" className="flex gap-1.5">
            {Array.from({ length: of }, (_, i) => (
              <span
                key={i}
                className={cn("h-[3px] w-5 rounded-pill", i < index ? "bg-ink" : "bg-rule-strong")}
              />
            ))}
          </span>
          {W.progress(index, of)}
        </Rise>
      ) : null}
      <Rise index={1}>
        <h1 tabIndex={-1} data-step-heading className="text-title outline-none">
          {heading}
        </h1>
      </Rise>
      {body ? (
        <Rise as="p" index={2} className="mt-4 max-w-[32em] text-lede text-ink-2">
          {body}
        </Rise>
      ) : null}
      {children}
    </div>
  );
}

/** The step's actions: at the bottom of the screen on a phone, where the thumb is; under the question on a desk. */
function Actions({ children }: { children: ReactNode }) {
  return (
    <Rise
      index={4}
      className="mt-auto flex flex-wrap items-center gap-x-7 gap-y-4 pt-10 sm:mt-10 [&>button:first-child]:max-sm:w-full"
    >
      {children}
    </Rise>
  );
}

/**
 * The welcome, as a narrative: a calm first screen, then one question a
 * screen (how to call the person, the invite they arrived with, their
 * therapist, when the sessions are), then the home, already set up. Each
 * answer is saved as the person goes on; every question can be skipped,
 * and the light moves to a new place on the wall with each one. The steps
 * live in the address, so the phone's back gesture goes back a question.
 */
export function WelcomeFlow({
  next,
  invite: arrivedWith,
  timezones,
  saved,
}: {
  next: string | null;
  invite: WelcomeInvite | null;
  timezones: string[];
  saved: { name: string; therapist: string; day: string; time: string; timezone: string };
}) {
  const params = useSearchParams();
  // The invite the person arrived with, as it was then: once accepted it no longer previews as valid,
  // and the page may be rendered again on the way.
  const [invite] = useState(arrivedWith);
  const steps: Step[] = [
    "start",
    "name",
    ...(invite ? (["invite"] as const) : []),
    "therapist",
    "session",
    "ready",
  ];
  const asked: Step[] = steps.filter((step) => step !== "start" && step !== "ready");
  const requested = params.get("step") as Step | null;
  const step: Step = requested && steps.includes(requested) ? requested : "start";

  const [name, setName] = useState(saved.name);
  const [therapist, setTherapist] = useState(saved.therapist || invite?.professionalName || "");
  const [day, setDay] = useState(saved.day);
  const [time, setTime] = useState(saved.time);
  // The device's own zone, read in the browser, unless the person already chose one.
  const device = useSyncExternalStore(
    noSubscription,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
  const [chosenZone, setChosenZone] = useState<string | null>(
    saved.timezone !== "UTC" ? saved.timezone : null,
  );
  const zone = chosenZone ?? (device && timezones.includes(device) ? device : saved.timezone);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [linked, setLinked] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hour = useSyncExternalStore(
    noSubscription,
    () => new Date().getHours(),
    () => 9,
  );
  const frame = useRef<HTMLDivElement>(null);

  function go(target: Step) {
    setProblem(null);
    const url = new URLSearchParams(params.toString());
    if (target === "start") url.delete("step");
    else url.set("step", target);
    window.history.pushState(null, "", `/welcome${url.size ? `?${url.toString()}` : ""}`);
  }
  // Each new question is where focus goes, once it has rendered (not on arrival: the page starts at the top).
  const arrived = useRef(step);
  useEffect(() => {
    if (arrived.current === step) return;
    arrived.current = step;
    const field = frame.current?.querySelector<HTMLElement>("input:not([type=hidden]):not([type=radio])");
    (field ?? frame.current?.querySelector<HTMLElement>("[data-step-heading]"))?.focus();
  }, [step]);
  const after = (current: Step) => steps[steps.indexOf(current) + 1] ?? "ready";
  const before = (current: Step) => steps[Math.max(0, steps.indexOf(current) - 1)] ?? "start";

  /** Save, then move on; a problem keeps the person on the question with one sentence. */
  function saveThen(save: () => Promise<{ ok: boolean; problem: string | null }>, then: Step) {
    startTransition(async () => {
      try {
        const result = await save();
        if (result.ok) go(then);
        else setProblem(result.problem);
      } catch {
        setProblem(W.problem);
      }
    });
  }

  function finish() {
    startTransition(async () => {
      await finishWelcome(next, invite !== null);
    });
  }

  const index = asked.indexOf(step);
  let content: ReactNode;
  switch (step) {
    case "start":
      content = (
        <StepFrame index={null} of={asked.length} heading={W.start.heading} body={W.start.body}>
          <Rise as="p" index={3} className="mt-5 max-w-[34em] text-[0.9688rem] text-ink-3">
            {W.start.promise}
          </Rise>
          <Actions>
            <Button
              type="button"
              disabled={pending}
              onClick={() => saveThen(() => beginWelcome(zone), after("start"))}
            >
              {W.start.begin}
            </Button>
            <Button type="button" variant="quiet" size="inline" disabled={pending} onClick={finish}>
              {W.start.later}
            </Button>
          </Actions>
        </StepFrame>
      );
      break;
    case "name":
      content = (
        <StepFrame index={index + 1} of={asked.length} heading={W.name.heading} body={W.name.body}>
          <form
            className="mt-10 flex flex-1 flex-col"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              saveThen(() => saveName(name), after("name"));
            }}
          >
            <Rise index={3}>
              <label htmlFor="welcome-name" className="block text-label font-medium text-ink">
                {W.name.label}
              </label>
              <Input
                id="welcome-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="given-name"
                maxLength={80}
                placeholder={W.name.placeholder}
                className="mt-2 h-14 max-w-md font-serif text-[1.25rem]"
              />
              {problem ? <FieldError>{problem}</FieldError> : null}
            </Rise>
            <Actions>
              <Button type="submit" disabled={pending}>
                {W.next}
              </Button>
              <Button type="button" variant="quiet" size="inline" onClick={() => go(after("name"))}>
                {W.skip}
              </Button>
            </Actions>
          </form>
        </StepFrame>
      );
      break;
    case "invite":
      content = invite ? (
        <StepFrame
          index={index + 1}
          of={asked.length}
          heading={W.invite.heading(invite.who)}
          body={W.invite.body}
        >
          <Rise index={3} className="mt-8">
            <div className="rounded-file border border-rule bg-paper px-5 py-4 shadow-card">
              <p className="font-serif text-title-small text-ink [overflow-wrap:anywhere]">
                {invite.professionalName}
              </p>
              {invite.details ? <p className="mt-1 text-caption text-ink-3">{invite.details}</p> : null}
            </div>
            <InvitePromises className="mt-6" />
          </Rise>
          {linked ? (
            <>
              <p role="status" className="mt-8 text-ink">
                {W.invite.linked(linked)}
              </p>
              <Actions>
                <Button type="button" onClick={() => go(after("invite"))}>
                  {W.next}
                </Button>
              </Actions>
            </>
          ) : (
            <Rise index={4} className="mt-8">
              <AcceptAsPersonForm
                who={invite.who}
                shown={invite.shown}
                defaultName={name}
                reportName={invite.reportName}
                accept={async (_state, form) => {
                  const result = await acceptInWelcome(invite.code, form);
                  if (result.ok) setLinked(invite.who);
                  return { problem: result.problem };
                }}
              />
              <Button
                type="button"
                variant="quiet"
                size="inline"
                className="mt-6"
                onClick={() => go(after("invite"))}
              >
                {W.invite.later}
              </Button>
            </Rise>
          )}
        </StepFrame>
      ) : null;
      break;
    case "therapist":
      content = (
        <StepFrame index={index + 1} of={asked.length} heading={W.therapist.heading} body={W.therapist.body}>
          <form
            className="mt-10 flex flex-1 flex-col"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              saveThen(() => saveTherapist(therapist), after("therapist"));
            }}
          >
            <Rise index={3}>
              <label htmlFor="welcome-therapist" className="block text-label font-medium text-ink">
                {W.therapist.label}
              </label>
              <Input
                id="welcome-therapist"
                value={therapist}
                onChange={(event) => setTherapist(event.target.value)}
                autoComplete="off"
                maxLength={200}
                placeholder={W.therapist.placeholder}
                className="mt-2 h-14 max-w-md font-serif text-[1.25rem]"
              />
              {problem ? <FieldError>{problem}</FieldError> : null}
            </Rise>
            <Actions>
              <Button type="submit" disabled={pending}>
                {W.next}
              </Button>
              <Button
                type="button"
                variant="quiet"
                size="inline"
                onClick={() => {
                  setTherapist("");
                  go(after("therapist"));
                }}
              >
                {W.therapist.none}
              </Button>
            </Actions>
          </form>
        </StepFrame>
      );
      break;
    case "session":
      content = (
        <StepFrame
          index={index + 1}
          of={asked.length}
          heading={W.session.heading(therapist.trim() || null)}
          body={W.session.body}
        >
          <form
            className="mt-10 flex flex-1 flex-col"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              saveThen(() => saveSession({ day, time, timezone: zone }), after("session"));
            }}
          >
            <Rise index={3} className="space-y-8">
              <fieldset className="min-w-0 border-0 p-0">
                <legend className="p-0 text-label font-medium text-ink">{W.session.day}</legend>
                <div className="mt-3 grid max-w-md grid-cols-7 gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 0].map((value) => (
                    <label key={value} className="relative">
                      <input
                        type="radio"
                        name="day"
                        value={String(value)}
                        checked={day === String(value)}
                        onChange={() => setDay(String(value))}
                        aria-label={W.session.days[value]}
                        className="peer absolute inset-0 cursor-pointer opacity-0"
                      />
                      <span className="pointer-events-none flex min-h-11 items-center justify-center rounded-pill border border-rule bg-paper text-[0.875rem] font-medium text-ink-2 transition-colors duration-300 peer-hover:border-rule-strong peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                        {W.session.short[value]}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="welcome-time" className="block text-label font-medium text-ink">
                  {W.session.time}
                </label>
                <Input
                  id="welcome-time"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  className="mt-2 h-14 max-w-48 text-[1.125rem] tabular-nums"
                />
                <p className="mt-3 flex flex-wrap items-baseline gap-x-3 text-[0.9375rem] text-ink-3">
                  {W.session.zone(place(zone))}
                  <button
                    type="button"
                    onClick={() => setZoneOpen((open) => !open)}
                    className="text-ink underline decoration-rule-strong underline-offset-[0.28em] hover:decoration-ink"
                  >
                    {W.session.changeZone}
                  </button>
                </p>
                {zoneOpen ? (
                  <div className="mt-3">
                    <label htmlFor="welcome-zone" className="sr-only">
                      {W.session.zoneLabel}
                    </label>
                    <select
                      id="welcome-zone"
                      value={zone}
                      onChange={(event) => setChosenZone(event.target.value)}
                      className="block h-12 w-full max-w-md rounded-command border border-rule-strong bg-paper px-4 font-sans text-body text-ink hover:border-ink-soft focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      {timezones.map((option) => (
                        <option key={option} value={option}>
                          {option.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
              {problem ? <FieldError>{problem}</FieldError> : null}
            </Rise>
            <Actions>
              <Button type="submit" disabled={pending}>
                {W.next}
              </Button>
              <Button
                type="button"
                variant="quiet"
                size="inline"
                onClick={() => {
                  setDay("");
                  setTime("");
                  saveThen(() => saveSession({ day: "", time: "", timezone: zone }), after("session"));
                }}
              >
                {W.session.varies}
              </Button>
            </Actions>
          </form>
        </StepFrame>
      );
      break;
    case "ready": {
      const who = therapist.trim();
      content = (
        <StepFrame index={null} of={asked.length} heading={W.ready.heading(name.trim() || null)}>
          <Rise index={2} className="mt-5 max-w-[32em] space-y-3 text-lede text-ink-2">
            <p>
              {day !== "" && time
                ? W.ready.sessions(W.session.days[Number(day)] ?? "", time)
                : W.ready.noSessions}
            </p>
            {who ? <p>{W.ready.therapist(who)}</p> : null}
            <p className="text-ink">{W.ready.next}</p>
          </Rise>
          <Actions>
            <Button type="button" disabled={pending} onClick={finish}>
              {W.ready.go}
            </Button>
          </Actions>
        </StepFrame>
      );
      break;
    }
  }

  return (
    <div data-time={timeOfDay(hour)} className="relative">
      <RoomLight scene={SCENES[step]} />
      <div className="relative z-10 flex min-h-svh flex-col">
        <header className="wrap flex min-h-[72px] items-center justify-between gap-6 md:min-h-[88px]">
          <Link href="/home" aria-label={t.shell.homeLink} className="no-underline">
            <Wordmark />
          </Link>
          {step !== "start" && step !== "ready" ? (
            <button
              type="button"
              onClick={() => go(before(step))}
              className="inline-flex min-h-10 items-center rounded-pill border border-rule bg-paper px-4 text-label font-medium text-ink-2 transition-colors duration-300 hover:border-rule-strong hover:text-ink"
            >
              {W.back}
            </button>
          ) : null}
        </header>
        <main id="main" className="wrap flex flex-1 flex-col pb-[max(24px,env(safe-area-inset-bottom))]">
          <div key={step} ref={frame} className="flex flex-1 flex-col">
            {content}
          </div>
        </main>
        <footer className="wrap pb-[max(20px,env(safe-area-inset-bottom))] pt-6">
          <SupportStrip />
        </footer>
      </div>
    </div>
  );
}
