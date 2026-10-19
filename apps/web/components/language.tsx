"use client";

import { cn } from "@sintr/ui";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, use, type ReactNode } from "react";
import { chooseLanguage } from "@/lib/server/language-actions";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  languageOf,
  messagesFor,
  type Language,
  type Messages,
} from "@/messages";

const LanguageContext = createContext<string>(DEFAULT_LANGUAGE);

/** The page's language, decided on the server (DECISIONS 98), for what runs in the browser. */
export function LanguageProvider({ code, children }: { code: string; children: ReactNode }) {
  return <LanguageContext value={code}>{children}</LanguageContext>;
}

/** The words of the page's language. */
export function useMessages(): Messages {
  return messagesFor(use(LanguageContext));
}

/** The page's language: its code, its name, and how it writes dates. */
export function useLanguage(): Language {
  return languageOf(use(LanguageContext));
}

/**
 * The other languages, quietly, each offered in its own words for whoever
 * reads it ("Ler o sintr em português" on an English page). A form post that
 * comes back to this page, so it works without JavaScript.
 */
export function LanguageOffers({ className }: { className?: string }) {
  const current = use(LanguageContext);
  const path = usePathname();
  const search = useSearchParams().toString();
  const others = LANGUAGES.filter((language) => language.code !== current);
  if (others.length === 0) return null;
  return (
    <form
      action={chooseLanguage}
      aria-label={messagesFor(current).language.offers}
      className={cn("flex flex-wrap items-baseline gap-x-5 gap-y-1", className)}
    >
      <input type="hidden" name="next" value={search ? `${path}?${search}` : path} />
      {others.map((language) => (
        <button
          key={language.code}
          type="submit"
          name="language"
          value={language.code}
          lang={language.code}
          className="cursor-pointer text-[0.875rem] text-ink-3 underline decoration-rule-strong underline-offset-[0.28em] transition-colors duration-300 hover:text-ink hover:decoration-ink"
        >
          {messagesFor(language.code).language.offer}
        </button>
      ))}
    </form>
  );
}
