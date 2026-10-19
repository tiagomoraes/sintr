import type { Profile } from "./domain";
import { reportLanguage, type ReportLanguage } from "./report/content";

/**
 * The language sintr writes in for a person who is not there to ask: the
 * scheduled report, the emails. Their own choice; else the language sintr
 * last showed them, which the app resolved from the installation's language
 * or their browser (DECISIONS 98); else the installation's. Null means
 * English. While the person is in the app, the web resolves it from the
 * request instead, and keeps `seenLocale` up to date.
 */
export function personLanguage(
  profile: Pick<Profile, "locale" | "seenLocale">,
  installation: string | null,
): string | null {
  return profile.locale ?? profile.seenLocale ?? installation;
}

/** The language of the person's reports: the one they chose in Therapy, else their own. */
export function reportLanguageFor(
  profile: Pick<Profile, "locale" | "seenLocale" | "reportLanguage">,
  installation: string | null,
): ReportLanguage {
  return reportLanguage(profile.reportLanguage ?? personLanguage(profile, installation));
}
