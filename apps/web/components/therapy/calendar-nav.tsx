"use client";

import type { SessionRepeat } from "@sintr/core";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, type ComponentProps } from "react";
import { calendarHref, calendarState, type CalendarState } from "@/lib/calendar";

/** One session as the page shows it, already placed on its local day and said in the page's language. */
export interface SessionView {
  key: string;
  seriesId: string;
  /** Its own day in its series, which names it. */
  occursOn: string;
  /** The day it falls on. */
  on: string;
  time: string;
  moved: boolean;
  cancelled: boolean;
  passed: boolean;
  /** The real next session: the first still to come that is held. */
  next: boolean;
  repeat: SessionRepeat;
  weekdays: number[];
  /** "Tuesday 21 October at 18:00". */
  when: string;
  /** Where a moved session was, said the same way. */
  from: string | null;
  /** When its report is prepared, for a session still to come. */
  report: string | null;
}

export interface CalendarView {
  today: string;
  /** The first column of the grid, as the page's language has it (0 = Sunday). */
  weekStart: number;
  /** The months the page holds sessions for, and their titles. */
  months: { first: string; last: string; titles: Record<string, string> };
  sessions: SessionView[];
  /** The next few sessions to come (keys), cancelled ones included, so a gap shows. */
  comingUp: string[];
  /** The calendar's rhythms, as sentences. */
  summary: string;
  /** The time a new session is offered at: the person's usual one. */
  usualTime: string;
}

/**
 * How a link moves the calendar: `open` opens the sheet (a new step in the
 * history, so the back gesture closes it), `replace` changes what is shown
 * in place, `server` asks the server for months the page does not hold.
 */
export type How = "open" | "replace" | "server";

/** Whether the sheet now open was opened by this page, so closing it is going back. */
let openedHere = false;

export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (to: string, how: How) => {
      if (how === "server") {
        router.push(`${to}#sessions`, { scroll: false });
        return;
      }
      openedHere = how === "open" || openedHere;
      window.history[how === "open" ? "pushState" : "replaceState"](null, "", to);
    },
    [router],
  );
}

/**
 * A plain link without JavaScript; with it, a move of the calendar that
 * keeps the page: the address changes (so a reload and the back gesture
 * keep it), and nothing loads again.
 */
export function CalendarLink({
  to,
  how,
  onNavigate,
  ...props
}: { to: string; how: How; onNavigate?: () => void } & Omit<ComponentProps<"a">, "href">) {
  const navigate = useNavigate();
  return (
    <a
      {...props}
      href={`${to}#sessions`}
      onClick={(event) => {
        props.onClick?.(event);
        const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
        if (event.defaultPrevented || event.button !== 0 || modified) return;
        event.preventDefault();
        onNavigate?.();
        navigate(to, how);
      }}
    />
  );
}

/** What the calendar shows, read from the address. */
export function useCalendarState(today: string): CalendarState {
  const params = useSearchParams();
  return useMemo(() => calendarState(params, today), [params, today]);
}

/** Close the sheet: back to where the page was before it opened, or, opened from the address, to the calendar. */
export function useCloseSheet(state: CalendarState) {
  const navigate = useNavigate();
  return useCallback(() => {
    if (openedHere) {
      openedHere = false;
      window.history.back();
    } else {
      navigate(calendarHref({ month: state.month, day: state.day }), "replace");
    }
  }, [navigate, state.month, state.day]);
}

/** The sheet is gone (closed, or left by the back gesture): the next one is opened afresh. */
export function sheetClosed(): void {
  openedHere = false;
}
