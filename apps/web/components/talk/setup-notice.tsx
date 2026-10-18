import { Button, Panel, linkStyles } from "@sintr/ui";
import Link from "next/link";

/** Before any provider is set: calm, and with a way forward. */
export function SetupNotice() {
  return (
    <Panel className="max-w-[40rem]">
      <h2 className="font-serif text-title-small font-normal text-ink">
        The assistant needs a provider first.
      </h2>
      <p className="mt-3 text-ink-2">
        sintr talks to the model you choose, with your own key. The key is encrypted before it is stored and
        is never shown again.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-3">
        <Button asChild>
          <Link href="/settings">Set up the assistant</Link>
        </Button>
        <Link href="/checkins/new" className={linkStyles}>
          Write a check-in instead
        </Link>
      </div>
    </Panel>
  );
}
