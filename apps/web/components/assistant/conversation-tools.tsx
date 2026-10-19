"use client";

import { Button, linkStyles } from "@sintr/ui";
import Link from "next/link";
import { useMessages } from "@/components/language";
import { useAssistant } from "./provider";

/** "New conversation": the shell lets the current one go (it stays in the list), and the home opens empty. */
export function NewConversationLink() {
  const { home } = useMessages();
  const a = useAssistant();
  return (
    <Link href="/home" onClick={a.restart} className={linkStyles}>
      {home.newConversation}
    </Link>
  );
}

/** Deleting the conversation on screen: the shell forgets it too, so the home opens empty. */
export function DeleteConversationForm({ action }: { action: () => Promise<void> }) {
  const { home } = useMessages();
  const a = useAssistant();
  return (
    <form action={action} onSubmit={a.restart} className="mt-4">
      <p className="max-w-[36em] text-[0.9375rem] text-ink-3">{home.deleteBody}</p>
      <Button type="submit" variant="outline" size="sm" className="mt-4">
        {home.deleteIt}
      </Button>
    </form>
  );
}
