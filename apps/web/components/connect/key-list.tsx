"use client";

import { cn } from "@sintr/ui";
import { disconnectKey } from "@/app/(app)/connect/actions";
import { useMessages } from "@/components/language";
import { DisconnectButton } from "./disconnect-button";

/** One connection key as the person sees it: never the key itself. */
export interface KeyView {
  id: string;
  name: string;
  /** "Save only", "Read and save", "Read only"; for a key made with other scopes, what it can use. */
  access: string;
  /** The access is one of the three, so it is a word beside the name rather than a list of scopes. */
  accessKnown: boolean;
  /** "Last talked to sintr 4 minutes ago, from Claude." or "Not used yet." */
  lastTalked: string;
  used: boolean;
  /** "18 October 2026". */
  made: string;
  /** The first characters, to tell keys apart. */
  prefix: string;
  /** Nothing from its assistant for a long while (QUIET_AFTER_DAYS): the list suggests switching it off. */
  quiet: boolean;
}

/** A small mark: filled once the key has been used, an open ring until then. */
export function UseMark({ used }: { used: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mr-2.5 inline-block size-[7px] -translate-y-px rounded-full",
        used ? "bg-ink" : "border-[1.5px] border-ink-soft",
      )}
    />
  );
}

/** What a key may do, as a small hairline pill beside its name: "Save only". */
export function AccessMark({ children }: { children: string }) {
  return (
    <span className="ml-2.5 inline-flex translate-y-[-0.08em] items-center whitespace-nowrap rounded-pill border border-rule px-2.5 py-px align-middle text-[0.8125rem] font-normal leading-[1.5] text-ink-2">
      {children}
    </span>
  );
}

/**
 * The keys that still work, each with what it may do beside its name, when
 * its assistant last talked to sintr (and, after a long quiet, that it may
 * be one to switch off), and one button to switch it off. A client
 * component, since the setup imports its mark; the servers render it with
 * the keys' words already written (`workingKeys`).
 */
export function KeyList({ keys }: { keys: readonly KeyView[] }) {
  const K = useMessages().connect.keys;
  return (
    <div>
      <ul className="border-y border-rule" aria-label={K.label}>
        {keys.map((key) => (
          <li
            key={key.id}
            className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-t border-rule py-5 first:border-t-0"
          >
            <div className="min-w-0 flex-1 basis-64">
              <p className="font-medium text-ink [overflow-wrap:anywhere]">
                {key.name}
                {key.accessKnown ? <AccessMark>{key.access}</AccessMark> : null}
              </p>
              <p className="mt-1 text-[0.9375rem] text-ink-2">
                <UseMark used={key.used} />
                {key.lastTalked}
              </p>
              {key.quiet ? <p className="mt-1 text-[0.9375rem] text-ink-2">{K.quiet}</p> : null}
              {key.accessKnown ? null : <p className="mt-1 text-caption text-ink-3">{key.access}</p>}
              <p className="mt-1 text-caption text-ink-3">{K.meta(key.made, key.prefix)}</p>
            </div>
            <form action={disconnectKey.bind(null, key.id)}>
              <DisconnectButton name={key.name} />
            </form>
          </li>
        ))}
      </ul>
      <p className="mt-3 max-w-[36em] text-caption text-ink-3">{K.after}</p>
    </div>
  );
}
