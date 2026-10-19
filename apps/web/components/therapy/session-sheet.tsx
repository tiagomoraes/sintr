"use client";

import type { SessionRepeat } from "@sintr/core";
import { Button, FieldError, Input, buttonVariants, cn } from "@sintr/ui";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { addSession, cancelSession, changeSession, restoreSession } from "@/app/(app)/therapy/sessions";
import { useMessages } from "@/components/language";
import {
  calendarHref,
  parseProblem,
  weekdayOf,
  type CalendarState,
  type SessionProblem,
} from "@/lib/calendar";
import { submitWith } from "@/lib/use-form-action";
import {
  CalendarLink,
  sheetClosed,
  useCloseSheet,
  type CalendarView,
  type SessionView,
} from "./calendar-nav";

const dayChip =
  "pointer-events-none flex min-h-11 items-center justify-center rounded-pill border border-rule bg-paper text-[0.875rem] font-medium text-ink-2 transition-colors duration-300 peer-hover:border-rule-strong peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink";

const radio =
  "mt-[3px] size-4 shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-ink-soft bg-paper checked:border-[5px] checked:border-ink disabled:cursor-not-allowed disabled:opacity-50";

/** A choice among a few, each a sentence with a quiet line under it when it needs one. */
function Choice({
  name,
  value,
  checked,
  onChange,
  disabled,
  label,
  hint,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <label
      className={cn("flex items-start gap-3 py-1.5 text-[0.9688rem] text-ink", disabled && "text-ink-3")}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={radio}
      />
      <span>
        {label}
        {hint ? <span className="mt-0.5 block text-caption text-ink-3">{hint}</span> : null}
      </span>
    </label>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 max-[719px]:flex-col max-[719px]:items-stretch">
      {children}
    </div>
  );
}

/**
 * A form of the sheet. Without JavaScript it is a plain post to the
 * calendar's route, which comes back to this page; with it, `action` (a
 * server action through useActionState) keeps the same thing.
 */
function SheetForm({
  intent,
  action,
  state,
  session,
  className,
  children,
}: {
  intent: "add" | "change" | "cancel" | "restore";
  action: (form: FormData) => void;
  state: CalendarState;
  session?: SessionView;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form method="post" action="/api/therapy/sessions" onSubmit={submitWith(action)} className={className}>
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="month" value={state.month} />
      <input type="hidden" name="return" value={calendarHref(state)} />
      {session ? <input type="hidden" name="session" value={session.key} /> : null}
      {children}
    </form>
  );
}

/** A problem's sentence. */
function useProblem() {
  const T = useMessages().therapy.calendar;
  return (code: SessionProblem | null): string | null =>
    code === null ? null : code === "which" ? T.form.onlyThisRhythm : T.problems[code];
}

