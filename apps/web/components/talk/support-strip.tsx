/**
 * The crisis lines, one quiet line under the composer, where a person might
 * write about acute risk. Always visible in the conversation.
 */
export function SupportStrip() {
  const call =
    "font-semibold tabular-nums text-ink underline decoration-rule-strong underline-offset-[0.28em] hover:decoration-ink";
  return (
    <p className="text-[0.875rem] leading-[1.5] text-ink-3">
      If you are in danger or thinking about harming yourself, call{" "}
      <a href="tel:188" className={call} aria-label="Call CVV, 188">
        CVV 188
      </a>{" "}
      or{" "}
      <a href="tel:192" className={call} aria-label="Call SAMU, 192">
        SAMU 192
      </a>
      . sintr is a diary, not a crisis service.
    </p>
  );
}
