"use client";

import { Button, cn } from "@sintr/ui";
import { useEffect, useState } from "react";
import { useMessages } from "@/components/language";

/** The clipboard API needs a secure page; a self-host on plain http falls back to a selection. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    // Deprecated, and still the only way left on an http page.
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  }
}

/**
 * Copy a piece of text, and say so for a moment: "Copied" in the sage the
 * design keeps for this one confirmation. Screen readers hear it too.
 * `label` says what it copies, with its article, in the page's language:
 * "the link", "o link".
 */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const C = useMessages().connect.copy;
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2400);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void copyText(text).then((ok) => setState(ok ? "copied" : "failed"))}
        aria-label={state === "copied" ? C.copiedLabel(label) : C.copyLabel(label)}
        className={cn(
          "min-h-9 shrink-0 px-4",
          state === "copied" && "border-[#b9cdb9] text-[#2f5a3f] hover:border-[#b9cdb9] hover:text-[#2f5a3f]",
          className,
        )}
      >
        {state === "copied" ? C.copied : C.copy}
      </Button>
      <span role="status" className="sr-only">
        {state === "copied" ? C.copiedStatus(label) : state === "failed" ? C.failed : ""}
      </span>
    </>
  );
}

/** Text to paste somewhere else, exactly: monospace, wrapped on a phone, with its copy button. */
export function Snippet({ text, label, caption }: { text: string; label: string; caption: string }) {
  return (
    <div className="mt-3 overflow-hidden rounded-command border border-rule bg-wash">
      <div className="flex items-center justify-between gap-4 border-b border-rule py-1.5 pl-4 pr-1.5">
        <span className="text-caption text-ink-3">{caption}</span>
        <CopyButton text={text} label={label} />
      </div>
      <pre className="m-0 whitespace-pre-wrap px-4 py-3.5 font-mono text-[0.8125rem] leading-[1.7] text-ink [overflow-wrap:anywhere]">
        <code>{text}</code>
      </pre>
    </div>
  );
}
