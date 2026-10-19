import "server-only";
import type { Profile } from "@sintr/core";
import { headers } from "next/headers";
import { cache } from "react";
import {
  chosenInCookie,
  languageOf,
  messagesFor,
  resolveLanguage,
  type Language,
  type LanguageSource,
  type Messages,
} from "@/messages";
import { runtime, sessionScope } from "./runtime";

export interface PageLanguage extends Language {
  /** Who decided it: the person, the installation, the browser, or nobody (English). */
  source: LanguageSource;
}

/**
 * The language of this request, in order (DECISIONS 98): the person's own
 * choice (on their profile, or in this browser before signing in); the
 * installation's (SINTR_LANGUAGE); the browser's Accept-Language; English.
 * For a signed-in person it is also remembered (`profiles.seen_locale`), so
 * what sintr writes while they are away (the scheduled report, an email)
 * is in the language they read it in.
 */
export const currentLanguage = cache(async (): Promise<PageLanguage> => {
  const requestHeaders = await headers();
  // The language must never be why a page fails: without the profile, the browser's choice and the rest decide.
  let scope: Awaited<ReturnType<typeof sessionScope>> = null;
  let profile: Profile | null = null;
  try {
    scope = await sessionScope();
    profile = scope ? await scope.profile.get() : null;
  } catch (error) {
    runtime().log.warn("language.profile_unavailable", { error });
  }
  const resolved = resolveLanguage({
    chosen: profile?.locale ?? chosenInCookie(requestHeaders.get("cookie")),
    installation: runtime().config.language,
    accept: requestHeaders.get("accept-language"),
  });
  if (scope && profile && profile.seenLocale !== resolved.code) {
    // Remembered for what is written while the person is away; a failure only delays it to the next page.
    await scope.profile.update({ seenLocale: resolved.code }).catch((error: unknown) => {
      runtime().log.warn("language.seen_failed", { error });
    });
  }
  return { ...languageOf(resolved.code), source: resolved.source };
});

/** The words of this request's language, for a server component, an action or a route. */
export async function getMessages(): Promise<Messages> {
  return messagesFor((await currentLanguage()).code);
}
