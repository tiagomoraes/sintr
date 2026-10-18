"use server";

import { ValidationError } from "@sintr/core";
import { notFound, redirect } from "next/navigation";
import { checkinFromForm, isEmptyCheckin, type FormProblems } from "@/lib/forms";
import { requireScope } from "@/lib/server/runtime";

export interface CheckinFormState {
  problems: FormProblems;
  failure: string | null;
}

const INVALID = "Some of it could not be kept as it is. Check the fields and try again.";

/** The quick check-in: written by the person, so it is saved as given. */
export async function createCheckin(_state: CheckinFormState, form: FormData): Promise<CheckinFormState> {
  const { scope } = await requireScope();
  const profile = await scope.profile.get();
  const parsed = checkinFromForm(form, profile.timezone);
  if (!parsed.ok) return { problems: parsed.problems, failure: null };
  if (isEmptyCheckin(parsed.values)) {
    return { problems: {}, failure: "Give at least one value. Everything else can stay empty." };
  }
  let id: string;
  try {
    id = (await scope.checkins.create(parsed.values)).id;
  } catch (error) {
    if (error instanceof ValidationError) return { problems: {}, failure: INVALID };
    throw error;
  }
  redirect(`/checkins/${id}`);
}

/** Correct a check-in; the change is dated and the old values kept. */
export async function correctCheckin(
  id: string,
  _state: CheckinFormState,
  form: FormData,
): Promise<CheckinFormState> {
  const { scope } = await requireScope();
  const profile = await scope.profile.get();
  const parsed = checkinFromForm(form, profile.timezone);
  if (!parsed.ok) return { problems: parsed.problems, failure: null };
  try {
    const result = await scope.checkins.correct(id, parsed.values, { note: parsed.note });
    if (!result) notFound();
  } catch (error) {
    if (error instanceof ValidationError) return { problems: {}, failure: INVALID };
    throw error;
  }
  redirect(`/checkins/${id}`);
}
