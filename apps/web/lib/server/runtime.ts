import "server-only";
import { HEALTH_DATA_CONSENT_VERSION, loadConfig } from "@sintr/core";
import { createRuntime, type Runtime } from "@sintr/core/runtime";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { safeNext } from "@/lib/redirect";

const holder = globalThis as typeof globalThis & { __sintrRuntime?: Runtime };

/** Created on first use, so `next build` never needs the runtime secrets. */
export function runtime(): Runtime {
  holder.__sintrRuntime ??= createRuntime(loadConfig(), { service: "web" });
  return holder.__sintrRuntime;
}

export const getSession = cache(async () => runtime().auth.api.getSession({ headers: await headers() }));

/** The signed-in person, or a redirect to sign in that returns here afterwards. */
export async function requireUser() {
  const session = await getSession();
  if (!session) {
    const next = safeNext((await headers()).get("x-sintr-path") ?? undefined);
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }
  return session.user;
}

/**
 * The person's data scope. Every page that shows or changes data starts
 * here: it checks the session on the server (not only the cookie), and sends
 * the person to the consent page until the current consent is recorded.
 */
export const requireScope = cache(async () => {
  const user = await requireUser();
  const scope = await runtime().repositories.forUser(user.id);
  const consent = await scope.consents.latest("health_data_processing");
  if (!consent?.granted || consent.version !== HEALTH_DATA_CONSENT_VERSION) redirect("/consent");
  return { user, scope };
});
