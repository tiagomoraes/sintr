import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import {
  languageOf,
  messagesFor,
  resolveLanguage,
  type Language,
  type LanguageSource,
  type Messages,
} from "@/messages";
import { chosenInBrowser, runtime, sessionScope } from "./runtime";

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
  const [scope, requestHeaders] = await Promise.all([sessionScope(), headers()]);
  const profile = scope ? await scope.profile.get() : null;
  const resolved = resolveLanguage({
    chosen: profile?.locale ?? chosenInBrowser(requestHeaders.get("cookie")),
    installation: runtime().config.language,
    accept: requestHeaders.get("accept-language"),
  });
  if (scope && profile && profile.seenLocale !== resolved.code) {
    await scope.profile.update({ seenLocale: resolved.code });
  }
  return { ...languageOf(resolved.code), source: resolved.source };
});

/** The words of this request's language, for a server component, an action or a route. */
export async function getMessages(): Promise<Messages> {
  return messagesFor((await currentLanguage()).code);
}
