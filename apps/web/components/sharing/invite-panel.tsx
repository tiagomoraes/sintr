"use client";

import { CopyButton } from "@/components/connect/copy-button";
import { useMessages } from "@/components/language";

/**
 * A fresh invite: the code to read aloud or type, and the link to send, each
 * with its copy button, and how long it works.
 */
export function InvitePanel({
  code,
  link,
  validUntil,
  note,
  footer,
}: {
  code: string;
  link: string;
  /** "Sunday 26 October". */
  validUntil: string;
  /** The professional's own note on who it is for. */
  note?: string | null;
  footer?: React.ReactNode;
}) {
  const t = useMessages().sharing.panel;
  return (
    <div className="rounded-file border border-rule bg-paper p-5 shadow-card sm:p-6">
      {note ? (
        <p className="mb-5 border-b border-rule pb-4 font-medium text-ink [overflow-wrap:anywhere]">
          {t.forNote(note)}
        </p>
      ) : null}
      <p className="text-caption text-ink-3">{t.code}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <code className="font-mono text-[1.375rem] tracking-[0.08em] text-ink [overflow-wrap:anywhere]">
          {code}
        </code>
        <CopyButton text={code} label={t.copyCode} />
      </div>
      <p className="mt-5 text-caption text-ink-3">{t.link}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3 rounded-command border border-rule bg-wash py-2 pl-4 pr-2">
        <code className="min-w-0 flex-1 basis-56 font-mono text-[0.8438rem] text-ink [overflow-wrap:anywhere]">
          {link}
        </code>
        <CopyButton text={link} label={t.copyLink} />
      </div>
      <p className="mt-4 text-[0.9375rem] text-ink-2">
        {t.until.before} <span className="font-serif italic text-ink">{validUntil}</span>
        {t.until.after}
      </p>
      {footer}
    </div>
  );
}