/** Adding a session, or changing one: a day, a time and how it repeats; for a rhythm, which sessions. */
function SessionForm({
  view,
  state,
  session,
  day: firstDay,
  problem,
}: {
  view: CalendarView;
  state: CalendarState;
  session?: SessionView;
  day: string;
  problem: SessionProblem | null;
}) {
  const T = useMessages().therapy.calendar;
  const F = T.form;
  const say = useProblem();
  const [result, action, pending] = useActionState(session ? changeSession : addSession, { problem });
  const [day, setDay] = useState(firstDay);
  const [repeat, setRepeat] = useState<SessionRepeat>(session?.repeat ?? "weekly");
  // The chosen weekdays: the rhythm's own, or, until the person picks some, the chosen day's.
  const [picked, setWeekdays] = useState<number[] | null>(session?.weekdays.length ? session.weekdays : null);
  const weekdays = picked ?? (/^\d{4}-\d{2}-\d{2}$/.test(day) ? [weekdayOf(day)] : [weekdayOf(firstDay)]);
  const [which, setWhich] = useState<"only" | "following">("only");
  const p = result.problem;
  const inRhythm = session !== undefined && session.repeat !== "once";
  // Moving only this one keeps the rhythm's own day; a rhythm changed from here takes the chosen day's.
  const named = inRhythm && which === "only" ? session.occursOn : day;
  const weekday = /^\d{4}-\d{2}-\d{2}$/.test(named) ? weekdayOf(named) : weekdayOf(firstDay);
  const newRhythm =
    inRhythm &&
    (repeat !== session.repeat || (repeat === "weekdays" && weekdays.join() !== session.weekdays.join()));
  const order = [0, 1, 2, 3, 4, 5, 6].map((i) => (i + view.weekStart) % 7);
  const repeats: { value: SessionRepeat; label: string }[] = [
    { value: "once", label: F.repeats.once },
    { value: "weekly", label: F.repeats.weekly(weekday) },
    { value: "fortnightly", label: F.repeats.fortnightly(weekday) },
    { value: "every_15_days", label: F.repeats.every_15_days },
    { value: "weekdays", label: F.repeats.weekdays },
  ];

  return (
    <SheetForm
      intent={session ? "change" : "add"}
      action={action}
      state={state}
      session={session}
      className="sintr-session-form"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-4">
        <div>
          <label htmlFor="session-day" className="block text-label font-medium text-ink">
            {F.day}
          </label>
          <Input
            id="session-day"
            name="day"
            type="date"
            required
            value={day}
            onChange={(event) => setDay(event.target.value)}
            aria-invalid={p === "day" ? true : undefined}
            className="mt-2 tabular-nums"
          />
        </div>
        <div>
          <label htmlFor="session-time" className="block text-label font-medium text-ink">
            {F.time}
          </label>
          <Input
            id="session-time"
            name="time"
            type="time"
            required
            defaultValue={session?.time ?? view.usualTime}
            aria-invalid={p === "time" ? true : undefined}
            className="mt-2 tabular-nums"
          />
        </div>
      </div>
      {p === "day" || p === "time" ? <FieldError>{say(p)}</FieldError> : null}

      <fieldset className="mt-7 min-w-0 border-0 p-0">
        <legend className="p-0 text-label font-medium text-ink">{F.repeat}</legend>
        <div className="mt-2">
          {repeats.map((option) => (
            <Choice
              key={option.value}
              name="repeat"
              value={option.value}
              checked={repeat === option.value}
              onChange={() => setRepeat(option.value)}
              label={option.label}
            />
          ))}
        </div>
        {p === "repeat" ? <FieldError>{say(p)}</FieldError> : null}
      </fieldset>

      {/* Shown with the choice that needs them; without JavaScript, the stylesheet shows them by the checked radio. */}
      <fieldset
        className={cn("sintr-session-weekdays mt-5 min-w-0 border-0 p-0", repeat !== "weekdays" && "hidden")}
      >
        <legend className="p-0 text-label font-medium text-ink">{F.weekdays}</legend>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {order.map((value) => (
            <label key={value} className="relative">
              <input
                type="checkbox"
                name="weekdays"
                value={String(value)}
                checked={weekdays.includes(value)}
                onChange={(event) =>
                  setWeekdays(
                    event.target.checked
                      ? [...weekdays, value].sort((a, b) => a - b)
                      : weekdays.filter((d) => d !== value),
                  )
                }
                aria-label={F.days[value]}
                className="peer absolute inset-0 cursor-pointer opacity-0"
              />
              <span className={dayChip}>{F.short[value]}</span>
            </label>
          ))}
        </div>
        {p === "weekdays" ? <FieldError>{say(p)}</FieldError> : null}
      </fieldset>

      {inRhythm ? (
        <fieldset className="mt-7 min-w-0 border-0 border-t border-rule p-0 pt-5">
          <legend className="float-left w-full p-0 text-label font-medium text-ink">{F.which}</legend>
          <div className="clear-left pt-2">
            <Choice
              name="which"
              value="only"
              checked={!newRhythm && which === "only"}
              onChange={() => setWhich("only")}
              disabled={newRhythm}
              label={F.onlyThis}
              hint={newRhythm ? F.onlyThisRhythm : F.onlyThisHint}
            />
            <Choice
              name="which"
              value="following"
              checked={newRhythm || which === "following"}
              onChange={() => setWhich("following")}
              label={F.fromThis}
              hint={F.fromThisHint}
            />
          </div>
          {p === "which" ? <FieldError>{say(p)}</FieldError> : null}
        </fieldset>
      ) : null}

      {p === "gone" || p === "passed" || p === "form" ? <FieldError>{say(p)}</FieldError> : null}
      <Actions>
        <Button type="submit" disabled={pending}>
          {session ? F.save : F.add}
        </Button>
        <CalendarLink
          to={
            session
              ? calendarHref({ month: state.month, day: state.day, session: session.key })
              : calendarHref({ month: state.month, day: state.day })
          }
          how="replace"
          className={cn(buttonVariants({ variant: "quiet", size: "sm" }), "justify-center")}
        >
          {F.back}
        </CalendarLink>
      </Actions>
    </SheetForm>
  );
}

