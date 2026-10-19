"use client";

import { Button, FieldError } from "@sintr/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMessages } from "@/components/language";

/** Prepare the report now, then open it. Nothing is sent. */
export function PrepareButton({ label }: { label: string }) {
  const { prepare } = useMessages().reports;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(false);
  return (
    <div>
      <Button
        type="button"
        size="sm"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setFailure(false);
          void fetch("/api/reports", { method: "POST" })
            .then(async (response) => {
              if (!response.ok) throw new Error("failed");
              const { id } = (await response.json()) as { id: string };
              router.push(`/reports/${id}`);
            })
            .catch(() => {
              setFailure(true);
              setBusy(false);
            });
        }}
      >
        {busy ? prepare.busy : label}
      </Button>
      {busy ? (
        <p role="status" className="mt-3 text-[0.9375rem] text-ink-3">
          {prepare.wait}
        </p>
      ) : null}
      {failure ? <FieldError>{prepare.failed}</FieldError> : null}
    </div>
  );
}
