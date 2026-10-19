"use server";

import { HEALTH_DATA_CONSENT_VERSION } from "@sintr/core";
import { redirect } from "next/navigation";
import { requireUser, runtime } from "@/lib/server/runtime";

/** Record the current health data consent for the signed-in person. */
export async function grantConsent(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (formData.get("consent") !== "on") redirect("/consent?missing=1");
  const scope = await runtime().repositories.forUser(user.id);
  const consent = await scope.consents.record({
    purpose: "health_data_processing",
    version: HEALTH_DATA_CONSENT_VERSION,
    granted: true,
  });
  await scope.auditLog.record({
    action: "consent.recorded",
    targetType: "consent",
    targetId: consent.id,
    metadata: { purpose: "health_data_processing", version: HEALTH_DATA_CONSENT_VERSION },
  });
  redirect("/home");
}
