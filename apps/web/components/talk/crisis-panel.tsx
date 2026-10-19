"use client";

import { Panel } from "@sintr/ui";
import { useMessages } from "@/components/language";
import { SupportLines } from "@/components/support-lines";

/**
 * Shown once the diary stops for a crisis: the lines to call, large and
 * first, and a plain note that the diary is paused in this conversation.
 */
export function CrisisPanel() {
  const { crisis } = useMessages();
  return (
    <Panel
      className="border-ink px-[clamp(20px,4vw,30px)] py-7"
      role="region"
      aria-label={crisis.panel.label}
    >
      <SupportLines headingLevel={3} />
      <p className="mt-5 border-t border-rule pt-4 text-[0.9375rem] text-ink-2">{crisis.panel.paused}</p>
    </Panel>
  );
}
