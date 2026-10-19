import { CopyButton } from "@/components/connect/copy-button";

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
  return (
    <div className="rounded-file border border-rule bg-paper p-5 shadow-card sm:p-6">
      {note ? (
        <p className="mb-5 border-b border-rule pb-4 font-medium text-ink [overflow-wrap:anywhere]">
          For {note}
        </p>
      ) : null}
      <p className="text-caption text-ink-3">The code</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <code className="font-mono text-[1.375rem] tracking-[0.08em] text-ink [overflow-wrap:anywhere]">
          {code}
        </code>
        <CopyButton text={code} label="the code" />
      </div>
      <p className="mt-5 text-caption text-ink-3">Or the link</p>
      <div className="mt-2 flex flex-wrap items-center gap-3 rounded-command border border-rule bg-wash py-2 pl-4 pr-2">
        <code className="min-w-0 flex-1 basis-56 font-mono text-[0.8438rem] text-ink [overflow-wrap:anywhere]">
          {link}
        </code>
        <CopyButton text={link} label="the link" />
      </div>
      <p className="mt-4 text-[0.9375rem] text-ink-2">
        It works until <span className="font-serif italic text-ink">{validUntil}</span>, once.
      </p>
      {footer}
    </div>
  );
}
