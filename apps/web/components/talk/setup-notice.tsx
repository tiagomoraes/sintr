import { Button, Panel, linkStyles } from "@sintr/ui";
import Link from "next/link";
import { OWN_KEY_HREF } from "./plan-notes";

/**
 * This sintr has no assistant of its own (a typical self-host) and the
 * person has not brought a key: say so plainly, open the door to a key of
 * their own, and leave nothing at a dead end.
 */
export function SetupNotice() {
  return (
    <Panel className="max-w-[40rem]">
      <h2 className="font-serif text-title-small font-normal text-ink">
        This sintr has no assistant of its own yet.
      </h2>
      <p className="mt-3 text-ink-2">
        To talk things through here, bring a key from a provider you choose, or point sintr at a model on your
        own machine. It takes a minute in Settings. What you write then goes to that provider only, and the
        key is encrypted before it is stored.
      </p>
      <p className="mt-3 text-ink-2">Check-ins and your weekly report work without it.</p>
      <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-3">
        <Button asChild>
          <Link href={OWN_KEY_HREF}>Use your own key</Link>
        </Button>
        <Link href="/checkins/new" className={linkStyles}>
          Write a check-in instead
        </Link>
      </div>
    </Panel>
  );
}
