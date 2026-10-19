"use client";

import { Button, Panel, linkStyles } from "@sintr/ui";
import Link from "next/link";
import { useMessages } from "@/components/language";
import { OWN_KEY_HREF } from "@/lib/plan";

/**
 * This sintr has no assistant of its own (a typical self-host) and the
 * person has not brought a key: say so plainly, open the door to a key of
 * their own, and leave nothing at a dead end. A client component, like the
 * plan notes it shares the door with.
 */
export function SetupNotice() {
  const { setup } = useMessages().talk;
  return (
    <Panel className="max-w-[40rem]">
      <h2 className="font-serif text-title-small font-normal text-ink">{setup.title}</h2>
      <p className="mt-3 text-ink-2">{setup.body}</p>
      <p className="mt-3 text-ink-2">{setup.without}</p>
      <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-3">
        <Button asChild>
          <Link href={OWN_KEY_HREF}>{setup.ownKey}</Link>
        </Button>
        <Link href="/checkins/new" className={linkStyles}>
          {setup.checkin}
        </Link>
      </div>
    </Panel>
  );
}
