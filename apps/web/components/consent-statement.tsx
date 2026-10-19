"use client";

import { useMessages } from "@/components/language";

export const PRIVACY_URL = "https://github.com/tiagomoraes/sintr-app/blob/main/docs/PRIVACY.md";

/**
 * The words of the health data consent (LGPD art. 11), in the page's
 * language: each one says exactly what the English says. Changing their
 * meaning means a new HEALTH_DATA_CONSENT_VERSION in @sintr/core, which asks
 * everyone again.
 */
export function ConsentStatement() {
  const t = useMessages().auth.consent;
  return (
    <>
      {t.statement}{" "}
      <a
        href={PRIVACY_URL}
        className="text-ink underline decoration-rule-strong underline-offset-[0.28em] hover:decoration-ink"
      >
        {t.privacy}
      </a>
    </>
  );
}