/** Cancelling: only this session, or the rhythm from it on. A session that does not repeat leaves the calendar. */
function CancelForm({
  state,
  session,
  problem,
}: {
  state: CalendarState;
  session: SessionView;
  problem: SessionProblem | null;
}) {
  const C = useMessages().therapy.calendar.cancel;
  const say = useProblem();
  const [result, action, pending] = useActionState(cancelSession, { problem });
  const [which, setWhich] = useState<"only" | "following">("only");
  return (
    <SheetForm intent="cancel" action={action} state={state} session={session}>
      {session.repeat === "once" ? (
        <p className="text-[0.9688rem] text-ink-2">{C.once}</p>
      ) : (
        <fieldset className="min-w-0 border-0 p-0">
          <legend className="sr-only">{C.title}</legend>
          <Choice
            name="which"
            value="only"
            checked={which === "only"}
            onChange={() => setWhich("only")}
            label={C.onlyThis}
            hint={C.onlyThisHint}
          />
          <Choice
            name="which"
            value="following"
            checked={which === "following"}
            onChange={() => setWhich("following")}
            label={C.fromThis}
            hint={C.fromThisHint}
          />
        </fieldset>
      )}
      {result.problem ? <FieldError>{say(result.problem)}</FieldError> : null}
      <Actions>
        <Button type="submit" disabled={pending}>
          {C.confirm}
        </Button>
        <CalendarLink
          to={calendarHref({ month: state.month, day: state.day, session: session.key })}
          how="replace"
          className={cn(buttonVariants({ variant: "quiet", size: "sm" }), "justify-center")}
        >
          {C.keep}
        </CalendarLink>
      </Actions>
    </SheetForm>
  );
}

/** One session: when it is, what it is part of, and what can be done with it. */
function SessionDetails({
  state,
  session,
  problem,
}: {
  state: CalendarState;
  session: SessionView;
  problem: SessionProblem | null;
}) {
  const T = useMessages().therapy.calendar;
  const S = T.session;
  const say = useProblem();
  const [result, restore, restoring] = useActionState(restoreSession, { problem });
  const caption =
    session.repeat === "weekdays" ? T.caption.weekdays(session.weekdays) : T.caption[session.repeat];
  const open = !session.passed;
  return (
    <div>
      <div className="space-y-2 text-[0.9688rem] text-ink-2">
        {session.moved && session.from ? <p>{S.movedFrom(session.from)}</p> : null}
        {session.cancelled ? <p>{S.cancelled}</p> : null}
        {session.passed ? <p>{S.passed}</p> : null}
        {session.report && !session.cancelled ? <p>{S.report(session.report)}</p> : null}
      </div>
      {result.problem ? <FieldError>{say(result.problem)}</FieldError> : null}
      <Actions>
        {open && !session.cancelled ? (
          <>
            <CalendarLink
              to={calendarHref({ month: state.month, day: state.day, session: session.key, doing: "change" })}
              how="replace"
              className={buttonVariants({ size: "sm" })}
            >
              {S.change}
            </CalendarLink>
            <CalendarLink
              to={calendarHref({ month: state.month, day: state.day, session: session.key, doing: "cancel" })}
              how="replace"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {S.cancel}
            </CalendarLink>
          </>
        ) : null}
        {open && (session.moved || session.cancelled) ? (
          <SheetForm intent="restore" action={restore} state={state} session={session} className="contents">
            <Button type="submit" variant="outline" size="sm" disabled={restoring}>
              {S.putBack(session.from ?? session.when)}
            </Button>
          </SheetForm>
        ) : null}
      </Actions>
      <p className="sr-only">{caption}</p>
    </div>
  );
}

