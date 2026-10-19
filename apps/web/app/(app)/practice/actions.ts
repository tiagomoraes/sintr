"use server";

import {
  InvalidStateError,
  ValidationError,
  formatInviteCode,
  normalizeInviteCode,
  type PracticePatch,
} from "@sintr/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CodeState } from "@/app/(app)/sharing/actions";
import { joinPath } from "@/lib/sharing";
import { getMessages } from "@/lib/server/language";
import { requireScope, runtime } from "@/lib/server/runtime";
import type { Messages } from "@/messages";

export interface PracticeFormState {
  saved: boolean;
  problems: Record<string, string>;
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function practiceFields(
  form: FormData,
  t: Messages["practice"]["problems"],
): { values: PracticePatch; problems: Record<string, string> } {
  const problems: Record<string, string> = {};
  const professionalName = text(form, "professionalName");
  const practiceName = text(form, "practiceName");
  const registration = text(form, "registration");
  if (!professionalName) problems.professionalName = t.name;
  if (professionalName.length > 120) problems.professionalName = t.tooLong(120);
  if (practiceName.length > 160) problems.practiceName = t.tooLong(160);
  if (registration.length > 120) problems.registration = t.tooLong(120);
  return {
    values: { professionalName, practiceName: practiceName || null, registration: registration || null },
    problems,
  };
}

/** Open the practice: one per account, from inside the app. The diary stays as it is. */
export async function openPractice(_state: PracticeFormState, form: FormData): Promise<PracticeFormState> {
  const { scope } = await requireScope();
  const { values, problems } = practiceFields(form, (await getMessages()).practice.problems);
  if (Object.keys(problems).length) return { saved: false, problems };
  try {
    await scope.practice.open({ ...values, professionalName: values.professionalName! });
  } catch (error) {
    if (!(error instanceof InvalidStateError)) throw error;
  }
  revalidatePath("/", "layout");
  redirect("/practice");
}

/** The names the practice shows, and whether to hear about new reports by email. */
export async function savePractice(_state: PracticeFormState, form: FormData): Promise<PracticeFormState> {
  const { scope } = await requireScope();
  const t = (await getMessages()).practice.problems;
  const { values, problems } = practiceFields(form, t);
  if (Object.keys(problems).length) return { saved: false, problems };
  try {
    await scope.practice.update({ ...values, notifyEmail: form.get("notifyEmail") === "on" });
  } catch (error) {
    if (error instanceof ValidationError) return { saved: false, problems: { form: t.check } };
    throw error;
  }
  revalidatePath("/", "layout");
  return { saved: true, problems: {} };
}

export interface PatientInviteState {
  invite: { id: string; code: string; link: string; expiresAt: string; note: string | null } | null;
  problem: string | null;
}

/** A code and link for a patient. It holds a seat until it is accepted, cancelled or expires. */
export async function invitePatient(_state: PatientInviteState, form: FormData): Promise<PatientInviteState> {
  const { scope } = await requireScope();
  const note = text(form, "note").slice(0, 120) || null;
  try {
    const invite = await scope.practice.createInvite({ note });
    revalidatePath("/practice");
    return {
      invite: {
        id: invite.id,
        code: invite.code,
        link: `${runtime().config.url.origin}${joinPath(invite.code)}`,
        expiresAt: invite.expiresAt.toISOString(),
        note: invite.note,
      },
      problem: null,
    };
  } catch (error) {
    if (error instanceof InvalidStateError) {
      const t = (await getMessages()).practice.problems;
      return { invite: null, problem: error.message === "no seat is free" ? t.noSeat : t.invites };
    }
    throw error;
  }
}

export async function cancelPatientInvite(id: string): Promise<void> {
  const { scope } = await requireScope();
  await scope.practice.revokeInvite(id);
  revalidatePath("/practice");
}

/** Disconnect a patient: the same end as theirs, at once, and they are told. */
export async function disconnectPatient(linkId: string): Promise<void> {
  const { scope } = await requireScope();
  await scope.practice.endLink(linkId);
  revalidatePath("/practice");
  redirect("/practice");
}

/** A code a patient gave the professional: open it, to see who it is from and accept it. */
export async function openPatientCode(_state: CodeState, form: FormData): Promise<CodeState> {
  await requireScope();
  const raw = form.get("code");
  const code = typeof raw === "string" ? normalizeInviteCode(raw) : null;
  if (!code) return { problem: (await getMessages()).sharing.problems.code };
  redirect(joinPath(formatInviteCode(code)));
}

/** The professional saw the practice's notices. The page stays as it is until the next visit. */
export async function markPracticeNoticesRead(): Promise<void> {
  const { scope } = await requireScope();
  await scope.notices.markRead("practice");
}
