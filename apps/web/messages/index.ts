import { catalog as en } from "./en";
import { CATALOGS } from "./languages.generated";
import config from "./languages.json";
import type { Catalog, Messages } from "./types";

export type { Catalog, Messages } from "./types";

/** A language this sintr speaks, as `languages.json` lists it. */
export interface Language {
  /** The catalog's folder, and the tag kept for a person's choice. */
  code: string;
  /** The language in its own words. */
  name: string;
  /** How dates and numbers are written. */
  intl: string;
  /** The browser languages (their first part, such as pt) it answers. */
  detect: readonly string[];
}

/** Who decided the language of a page (DECISIONS 98). */
export type LanguageSource = "person" | "installation" | "browser" | "default";

export const DEFAULT_LANGUAGE = "en";

const catalogs: Readonly<Record<string, Catalog>> = CATALOGS;

/** The languages offered, in the order `languages.json` gives them. */
export const LANGUAGES: readonly Language[] = config.languages
  .filter((language) => language.code in catalogs)
  .map((language) => ({ ...language, intl: language.intl || language.code }));

const merged = new Map<string, Messages>();

/**
 * The words of a language. A screen it has not translated is read in
 * English, whole: never a key, never half a sentence in each language.
 */
export function messagesFor(code: string): Messages {
  let messages = merged.get(code);
  if (!messages) {
    messages = { ...en, ...catalogs[code] };
    merged.set(code, messages);
  }
  return messages;
}

export function languageOf(code: string): Language {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0]!;
}

/** The language this sintr speaks for a tag: the same tag, or one that answers its first part. */
export function matchLanguage(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const wanted = tag.trim().toLowerCase();
  const exact = LANGUAGES.find((language) => language.code.toLowerCase() === wanted);
  if (exact) return exact.code;
  const base = wanted.split(/[-_]/u)[0];
  return LANGUAGES.find((language) => language.detect.includes(base ?? ""))?.code ?? null;
}

/** The tags of an Accept-Language header, most wanted first; "*" and q=0 say nothing. */
export function acceptedTags(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .slice(0, 20)
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => /^\s*q\s*=\s*([0-9.]+)\s*$/u.exec(p)?.[1]).find(Boolean);
      return { tag: tag.trim(), q: q === undefined ? 1 : Number(q), index };
    })
    .filter(({ tag, q }) => tag && tag !== "*" && Number.isFinite(q) && q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map(({ tag }) => tag);
}

/**
 * The language of a page, in order (DECISIONS 98): the person's own choice;
 * the installation's (SINTR_LANGUAGE); the first of the browser's languages
 * this sintr speaks; English.
 */
export function resolveLanguage(input: {
  chosen?: string | null;
  installation?: string | null;
  accept?: string | null;
}): { code: string; source: LanguageSource } {
  const chosen = matchLanguage(input.chosen);
  if (chosen) return { code: chosen, source: "person" };
  const installation = matchLanguage(input.installation);
  if (installation) return { code: installation, source: "installation" };
  for (const tag of acceptedTags(input.accept)) {
    const browser = matchLanguage(tag);
    if (browser) return { code: browser, source: "browser" };
  }
  return { code: DEFAULT_LANGUAGE, source: "default" };
}