/**
 * The sheet a session (or a new one) opens in: a panel in the middle of a
 * wide screen and a sheet from the bottom of a phone, a native dialog, so
 * focus stays in it and Escape closes it. Without JavaScript it is on the
 * page as it is, and its links and forms work as they are.
 */
export function SessionSheet({ view, state }: { view: CalendarView; state: CalendarState }) {
  const T = useMessages().therapy.calendar;
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useCloseSheet(state);
  const session = state.session
    ? view.sessions.find((candidate) => candidate.key === state.session)
    : undefined;
  const opened = state.add ?? state.session;
  // What a form posted without JavaScript could not keep comes back in the address.
  const problem = parseProblem(useSearchParams().get("problem"));

  // Opened: the modal sheet, its title in focus. Gone: focus back where it was, and the next sheet opens afresh.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Rendered open on the server (for a page without JavaScript), it becomes the modal sheet here.
    if (!element.matches(":modal")) {
      if (element.open) element.close();
      element.showModal();
    }
    return () => {
      sheetClosed();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [opened]);
  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>("#session-sheet-title")?.focus({ preventScroll: true });
  }, [opened, state.doing]);

  let title: string;
  let subtitle: string | null = null;
  let body: ReactNode;
  if (state.add) {
    title = T.form.addTitle;
    body = (
      <SessionForm key={`add-${state.add}`} view={view} state={state} day={state.add} problem={problem} />
    );
  } else if (!session) {
    title = T.title;
    body = <p className="text-[0.9688rem] text-ink-2">{T.problems.gone}</p>;
  } else {
    title = session.when;
    subtitle = session.cancelled
      ? T.caption.cancelled
      : session.repeat === "weekdays"
        ? T.caption.weekdays(session.weekdays)
        : T.caption[session.repeat];
    if (state.doing === "change" && !session.passed && !session.cancelled) {
      title = T.form.changeTitle;
      subtitle = session.when;
      body = (
        <SessionForm
          key={`change-${session.key}`}
          view={view}
          state={state}
          session={session}
          day={session.on}
          problem={problem}
        />
      );
    } else if (state.doing === "cancel" && !session.passed && !session.cancelled) {
      title = T.cancel.title;
      subtitle = session.when;
      body = <CancelForm key={`cancel-${session.key}`} state={state} session={session} problem={problem} />;
    } else {
      body = <SessionDetails state={state} session={session} problem={problem} />;
    }
  }

  return (
    <dialog
      ref={dialog}
      open
      aria-labelledby="session-sheet-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        // A tap outside the sheet, on the veil, closes it.
        if (event.target === dialog.current) close();
      }}
      className="sintr-session"
    >
      <div aria-hidden="true" className="sintr-session__grip" />
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h2
            id="session-sheet-title"
            tabIndex={-1}
            className="font-serif text-title-small font-normal leading-snug text-ink first-letter:uppercase focus:outline-none"
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-caption text-ink-3 first-letter:uppercase">{subtitle}</p>
          ) : null}
        </div>
        <CalendarLink
          to={calendarHref({ month: state.month, day: state.day })}
          how="replace"
          onClick={(event) => {
            event.preventDefault();
            close();
          }}
          className="-mr-2 -mt-1 inline-flex min-h-10 shrink-0 items-center rounded-pill px-3 text-label font-medium text-ink-2 no-underline hover:text-ink"
        >
          {T.session.close}
        </CalendarLink>
      </div>
      <div className="mt-6">{body}</div>
    </dialog>
  );
}
