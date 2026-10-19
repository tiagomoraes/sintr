import "server-only";
import {
  SESSION_REPEATS,
  ValidationError,
  findSession,
  isTimeZone,
  type SessionRepeat,
  type UserScope,
} from "@sintr/core";
import { isDay, parseSessionKey, type SessionProblem } from "@/lib/calendar";

/**
 * What the calendar's forms ask of the server, from a server action (with
 * JavaScript) or a plain form post to /api/therapy/sessions (without it):
 * the same checks and the same changes either way.
 */
export const SESSION_INTENTS = ["add", "change", "cancel", "restore", "zone"] as const;
export type SessionIntent = (typeof SESSION_INTENTS)[number];

/** What the calendar says once a change is kept (`therapy.calendar.done`). */
export type SessionDone =
  "added" | "moved" | "changed" | "cancelled" | "stopped" | "removed" | "restored" | "zone";

export type SessionOutcome = { done: SessionDone | null } | { problem: SessionProblem };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** The day, time and rhythm a form gives, or the first thing to change. */
function fields(form: FormData) {
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
  let problem: SessionProblem | null = null;
  if (!isDay(day)) problem = "day";
  else if (!TIME.test(time)) problem = "time";
  else if (!SESSION_REPEATS.includes(repeat)) problem = "repeat";
  else if (repeat === "weekdays" && weekdays.length === 0) problem = "weekdays";
  return { problem, input: { startsOn: day, time, repeat, weekdays: repeat === "weekdays" ? weekdays : [] } };
}

/** The session the form names, as the calendar holds it now, if it may still change. */
async function named(scope: UserScope, form: FormData) {
  const ref = parseSessionKey(text(form, "session"));
  const [calendar, profile] = await Promise.all([scope.sessions.calendar(), scope.profile.get()]);
  const session = ref ? findSession(calendar, profile.timezone, ref) : null;
  const series = session ? calendar.series.find((one) => one.id === session.seriesId) : undefined;
  if (!ref || !session || !series) return { problem: "gone" as const };
  if (session.at.getTime() <= Date.now()) return { problem: "passed" as const };
  return { ref, session, series, problem: null };
}

/**
 * Keep what a calendar form asks. "Only this one" moves that session alone
 * and refuses a new rhythm, which is about the sessions after it too; "this
 * one and the ones after it" starts the new rhythm there, or stops the
 * rhythm there, and leaves every earlier session as it was.
 */
export async function keepSession(scope: UserScope, intent: string, form: FormData): Promise<SessionOutcome> {
  try {
    switch (intent) {
      case "add": {
        const { problem, input } = fields(form);
        if (problem) return { problem };
        await scope.sessions.add(input);
        return { done: "added" };
      }
      case "change": {
        const found = await named(scope, form);
        if (found.problem !== null) return { problem: found.problem };
        const { ref, session, series } = found;
        const { problem, input } = fields(form);
        if (problem) return { problem };
        const unchanged = input.startsOn === session.on && input.time === session.time;
        if (series.repeat === "once") {
          if (input.repeat !== "once") {
            await scope.sessions.changeFrom(ref, input);
            return { done: "changed" };
          }
          if (unchanged) return { done: null };
          await scope.sessions.move(ref, { on: input.startsOn, time: input.time });
          return { done: "moved" };
        }
        if (text(form, "which") === "following") {
          await scope.sessions.changeFrom(ref, input);
          return { done: "changed" };
        }
        const sameRhythm =
          input.repeat === series.repeat &&
          (input.repeat !== "weekdays" || input.weekdays.join() === series.weekdays.join());
        if (!sameRhythm) return { problem: "which" };
        if (unchanged) return { done: null };
        await scope.sessions.move(ref, { on: input.startsOn, time: input.time });
        return { done: "moved" };
      }
      case "cancel": {
        const found = await named(scope, form);
        if (found.problem !== null) return { problem: found.problem };
        if (found.series.repeat === "once") {
          await scope.sessions.cancel(found.ref);
          return { done: "removed" };
        }
        if (text(form, "which") === "following") {
          await scope.sessions.stopFrom(found.ref);
          return { done: "stopped" };
        }
        await scope.sessions.cancel(found.ref);
        return { done: "cancelled" };
      }
      case "restore": {
        const found = await named(scope, form);
        if (found.problem !== null) return { problem: found.problem };
        return (await scope.sessions.restore(found.ref)) ? { done: "restored" } : { problem: "gone" };
      }
      case "zone": {
        const timezone = text(form, "timezone");
        if (!isTimeZone(timezone)) return { problem: "timezone" };
        await scope.profile.update({ timezone });
        return { done: "zone" };
      }
      default:
        return { problem: "form" };
    }
  } catch (error) {
    if (error instanceof ValidationError) return { problem: "form" };
    throw error;
  }
}
