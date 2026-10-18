import { Panel } from "@sintr/ui";
import { SupportLines } from "@/components/support-lines";

/**
 * Shown once the diary stops for a crisis: the lines to call, large and
 * first, and a plain note that the diary is paused in this conversation.
 */
export function CrisisPanel() {
  return (
    <Panel className="border-ink px-[clamp(20px,4vw,30px)] py-7" role="region" aria-label="Human help, now">
      <SupportLines headingLevel={3} />
      <p className="mt-5 border-t border-rule pt-4 text-[0.9375rem] text-ink-2">
        The diary is paused in this conversation. Nothing from it is being recorded. When you are ready to
        write again, you can start a new conversation.
      </p>
    </Panel>
  );
}
