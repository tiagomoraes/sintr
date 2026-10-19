"use server";

import {
  InvalidStateError,
  NotFoundError,
  ShareMode,
  ValidationError,
  formatInviteCode,
  normalizeInviteCode,
} from "@sintr/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { joinPath } from "@/lib/sharing";
import { requireScope, runtime } from "@/lib/server/runtime";

export interface CodeState {
  problem: string | null;
}

/** A code the person was given: open it, where they see who is inviting before saying yes. */
export async function openCode(_state: CodeState, form: FormData): Promise<CodeState> {
  await requireScope();
  const raw = form.get("code");
  const code = typeof raw === "string" ? normalizeInviteCode(raw) : null;
  if (!code) return { problem: "Check the code: 12 letters and digits, such as K7QD-2MXP-9F4R." };
  redirect(joinPath(formatInviteCode(code)));
}

export interface TherapistInviteState {
  invite: { id: string; code: string; link: string; expiresAt: string } | null;
  problem: string | null;
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** "Invite your therapist": a code and link to send them. Nothing is shared by making it. */
export async function inviteTherapist(
  _state: TherapistInviteState,
  form: FormData,
): Promise<TherapistInviteState> {
  const { scope } = await requireScope();
  const personName = text(form, "personName").slice(0, 80) || null;
  try {
    const invite = await scope.sharing.createInvite({ personName });
    revalidatePath("/sharing");
    return {
      invite: {
        id: invite.id,
        code: invite.code,
        link: `${runtime().config.url.origin}${joinPath(invite.code)}`,
        expiresAt: invite.expiresAt.toISOString(),
      },
      problem: null,
    };
  } catch (error) {
    if (error instanceof InvalidStateError) {
      return {
        invite: null,
        problem: "You have five invites waiting already. Cancel one you no longer need, then make a new one.",
      };
    }
    throw error;
  }
}

export async function cancelTherapistInvite(id: string): Promise<void> {
  const { scope } = await requireScope();
  await scope.sharing.revokeInvite(id);
  revalidatePath("/sharing");
}

export interface ConfirmState {
  problem: string | null;
}

/** The person's yes to a practice that accepted their invite, with the consent it needs. */
export async function confirmLink(
  linkId: string,
  _state: ConfirmState,
  form: FormData,
): Promise<ConfirmState> {
  const { scope } = await requireScope();
  if (form.get("consent") !== "on") return { problem: "Tick the box to give your consent, or decline." };
  try {
    await scope.sharing.confirm(linkId, { consent: true });
  } catch (error) {
    if (error instanceof NotFoundError)
      return { problem: "This link is no longer waiting. Reload the page." };
    throw error;
  }
  revalidatePath("/", "layout");
  return { problem: null };
}

export async function declineLink(linkId: string): Promise<void> {
  const { scope } = await requireScope();
  await scope.sharing.decline(linkId);
  revalidatePath("/", "layout");
}

/** Stop sharing, at once. */
export async function stopSharing(linkId: string): Promise<void> {
  const { scope } = await requireScope();
  await scope.sharing.end(linkId);
  revalidatePath("/", "layout");
}

export async function setShareMode(linkId: string, form: FormData): Promise<void> {
  const { scope } = await requireScope();
  const mode = ShareMode.safeParse(form.get("shareMode"));
  if (mode.success) await scope.sharing.setShareMode(linkId, mode.data);
  revalidatePath("/sharing");
  revalidatePath("/reports", "layout");
}

export interface NameState {
  saved: boolean;
  problem: string | null;
}

/** The name the practice sees; empty gives a neutral label. */
export async function renameLink(linkId: string, _state: NameState, form: FormData): Promise<NameState> {
  const { scope } = await requireScope();
  const name = text(form, "personName");
  try {
    await scope.sharing.rename(linkId, name || null);
  } catch (error) {
    if (error instanceof ValidationError) return { saved: false, problem: "Use at most 80 characters." };
    throw error;
  }
  revalidatePath("/sharing");
  return { saved: true, problem: null };
}

/** The person saw their notices. The page stays as it is; the next visit shows them as read. */
export async function markSharingNoticesRead(): Promise<void> {
  const { scope } = await requireScope();
  await scope.notices.markRead("person");
}
