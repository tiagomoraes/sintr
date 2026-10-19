import "server-only";
import { HEALTH_DATA_CONSENT_VERSION, loadConfig } from "@sintr/core";
import { createRuntime, type Runtime } from "@sintr/core/runtime";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { safeNext } from "@/lib/redirect";
import { LANGUAGES, matchLanguage, resolveLanguage } from "@/messages";

const holder = globalThis as typeof globalThis & { __sintrRuntime?: Runtime };

/** The cookie that keeps a language chosen in this browser, before signing in or alongside the profile. */
export const LANGUAGE_COOKIE = "sintr_language";

/** A language chosen in this browser, from a request's cookies. */
export function chosenInBrowser(cookieHeader: string | null): string | null {
  const value = new RegExp(`(?:^|;\\s*)${LANGUAGE_COOKIE}=([^;]+)`, "u").exec(cookieHeader ?? "")?.[1];
  return value ? matchLanguage(decodeURIComponent(value)) : null;
}

/** Created on first use, so `next build` never needs the runtime secrets. */
export function runtime(): Runtime {
  if (!holder.__sintrRuntime) {
    const config = loadConfig();
    // A language the installation names must be one it has a catalog for.
    if (config.language && !matchLanguage(config.language)) {
      throw new Error(
        `invalid configuration: SINTR_LANGUAGE: this sintr has no catalog for it (it speaks ${LANGUAGES.map((l) => l.code).join(", ")}); see docs/LANGUAGES.md`,
      );
    }
    holder.__sintrRuntime = createRuntime(config, {
      service: "web",
      // The emails about an account are written as its pages are read (DECISIONS 98).
      languageFor: async (requestHeaders, userId) => {
        const profile = userId ? await (await runtime().repositories.forUser(userId)).profile.get() : null;
        const browser = chosenInBrowser(requestHeaders.get("cookie"));
        const resolved = resolveLanguage({
          chosen: profile?.locale ?? browser,
          installation: config.language,
          accept: requestHeaders.get("accept-language"),
        });
        return { code: resolved.code, chosen: resolved.source === "person" };
      },
    });
  }
  return holder.__sintrRuntime;
}

export const getSession = cache(async () => runtime().auth.api.getSession({ headers: await headers() }));

/** The signed-in person's scope, without the consent gate: for what every page needs, such as its language. */
export const sessionScope = cache(async () => {
  const session = await getSession();
  return session ? runtime().repositories.forUser(session.user.id) : null;
});

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
  const scope = (await sessionScope()) ?? (await runtime().repositories.forUser(user.id));
  const consent = await scope.consents.latest("health_data_processing");
  if (!consent?.granted || consent.version !== HEALTH_DATA_CONSENT_VERSION) redirect("/consent");
  return { user, scope };
});

/** A JSON answer with a code the client can explain. Never content. */
export function apiError(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return Response.json({ code, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * The gate of every data API route: a request from this origin, a real
 * session (checked on the server), and the current consent on record.
 * Returns the person's scope, or the error to answer with.
 */
export async function apiScope(request: Request) {
  const origin = request.headers.get("origin");
  if (request.method !== "GET" && origin !== null && origin !== runtime().config.url.origin) {
    return apiError(403, "origin_refused");
  }
  const session = await runtime().auth.api.getSession({ headers: request.headers });
  if (!session) return apiError(401, "signed_out");
  const scope = await runtime().repositories.forUser(session.user.id);
  const consent = await scope.consents.latest("health_data_processing");
  if (!consent?.granted || consent.version !== HEALTH_DATA_CONSENT_VERSION)
    return apiError(403, "consent_required");
  return { user: session.user, scope };
}
