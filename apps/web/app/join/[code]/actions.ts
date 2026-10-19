"use server";

import { InvalidStateError, NotFoundError, ShareMode, ValidationError } from "@sintr/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { tooManyLookups } from "@/lib/server/join";
import { getMessages } from "@/lib/server/language";
import { requireScope } from "@/lib/server/runtime";

export interface JoinState {
  problem: string | null;
}

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
  const messages = await getMessages();
  const t = messages.sharing.join.problems;
  const changed = messages.sharing.problems.changed;
  if (await tooManyLookups()) return { problem: t.busy };
  if (form.get("consent") !== "on") return { problem: t.consent };
  // The practice as the page showed it: the consent names exactly that.
  const shown = form.get("shown");
  if (typeof shown !== "string" || !shown) return { problem: changed };
  const mode = ShareMode.safeParse(form.get("shareMode") ?? "ask");
  const personName = text(form, "personName");
  if (personName.length > 80) return { problem: t.nameTooLong };
  try {
    await scope.sharing.acceptInvite(code, {
      consent: true,
      personName: personName || null,
      shareMode: mode.success ? mode.data : "ask",
      shownPractice: shown,
    });
  } catch (error) {
    if (error instanceof NotFoundError) return { problem: t.gone };
    if (error instanceof InvalidStateError) {
      if (error.message === "already linked") return { problem: t.linkedPractice };
      if (error.message === "this is your own practice") return { problem: t.ownPractice };
      if (error.message === "the practice changed since it was shown") return { problem: changed };
      if (error.message === "no seat is free") return { problem: t.noSeat };
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
  const messages = await getMessages();
  const t = messages.sharing.join.problems;
  if (await tooManyLookups()) return { problem: t.busy };
  if (!(await scope.practice.get())) {
    const professionalName = text(form, "professionalName");
    if (!professionalName) return { problem: messages.practice.problems.name };
    try {
      await scope.practice.open({
        professionalName,
        practiceName: text(form, "practiceName") || null,
        registration: text(form, "registration") || null,
      });
    } catch (error) {
      if (error instanceof ValidationError) return { problem: t.tooLong };
      if (!(error instanceof InvalidStateError)) throw error;
    }
  }
  try {
    await scope.practice.acceptInvite(code);
  } catch (error) {
    if (error instanceof NotFoundError) return { problem: t.gone };
    if (error instanceof InvalidStateError) {
      if (error.message === "already linked") return { problem: t.linkedPerson };
      if (error.message === "this is your own invite") return { problem: t.ownInvite };
      if (error.message === "no seat is free") return { problem: t.noSeatOwn };
    }
    throw error;
  }
  revalidatePath("/", "layout");
  redirect("/practice");
}
