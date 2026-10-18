export const PRIVACY_URL = "https://github.com/tiagomoraes/sintr-app/blob/main/docs/PRIVACY.md";

/**
 * The words of the health data consent (LGPD art. 11). Changing their
 * meaning means a new HEALTH_DATA_CONSENT_VERSION in @sintr/core, which asks
 * everyone again.
 */
export function ConsentStatement() {
  return (
    <>
      I agree that sintr keeps what I write here, including things about my mental health, so it can keep this
      diary for me. It is encrypted before it is stored, used for nothing else, and never shared with anyone
      unless I approve that specific report.{" "}
      <a
        href={PRIVACY_URL}
        className="text-ink underline decoration-rule-strong underline-offset-[0.28em] hover:decoration-ink"
      >
        How sintr handles your data
      </a>
    </>
  );
}
