"use client";

import { Button } from "@sintr/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMessages } from "@/components/language";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const t = useMessages();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void authClient.signOut().then(() => {
          router.replace("/");
          router.refresh();
        });
      }}
    >
      {t.shell.signOut}
    </Button>
  );
}
