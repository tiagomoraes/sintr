"use server";

import { SESSION_REPEATS, ValidationError, findSession, isTimeZone, type SessionRepeat } from "@sintr/core";
import { revalidatePath } from "next/cache";
import { RedirectType, redirect } from "next/navigation";
import { calendarHref, isDay, isMonth, parseSessionKey } from "@/lib/calendar";
import { getMessages } from "@/lib/server/language";
import { requireScope } from "@/lib/server/runtime";

/** What a form in the calendar answers when it cannot keep what it was given. */
export interface SessionFormState {
  problems: Record<string, string>;
}

/** What the calendar says once a change is kept (`therapy.calendar.done`). */
export type SessionDone =
  "added" | "moved" | "changed" | "cancelled" | "stopped" | "removed" | "restored" | "zone";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Back to the calendar, at the month it was showing, saying what was kept. */
function back(form: FormData, done: SessionDone | null): never {
  revalidatePath("/", "layout");
  const month = text(form, "month");
  const href = calendarHref({ month: isMonth(month) ? month : undefined });
  const query = done ? `${href.includes("?") ? "&" : "?"}done=${done}` : "";
  redirect(`${href}${query}#sessions`, RedirectType.replace);
}

/** The day, time and rhythm a form gives, or the sentences that say what to change. */
async function sessionFields(form: FormData) {
  const said = (await getMessages()).therapy.calendar.problems;
  const problems: Record<string, string> = {};
  const day = text(form, "day");
  const time = text(form, "time");
  const repeat = text(form, "repeat") as SessionRepeat;
  const weekdays = [
    ...new Set(
      form
        .getAll("weekdays")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
    ),
  ].sort((a, b) => a - b);
  if (!isDay(day)) problems.day = said.day;
  if (!TIME.test(time)) problems.time = said.time;
  if (!SESSION_REPEATS.includes(repeat)) problems.repeat = said.repeat;
  if (repeat === "weekdays" && weekdays.length === 0) problems.weekdays = said.weekdays;
  return {
    problems,
    input: { startsOn: day, time, repeat, weekdays: repeat === "weekdays" ? weekdays : [] },
  };
}

/** The session the form names, as the calendar holds it now, and whether it may still change. */
async function namedSession(form: FormData) {
  const said = (await getMessages()).therapy.calendar.problems;
  const { scope } = await requireScope();
  const ref = parseSessionKey(text(form, "session"));
  const [calendar, profile] = await Promise.all([scope.sessions.calendar(), scope.profile.get()]);
  const session = ref ? findSession(calendar, profile.timezone, ref) : null;
  const series = session ? calendar.series.find((candidate) => candidate.id === session.seriesId) : undefined;
  if (!ref || !session || !series) return { scope, problem: said.gone } as const;
  if (session.at.getTime() <= Date.now()) return { scope, problem: said.passed } as const;
  return { scope, ref, session, series, problem: null } as const;
}

/** Add a session: a date and a time, alone or the first of a rhythm. */
export async function addSession(_state: SessionFormState, form: FormData): Promise<SessionFormState> {
  const { scope } = await requireScope();
  const { problems, input } = await sessionFields(form);
  if (Object.keys(problems).length > 0) return { problems };
  try {
    await scope.sessions.add(input);
  } catch (error) {
    if (error instanceof ValidationError)
      return { problems: { form: (await getMessages()).therapy.calendar.problems.form } };
    throw error;
  }
  back(form, "added");
}

/**
 * Change one session, or its rhythm from it on. "Only this one" moves that
 * session alone, and refuses a new rhythm (which is about the sessions
 * after it too); "this one and the ones after it" starts the new rhythm
 * there and leaves every earlier session as it was.
 */
export async function changeSession(_state: SessionFormState, form: FormData): Promise<SessionFormState> {
  const said = (await getMessages()).therapy.calendar.problems;
  const named = await namedSession(form);
  if (named.problem !== null) return { problems: { form: named.problem } };
  const { scope, ref, session, series } = named;
  const { problems, input } = await sessionFields(form);
  if (Object.keys(problems).length > 0) return { problems };
  const sameRhythm =
    input.repeat === series.repeat &&
    (input.repeat !== "weekdays" || input.weekdays.join() === series.weekdays.join());
  try {
    if (series.repeat === "once") {
      if (input.repeat === "once") {
        if (input.startsOn === session.on && input.time === session.time) back(form, null);
        await scope.sessions.move(ref, { on: input.startsOn, time: input.time });
        back(form, "moved");
      }
      await scope.sessions.changeFrom(ref, input);
      back(form, "changed");
    }
    if (text(form, "which") === "following") {
      await scope.sessions.changeFrom(ref, input);
      back(form, "changed");
    }
    if (!sameRhythm)
      return { problems: { which: (await getMessages()).therapy.calendar.form.onlyThisRhythm } };
    if (input.startsOn === session.on && input.time === session.time) back(form, null);
    await scope.sessions.move(ref, { on: input.startsOn, time: input.time });
  } catch (error) {
    if (error instanceof ValidationError) return { problems: { form: said.form } };
    throw error;
  }
  back(form, "moved");
}

/** Cancel one session, or a rhythm from one session on. A session that does not repeat leaves the calendar. */
export async function cancelSession(_state: SessionFormState, form: FormData): Promise<SessionFormState> {
  const named = await namedSession(form);
  if (named.problem !== null) return { problems: { form: named.problem } };
  const { scope, ref, series } = named;
  if (series.repeat === "once") {
    await scope.sessions.cancel(ref);
    back(form, "removed");
  }
  if (text(form, "which") === "following") {
    await scope.sessions.stopFrom(ref);
    back(form, "stopped");
  }
  await scope.sessions.cancel(ref);
  back(form, "cancelled");
}

/** Put a moved or cancelled session back where its rhythm has it. */
export async function restoreSession(_state: SessionFormState, form: FormData): Promise<SessionFormState> {
  const named = await namedSession(form);
  if (named.problem !== null) return { problems: { form: named.problem } };
  if (!(await named.scope.sessions.restore(named.ref))) {
    return { problems: { form: (await getMessages()).therapy.calendar.problems.gone } };
  }
  back(form, "restored");
}

/** The zone every session's day and time, and every report's hour, are read in. */
export async function saveTimeZone(form: FormData): Promise<void> {
  const { scope } = await requireScope();
  const timezone = text(form, "timezone");
  if (!isTimeZone(timezone)) back(form, null);
  await scope.profile.update({ timezone });
  back(form, "zone");
}
