"use client";

import { Button } from "@sintr/ui";
import { useFormStatus } from "react-dom";

export function DisconnectButton({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending} aria-label={`Disconnect ${name}`}>
      {pending ? "Disconnecting" : "Disconnect"}
    </Button>
  );
}
