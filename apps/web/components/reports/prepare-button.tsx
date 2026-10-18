"use client";

import { Button, FieldError } from "@sintr/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Prepare the report now, then open it. Nothing is sent. */
export function PrepareButton({ label }: { label: string }) {
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
        {busy ? "Preparing the report" : label}
      </Button>
      {busy ? (
        <p role="status" className="mt-3 text-[0.9375rem] text-ink-3">
          Reading the days since the last report. This can take a minute when your assistant writes it.
        </p>
      ) : null}
      {failure ? (
        <FieldError>The report could not be prepared just now. Try again in a moment.</FieldError>
      ) : null}
    </div>
  );
}
