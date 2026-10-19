"use client";

import { buttonVariants, cn } from "@sintr/ui";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useLanguage, useMessages } from "@/components/language";
import {
  addDays,
  addMonths,
  calendarHref,
  monthOf,
  monthWeeks,
  weekdayOf,
  type CalendarState,
} from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import {
  CalendarLink,
  useCalendarState,
  useNavigate,
  type CalendarView,
  type SessionView,
} from "./calendar-nav";
import { SessionSheet } from "./session-sheet";

const chip =
  "relative z-10 block w-full truncate rounded-pill px-2 py-[3px] text-left text-[0.8125rem] font-medium leading-tight tabular-nums no-underline transition-colors duration-300";

function chipStyle(session: SessionView): string {
  if (session.cancelled) return "text-ink-3 line-through decoration-ink-soft hover:text-ink-2";
  if (session.next) return "bg-ink text-paper hover:bg-ink-pressed";
  if (session.passed) return "border border-rule text-ink-3 hover:border-rule-strong hover:text-ink-2";
  return "border border-rule-strong bg-paper text-ink hover:border-ink";
}

/** What a session is part of, or what happened to it, in a few words. */
function useCaption() {
  const T = useMessages().therapy.calendar.caption;
  return (session: SessionView): string => {
    if (session.cancelled) return T.cancelled;
    if (session.moved && session.from) return T.moved(session.from);
    if (session.repeat === "weekdays") return T.weekdays(session.weekdays);
    return T[session.repeat];
  };
}

/**
 * A session in a list: its day (or, under a day already named, its time)
 * and under it its rhythm or what happened to it.
 */
function SessionRow({
  session,
  state,
  underDay = false,
}: {
  session: SessionView;
  state: CalendarState;
  underDay?: boolean;
}) {
  const T = useMessages().therapy.calendar;
  const caption = useCaption();
  const { code } = useLanguage();
  return (
    <li className="border-b border-rule">
      <CalendarLink
        to={calendarHref({ month: state.month, day: state.day, session: session.key })}
        how="open"
        aria-label={`${session.when}. ${caption(session)}${session.next ? `. ${T.caption.next}` : ""}`}
        className="group flex items-baseline justify-between gap-4 py-3.5 no-underline"
      >
        <span className="min-w-0">
          <span
            className={cn(
              "flex items-center gap-2 font-serif text-[1.0625rem] leading-snug",
              session.cancelled ? "text-ink-3 line-through decoration-ink-soft" : "text-ink",
            )}
          >
            {session.next ? (
              <span aria-hidden="true" className="size-[7px] shrink-0 rounded-full bg-ink" />
            ) : null}
            {underDay ? session.time : formatDate(session.on, code)}
          </span>
          <span className={cn("mt-0.5 block text-caption", session.next ? "text-ink" : "text-ink-3")}>
            {session.next ? `${T.caption.next}. ` : ""}
            {caption(session)}
          </span>
        </span>
        {underDay ? null : (
          <span
            className={cn(
              "shrink-0 text-[0.9375rem] font-medium tabular-nums transition-colors duration-300 group-hover:text-ink",
              session.cancelled ? "text-ink-3 line-through decoration-ink-soft" : "text-ink-2",
            )}
          >
            {session.time}
          </span>
        )}
      </CalendarLink>
    </li>
  );
}

