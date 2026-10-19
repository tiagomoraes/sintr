import { t } from "@/messages";

/**
 * The crisis lines, one quiet line under the composer and on every step of
 * the welcome, where a person might write or say something about acute
 * risk. Always visible; on a phone the second sentence waits for the page's
 * footer, so the line stays short enough to keep the box within reach.
 */
export function SupportStrip() {
  const call =
    "font-semibold tabular-nums text-ink underline decoration-rule-strong underline-offset-[0.28em] hover:decoration-ink";
  const { strip } = t.shell;
  return (
    <p className="text-[0.875rem] leading-[1.5] text-ink-3">
      {strip.before}{" "}
      <a href="tel:188" className={call} aria-label={strip.callCvv}>
        CVV 188
      </a>{" "}
      {strip.or}{" "}
      <a href="tel:192" className={call} aria-label={strip.callSamu}>
        SAMU 192
      </a>
      .<span className="max-sm:hidden"> {strip.after}</span>
    </p>
  );
}
