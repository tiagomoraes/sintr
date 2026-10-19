"use server";

import { revalidatePath } from "next/cache";
import { RedirectType, redirect } from "next/navigation";
import { calendarHref, isMonth, type SessionProblem } from "@/lib/calendar";
import { requireScope } from "@/lib/server/runtime";
import { keepSession, type SessionIntent } from "@/lib/server/sessions";

/** What a form in the calendar answers when it cannot keep what it was given. */
export interface SessionFormState {
  problem: SessionProblem | null;
}

/**
 * The calendar's forms with JavaScript (without it they post to
 * /api/therapy/sessions, which keeps the same things the same way). Once
 * kept, back to the calendar at the month it was showing, saying what.
 */
async function run(intent: SessionIntent, form: FormData): Promise<SessionFormState> {
  const { scope } = await requireScope();
  const outcome = await keepSession(scope, intent, form);
  if ("problem" in outcome) return { problem: outcome.problem };
  revalidatePath("/", "layout");
  const month = form.get("month");
  const href = calendarHref({ month: typeof month === "string" && isMonth(month) ? month : undefined });
  const said = outcome.done ? `${href.includes("?") ? "&" : "?"}done=${outcome.done}` : "";
  redirect(`${href}${said}#sessions`, RedirectType.replace);
}

export async function addSession(_state: SessionFormState, form: FormData): Promise<SessionFormState> {
  return run("add", form);
}

export async function changeSession(_state: SessionFormState, form: FormData): Promise<SessionFormState> {
  return run("change", form);
}

export async function cancelSession(_state: SessionFormState, form: FormData): Promise<SessionFormState> {
  return run("cancel", form);
}

export async function restoreSession(_state: SessionFormState, form: FormData): Promise<SessionFormState> {
  return run("restore", form);
}

export async function saveTimeZone(_state: SessionFormState, form: FormData): Promise<SessionFormState> {
  return run("zone", form);
}
