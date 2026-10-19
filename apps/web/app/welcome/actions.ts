"use server";

import { InvalidStateError, NotFoundError, ShareMode, ValidationError, isTimeZone } from "@sintr/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { tooManyLookups } from "@/lib/server/join";
import { requireScope } from "@/lib/server/runtime";
import { safeNext } from "@/lib/redirect";
import { t } from "@/messages";

/** What a step answers: saved, or one plain sentence about what to change. */
export interface StepResult {
  ok: boolean;
  problem: string | null;
}

const OK: StepResult = { ok: true, problem: null };
const fail = (problem: string): StepResult => ({ ok: false, problem });

/**
 * The welcome begins: the person's time zone is taken from their device,
 * unless they already chose one, so dates and the greeting are theirs from
 * the first screen.
 */
export async function beginWelcome(timezone: string): Promise<StepResult> {
  const { scope } = await requireScope();
  const profile = await scope.profile.get();
  if (profile.timezone === "UTC" && isTimeZone(timezone) && timezone !== "UTC") {
    await scope.profile.update({ timezone });
  }
  return OK;
}

/** How the person wants to be called: kept sealed, for greetings only. */
export async function saveName(name: string): Promise<StepResult> {
  const { scope } = await requireScope();
  const value = name.trim();
  if (value.length > 80) return fail(t.welcome.name.tooLong);
  await scope.profile.update({ preferredName: value || null });
  return OK;
}

/** The therapist's name, as the report will be for them. */
export async function saveTherapist(name: string): Promise<StepResult> {
  const { scope } = await requireScope();
  const value = name.trim();
  if (value.length > 200) return fail(t.welcome.therapist.tooLong);
  await scope.therapySettings.update({ therapistName: value || null });
  return OK;
}

/** When the sessions are, read in the person's time zone; the report is prepared before each one. */
export async function saveSession(input: {
  day: string;
  time: string;
  timezone: string;
}): Promise<StepResult> {
  const { scope } = await requireScope();
  const day = input.day === "" ? null : Number(input.day);
  const time = input.time.trim() === "" ? null : input.time.trim();
  if ((day === null) !== (time === null)) return fail(t.welcome.session.needBoth);
  if (day !== null && !(Number.isInteger(day) && day >= 0 && day <= 6))
    return fail(t.welcome.session.needBoth);
  if (time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return fail(t.welcome.session.badTime);
  if (!isTimeZone(input.timezone)) return fail(t.welcome.problem);
  try {
    await scope.profile.update({ timezone: input.timezone });
    await scope.therapySettings.update({ sessionDay: day, sessionTime: time });
  } catch (error) {
    if (error instanceof ValidationError) return fail(t.welcome.problem);
    throw error;
  }
  return OK;
}

const INVITE = t.welcome.invite.problems;

/**
 * The person accepts the practice's invite they arrived with, inside the
 * welcome: the same yes and the same consent as on the invite's own page
 * (decision 56), naming the practice as it was shown. Nothing is shared by
 * accepting.
 */
export async function acceptInWelcome(code: string, form: FormData): Promise<StepResult> {
  const { scope } = await requireScope();
  if (await tooManyLookups()) return fail(INVITE.busy);
  if (form.get("consent") !== "on") return fail(INVITE.consent);
  const shown = form.get("shown");
  if (typeof shown !== "string" || !shown) return fail(INVITE.changed);
  const mode = ShareMode.safeParse(form.get("shareMode") ?? "ask");
  const given = form.get("personName");
  const personName = typeof given === "string" ? given.trim() : "";
  if (personName.length > 80) return fail(INVITE.tooLong);
  try {
    await scope.sharing.acceptInvite(code, {
      consent: true,
      personName: personName || null,
      shareMode: mode.success ? mode.data : "ask",
      shownPractice: shown,
    });
  } catch (error) {
    if (error instanceof NotFoundError) return fail(INVITE.gone);
    if (error instanceof InvalidStateError) {
      if (error.message === "already linked") return OK;
      if (error.message === "the practice changed since it was shown") return fail(INVITE.changed);
      if (error.message === "no seat is free") return fail(INVITE.noSeat);
      if (error.message === "this is your own practice") return fail(INVITE.own);
    }
    throw error;
  }
  // No revalidation here: it would render the welcome again from its first question. The
  // diary's frame is fresh when the welcome ends (finishWelcome).
  return OK;
}

/** The welcome is behind the person, finished or set aside: on to the home (or where they were going). */
export async function finishWelcome(next: string | null): Promise<void> {
  const { scope } = await requireScope();
  await scope.profile.markOnboarded();
  revalidatePath("/", "layout");
  const target = safeNext(next ?? undefined);
  // An invite already answered inside the welcome is not opened again.
  redirect(target.startsWith("/join/") ? "/home" : target);
}
