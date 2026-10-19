"use client";

import { Button } from "@sintr/ui";
import { useFormStatus } from "react-dom";
import { useMessages } from "@/components/language";

export function DisconnectButton({ name }: { name: string }) {
  const { pending } = useFormStatus();
  const K = useMessages().connect.keys;
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending} aria-label={K.disconnectName(name)}>
      {pending ? K.disconnecting : K.disconnect}
    </Button>
  );
}
