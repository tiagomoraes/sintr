"use server";

import { redirect } from "next/navigation";
import { requireScope } from "@/lib/server/runtime";

/** Delete one conversation, its messages and its open drafts. Saved entries stay. */
export async function deleteConversation(id: string): Promise<void> {
  const { scope } = await requireScope();
  await scope.conversations.remove(id);
  redirect("/talk");
}
