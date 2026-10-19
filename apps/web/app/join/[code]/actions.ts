"use server";

import { InvalidStateError, NotFoundError, ShareMode, ValidationError } from "@sintr/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { tooManyLookups } from "@/lib/server/join";
import { requireScope } from "@/lib/server/runtime";

export interface JoinState {
  problem: string | null;
}

const GONE =
  "This invite does not work any more: it may have expired, been cancelled or been used. Ask for a new one.";
const BUSY = "Too many tries from here. Wait a few minutes, then try again.";
const CHANGED =
  "The practice changed its name or details since this page opened. Reload the page and read them again.";

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The person accepts a practice's invite: their yes, with the consent to
 * share the reports they approve with that practice, as the page showed it.
 * Nothing is shared by accepting; reports go one by one, or as the person chose.
 */
export async function acceptAsPerson(code: string, _state: JoinState, form: FormData): Promise<JoinState> {
  const { scope } = await requireScope();
  if (await tooManyLookups()) return { problem: BUSY };
  if (form.get("consent") !== "on")
    return { problem: "Tick the box to give your consent, or leave it for now." };
  // The practice as the page showed it: the consent names exactly that.
  const shown = form.get("shown");
  if (typeof shown !== "string" || !shown) return { problem: CHANGED };
  const mode = ShareMode.safeParse(form.get("shareMode") ?? "ask");
  const personName = text(form, "personName");
  if (personName.length > 80) return { problem: "Use at most 80 characters for your name." };
  try {
    await scope.sharing.acceptInvite(code, {
      consent: true,
      personName: personName || null,
      shareMode: mode.success ? mode.data : "ask",
      shownPractice: shown,
    });
  } catch (error) {
    if (error instanceof NotFoundError) return { problem: GONE };
    if (error instanceof InvalidStateError) {
      if (error.message === "already linked")
        return { problem: "You are already linked with this practice." };
      if (error.message === "this is your own practice")
        return { problem: "This is your own practice's invite." };
      if (error.message === "the practice changed since it was shown") return { problem: CHANGED };
      if (error.message === "no seat is free") {
        return {
          problem: "This practice has no free seat right now. Let your therapist know; nothing was shared.",
        };
      }
    }
    throw error;
  }
  revalidatePath("/", "layout");
  redirect("/sharing");
}

/**
 * A professional accepts a person's invite from their practice, opening the
 * practice first if they have none. The person then confirms on their side.
 */
export async function acceptAsPractice(code: string, _state: JoinState, form: FormData): Promise<JoinState> {
  const { scope } = await requireScope();
  if (await tooManyLookups()) return { problem: BUSY };
  if (!(await scope.practice.get())) {
    const professionalName = text(form, "professionalName");
    if (!professionalName) return { problem: "Write your name as the people you see know it." };
    try {
      await scope.practice.open({
        professionalName,
        practiceName: text(form, "practiceName") || null,
        registration: text(form, "registration") || null,
      });
    } catch (error) {
      if (error instanceof ValidationError)
        return { problem: "Some of it is too long. Shorten it and try again." };
      if (!(error instanceof InvalidStateError)) throw error;
    }
  }
  try {
    await scope.practice.acceptInvite(code);
  } catch (error) {
    if (error instanceof NotFoundError) return { problem: GONE };
    if (error instanceof InvalidStateError) {
      if (error.message === "already linked") return { problem: "You are already linked with this person." };
      if (error.message === "this is your own invite") return { problem: "This is your own invite." };
      if (error.message === "no seat is free") {
        return {
          problem: "Your practice has no free seat. Free one, or ask for more, then open this link again.",
        };
      }
    }
    throw error;
  }
  revalidatePath("/", "layout");
  redirect("/practice");
}