function MonthGrid({ view, state }: { view: CalendarView; state: CalendarState }) {
  const T = useMessages().therapy.calendar;
  const short = useMessages().therapy.calendar.form.short;
  const { code } = useLanguage();
  const navigate = useNavigate();
  const weeks = useMemo(() => monthWeeks(state.month, view.weekStart), [state.month, view.weekStart]);
  const byDay = useMemo(() => {
    const map = new Map<string, SessionView[]>();
    for (const session of view.sessions) map.set(session.on, [...(map.get(session.on) ?? []), session]);
    return map;
  }, [view.sessions]);
  const held = (month: string) => month >= view.months.first && month <= view.months.last;
  const title = view.months.titles[state.month] ?? state.month;
  const thisMonth = monthOf(view.today);
  const focusable =
    state.day && monthOf(state.day) === state.month
      ? state.day
      : thisMonth === state.month
        ? view.today
        : `${state.month}-01`;
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const table = useRef<HTMLTableElement>(null);
  useEffect(() => {
    if (!focusDay) return;
    table.current?.querySelector<HTMLAnchorElement>(`a[data-day="${focusDay}"]`)?.focus();
  }, [focusDay, state.month]);

  // The date grid's keys: arrows move a day or a week, Home and End to the week's ends, Page Up and Down a month.
  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const from = (event.target as HTMLElement).dataset.day;
    if (!from) return;
    const column = (weekdayOf(from) - view.weekStart + 7) % 7;
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(from, -1),
      ArrowRight: () => addDays(from, 1),
      ArrowUp: () => addDays(from, -7),
      ArrowDown: () => addDays(from, 7),
      Home: () => addDays(from, -column),
      End: () => addDays(from, 6 - column),
      PageUp: () => `${addMonths(monthOf(from), -1)}-01`,
      PageDown: () => `${addMonths(monthOf(from), 1)}-01`,
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const to = move();
    if (monthOf(to) !== state.month) {
      const month = monthOf(to);
      navigate(calendarHref({ month, day: state.day }), held(month) ? "replace" : "server");
    }
    setFocusDay(to);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h3
          className="font-serif text-title-small font-normal text-ink first-letter:uppercase"
          aria-live="polite"
        >
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {state.month !== thisMonth ? (
            <CalendarLink
              to={calendarHref({ month: thisMonth })}
              how={held(thisMonth) ? "replace" : "server"}
              className={cn(buttonVariants({ variant: "quiet", size: "sm" }), "px-3")}
            >
              {T.month.today}
            </CalendarLink>
          ) : null}
          {(
            [
              [-1, T.month.previous, "rotate-[135deg] translate-x-[1.5px]"],
              [1, T.month.next, "rotate-[-45deg] -translate-x-[1.5px]"],
            ] as const
          ).map(([step, label, turn]) => {
            const month = addMonths(state.month, step);
            return (
              <CalendarLink
                key={step}
                to={calendarHref({
                  month,
                  day: state.day && monthOf(state.day) === month ? state.day : null,
                })}
                how={held(month) ? "replace" : "server"}
                aria-label={label}
                className="inline-flex size-10 items-center justify-center rounded-full border border-rule bg-paper text-ink-2 transition-colors duration-300 hover:border-rule-strong hover:text-ink"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-block size-[7px] border-b-[1.5px] border-r-[1.5px] border-current",
                    turn,
                  )}
                />
              </CalendarLink>
            );
          })}
        </div>
      </div>
      <table ref={table} onKeyDown={onKeyDown} className="mt-5 w-full table-fixed border-collapse">
        <caption className="sr-only">{T.month.grid(title)}</caption>
        <thead>
          <tr>
            {weeks[0]!.map((day) => (
              <th
                key={day}
                scope="col"
                abbr={T.form.days[weekdayOf(day)]}
                className="pb-2 text-center text-caption font-normal text-ink-3 sm:text-left sm:pl-2"
              >
                {short[weekdayOf(day)]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]} className="border-t border-rule">
              {week.map((day) => {
                const sessions = byDay.get(day) ?? [];
                const outside = monthOf(day) !== state.month;
                const selected = state.day === day;
                const today = day === view.today;
                const label = [
                  formatDate(day, code),
                  sessions.length > 0 ? T.day.sessions(sessions.length) : null,
                ]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <td key={day} className="relative h-14 p-0 align-top sm:h-[5.75rem]">
                    <CalendarLink
                      to={calendarHref({ month: state.month, day })}
                      how="replace"
                      data-day={day}
                      tabIndex={
                        day === (focusDay && monthOf(focusDay) === state.month ? focusDay : focusable)
                          ? 0
                          : -1
                      }
                      aria-label={label}
                      aria-current={today ? "date" : undefined}
                      onNavigate={() => setFocusDay(day)}
                      className={cn(
                        "absolute inset-[3px] rounded-command no-underline transition-colors duration-300 hover:bg-wash",
                        selected && "bg-wash",
                      )}
                    />
                    <div className="pointer-events-none relative flex h-full flex-col items-center gap-1 px-[3px] pt-1.5 sm:items-stretch sm:px-1.5">
                      <span
                        className={cn(
                          "inline-flex size-[26px] items-center justify-center self-center rounded-full text-[0.8125rem] tabular-nums sm:self-start",
                          today ? "bg-ink font-medium text-paper" : outside ? "text-ink-soft" : "text-ink-2",
                          selected && !today && "font-medium text-ink",
                        )}
                      >
                        {Number(day.slice(8))}
                      </span>
                      {/* On a phone the day is the target; its sessions are its times. */}
                      <span aria-hidden="true" className="flex flex-col items-center gap-0.5 sm:hidden">
                        {sessions.slice(0, 2).map((session) => (
                          <span
                            key={session.key}
                            className={cn(
                              "rounded-pill px-1 text-[0.6875rem] font-medium leading-[1.35] tabular-nums",
                              session.cancelled
                                ? "text-ink-3 line-through"
                                : session.next
                                  ? "bg-ink text-paper"
                                  : session.passed || outside
                                    ? "text-ink-3"
                                    : "text-ink",
                            )}
                          >
                            {session.time}
                          </span>
                        ))}
                        {sessions.length > 2 ? (
                          <span className="text-[0.6875rem] leading-none text-ink-3">
                            +{sessions.length - 2}
                          </span>
                        ) : null}
                      </span>
                      {/* On a wide screen each session is its own target. */}
                      <ul className="hidden space-y-1 sm:block">
                        {sessions.map((session) => (
                          <li key={session.key} className="pointer-events-auto">
                            <CalendarLink
                              to={calendarHref({ month: state.month, day, session: session.key })}
                              how="open"
                              tabIndex={-1}
                              aria-label={session.when}
                              className={cn(
                                chip,
                                chipStyle(session),
                                outside && !session.next && "opacity-70",
                              )}
                            >
                              {session.time}
                            </CalendarLink>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The day chosen on the grid: its sessions, and a way to add one on it. */
function DayDetail({ view, state, day }: { view: CalendarView; state: CalendarState; day: string }) {
  const T = useMessages().therapy.calendar;
  const { code } = useLanguage();
  const sessions = view.sessions.filter((session) => session.on === day);
  const name = formatDate(day, code);
  const panel = useRef<HTMLDivElement>(null);
  // A day chosen on a phone: its panel, under the grid, comes into view.
  useEffect(() => {
    const element = panel.current;
    if (!element || element.getBoundingClientRect().bottom <= window.innerHeight) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
  }, [day]);
  return (
    <div ref={panel} className="mt-6 scroll-mb-6 border-t border-rule pt-5" aria-live="polite">
      <p className="font-serif text-[1.0625rem] text-ink first-letter:uppercase">{name}</p>
      {sessions.length > 0 ? (
        <ul className="mt-2 border-t border-rule">
          {sessions.map((session) => (
            <SessionRow key={session.key} session={session} state={state} underDay />
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[0.9375rem] text-ink-3">{T.day.empty}</p>
      )}
      <CalendarLink
        to={calendarHref({ month: state.month, day, add: day })}
        how="open"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
      >
        {T.addOn(name)}
      </CalendarLink>
    </div>
  );
}

/**
 * Therapy's calendar (F11): the sessions as they fall, the next one first,
 * a month at a time, each one opened on its own to change or cancel it, or
 * its rhythm from it on. Its state lives in the address, so it works
 * without JavaScript as links and forms, and with it without a reload.
 */
export function TherapyCalendar({ view, footer }: { view: CalendarView; footer?: ReactNode }) {
  const T = useMessages().therapy.calendar;
  const state = useCalendarState(view.today);
  const params = useSearchParams();
  const done = params.get("done");
  const said = done && Object.hasOwn(T.done, done) ? T.done[done as keyof typeof T.done] : null;
  const coming = view.comingUp
    .map((key) => view.sessions.find((session) => session.key === key))
    .filter((session): session is SessionView => session !== undefined);
  return (
    <section id="sessions" aria-labelledby="sessions-title" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-[min(100%,22rem)] max-w-[34em] flex-1">
          <h2 id="sessions-title" className="text-label font-medium text-ink-3">
            {T.title}
          </h2>
          <p className="mt-1.5 font-serif text-title-small leading-snug text-ink">{view.summary}</p>
        </div>
        <CalendarLink
          to={calendarHref({ month: state.month, day: state.day, add: state.day ?? view.today })}
          how="open"
          className={buttonVariants({ size: "sm" })}
        >
          {T.add}
        </CalendarLink>
      </div>
      {said ? (
        <p role="status" className="mt-5 text-[0.9375rem] text-ink-2">
          {said}
        </p>
      ) : null}

      <div className="mt-8 grid gap-x-12 gap-y-10 min-[1180px]:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-[1180px]:order-2">
          <h3 className="text-label font-medium text-ink-3">{T.comingUp}</h3>
          {coming.length > 0 ? (
            <ul className="mt-2 border-t border-rule">
              {coming.map((session) => (
                <SessionRow key={session.key} session={session} state={state} />
              ))}
            </ul>
          ) : (
            <p className="mt-2 max-w-[28em] text-[0.9375rem] text-ink-3">{T.noneComing}</p>
          )}
        </div>
        <div className="min-w-0 min-[1180px]:order-1">
          <MonthGrid view={view} state={state} />
          {state.day ? <DayDetail view={view} state={state} day={state.day} /> : null}
        </div>
      </div>
      {/* A single child: an element made on the server is not one of a list here. */}
      {footer ? <div>{footer}</div> : null}
      {state.add || state.session ? <SessionSheet view={view} state={state} /> : null}
    </section>
  );
}
