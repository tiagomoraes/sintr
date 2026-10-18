import { cn } from "@sintr/ui";
import { disconnectKey } from "@/app/(app)/connect/actions";
import { DisconnectButton } from "./disconnect-button";

/** One connection key as the person sees it: never the key itself. */
export interface KeyView {
  id: string;
  name: string;
  /** "Read and save", "Save only", "Read only". */
  access: string;
  /** "Last talked to sintr 4 minutes ago, from Claude." or "Not used yet." */
  lastTalked: string;
  used: boolean;
  /** "18 October 2026". */
  made: string;
  /** The first characters, to tell keys apart. */
  prefix: string;
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

/**
 * The keys that still work, each with when its assistant last talked to
 * sintr, and one button to switch it off.
 */
export function KeyList({ keys }: { keys: readonly KeyView[] }) {
  return (
    <div>
      <ul className="border-y border-rule" aria-label="Connected assistants">
        {keys.map((key) => (
          <li
            key={key.id}
            className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-t border-rule py-5 first:border-t-0"
          >
            <div className="min-w-0 flex-1 basis-64">
              <p className="font-medium text-ink [overflow-wrap:anywhere]">{key.name}</p>
              <p className="mt-1 text-[0.9375rem] text-ink-2">
                <UseMark used={key.used} />
                {key.lastTalked}
              </p>
              <p className="mt-1 text-caption text-ink-3">
                {key.access}. Made on {key.made}. Starts with {key.prefix}.
              </p>
            </div>
            <form action={disconnectKey.bind(null, key.id)}>
              <DisconnectButton name={key.name} />
            </form>
          </li>
        ))}
      </ul>
      <p className="mt-3 max-w-[36em] text-caption text-ink-3">
        Disconnecting switches a key off at once. What the assistant already saved stays in your diary, and
        you can connect it again with a new key.
      </p>
    </div>
  );
}
