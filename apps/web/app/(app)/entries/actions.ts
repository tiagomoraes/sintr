"use server";

import { ValidationError } from "@sintr/core";
import { notFound, redirect } from "next/navigation";
import { entryFromForm, type FormProblems } from "@/lib/forms";
import { requireScope } from "@/lib/server/runtime";

export interface EntryFormState {
  problems: FormProblems;
  failure: string | null;
}

/**
 * Correct a saved entry: the entry shows the new words, and a dated
 * correction keeps what changed and what it said before.
 */
export async function correctEntry(
  id: string,
  _state: EntryFormState,
  form: FormData,
): Promise<EntryFormState> {
  const { scope } = await requireScope();
  const profile = await scope.profile.get();
  const parsed = entryFromForm(form, profile.timezone);
  if (!parsed.ok) return { problems: parsed.problems, failure: null };
  try {
    const result = await scope.entries.correct(id, parsed.values, { note: parsed.note });
    if (!result) notFound();
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        problems: {},
        failure: "Some of it could not be kept as it is. Check the fields and try again.",
      };
    }
    throw error;
  }
  redirect(`/entries/${id}`);
}
