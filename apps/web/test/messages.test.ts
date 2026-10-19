import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatDay, formatMoment, intlOf, languageName, weekday } from "@/lib/format";
import {
  LANGUAGES,
  acceptedTags,
  chosenInCookie,
  matchLanguage,
  messagesFor,
  resolveLanguage,
  type Catalog,
} from "@/messages";
import { catalog as english } from "@/messages/en";
import { CATALOGS } from "@/messages/languages.generated";

/**
 * F7: languages are data. Every language this sintr lists has a whole
 * catalog: the same screens as English, the same keys, the same shape, the
 * copy rules in every sentence. A language that is missing something fails
 * here, by name and key, before anyone reads half a screen.
 */

const config = JSON.parse(
  readFileSync(fileURLToPath(new URL("../messages/languages.json", import.meta.url)), "utf8"),
) as { languages: { code: string; name: string; intl: string; detect: string[] }[] };

const catalogs = CATALOGS as Record<string, Catalog>;

/** The values a sentence is tried with: whichever its arguments are, one of these runs. */
const TRIES: unknown[][] = [
  ["Ana", "Ana", "Ana", "Ana"],
  [3, 3, 3, 3],
  [1, 1, 1, 1],
  [null, null, null, null],
  [true, true, true, true],
  [false, false, false, false],
];

function outputs(fn: (...args: unknown[]) => unknown): string[] {
  const said: string[] = [];
  for (const args of TRIES) {
    try {
      const value = fn(...args);
      if (typeof value === "string") said.push(value);
      else if (Array.isArray(value)) said.push(...value.filter((v): v is string => typeof v === "string"));
    } catch {
      // Not the kind of value this sentence takes.
    }
  }
  return said;
}

/** Every difference in shape between English and a language, as "feature.key: what". */
function differences(source: unknown, other: unknown, path: string): string[] {
  if (typeof source === "string") return typeof other === "string" ? [] : [`${path}: not a sentence`];
  if (typeof source === "function") {
    if (typeof other !== "function") return [`${path}: not a function`];
    // A sentence that drops a value English gives it would lose that value silently.
    const [want, got] = [(source as () => unknown).length, (other as () => unknown).length];
    return got === want ? [] : [`${path}: takes ${got} values, English gives ${want}`];
  }
  if (Array.isArray(source)) {
    if (!Array.isArray(other)) return [`${path}: not a list`];
    if (other.length !== source.length)
      return [`${path}: ${other.length} items, English has ${source.length}`];
    return source.flatMap((item, index) => differences(item, other[index], `${path}.${index}`));
  }
  if (source && typeof source === "object") {
    if (!other || typeof other !== "object") return [`${path}: missing`];
    const found = other as Record<string, unknown>;
    const missing = Object.entries(source).flatMap(([key, value]) =>
      key in found ? differences(value, found[key], `${path}.${key}`) : [`${path}.${key}: missing`],
    );
    const extra = Object.keys(found)
      .filter((key) => !(key in source))
      .map((key) => `${path}.${key}: not in English`);
    return [...missing, ...extra];
  }
  return [];
}

/** Every sentence of a catalog, written out (functions with the values above). */
function sentences(value: unknown, path: string): { path: string; text: string }[] {
  if (typeof value === "string") return [{ path, text: value }];
  if (typeof value === "function")
    return outputs(value as (...args: unknown[]) => unknown).map((text) => ({ path, text }));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([key, inner]) => sentences(inner, `${path}.${key}`));
  return [];
}

const RULES = [
  { name: "an em dash", pattern: /\u2014/u },
  { name: "an en dash", pattern: /\u2013/u },
  { name: "an emoji", pattern: /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]|\u{FE0F}|\u{200D}/u },
];

describe("the languages", () => {
  it("are the ones languages.json lists, English first, each with its catalog registered", () => {
    expect(config.languages[0]?.code).toBe("en");
    expect(Object.keys(CATALOGS)).toEqual(config.languages.map((language) => language.code));
    expect(LANGUAGES.map((language) => language.code)).toEqual(config.languages.map((l) => l.code));
    // The registry is written from the list; a stale one fails here and in make lint.
    const root = fileURLToPath(new URL("../../..", import.meta.url));
    expect(() => execFileSync("node", ["scripts/languages.mjs", "--check"], { cwd: root })).not.toThrow();
  });

  it("ship English and Brazilian Portuguese", () => {
    expect(LANGUAGES.map((language) => language.code)).toEqual(expect.arrayContaining(["en", "pt-BR"]));
  });

  for (const { code } of config.languages.filter((language) => language.code !== "en")) {
    describe(code, () => {
      const catalog = catalogs[code] ?? {};

      it("has every screen of English, in its own words", () => {
        const features = Object.keys(english) as (keyof typeof english)[];
        const missing = features.filter((feature) => !(feature in catalog));
        expect(missing, `${code} has no ${missing.join(", ")}`).toEqual([]);
        // A screen that only re-exports English is not translated yet.
        const copied = features.filter((feature) => (catalog[feature] as unknown) === english[feature]);
        expect(copied, `${code} still reads ${copied.join(", ")} in English`).toEqual([]);
      });

      it("is written in its own words, not English left in place after copying the folder", () => {
        // Words that stay the same in any language (sintr, PDF, a code) are short; a sentence is not.
        const left = (Object.keys(english) as (keyof typeof english)[]).filter((feature) => {
          const theirs = new Map(sentences(catalog[feature], feature).map(({ path, text }) => [path, text]));
          const long = sentences(english[feature], feature).filter(({ text }) => text.length >= 24);
          const same = long.filter(({ path, text }) => theirs.get(path) === text);
          return long.length > 0 && same.length * 2 > long.length;
        });
        expect(left, `${code} reads ${left.join(", ")} mostly in English`).toEqual([]);
      });

      it("has every key of English, of the same shape, and nothing English does not have", () => {
        expect(differences(english, catalog, code)).toEqual([]);
      });

      it("leaves no sentence empty that English says", () => {
        const empty = sentences(english, code)
          .filter(({ text }) => text.trim() !== "")
          .map(({ path }) => path)
          .filter((path, index, all) => all.indexOf(path) === index)
          .filter((path) => {
            const value = path
              .split(".")
              .slice(1)
              .reduce<unknown>((at, key) => (at as Record<string, unknown>)?.[key], catalog);
            return sentences(value, path).every(({ text }) => text.trim() === "");
          });
        expect(empty).toEqual([]);
      });
    });
  }

  for (const { code } of config.languages) {
    it(`${code} keeps the copy rules: no em or en dashes, no emoji`, () => {
      const broken = sentences(messagesFor(code), code).flatMap(({ path, text }) =>
        RULES.filter((rule) => rule.pattern.test(text)).map((rule) => `${path}: ${rule.name}`),
      );
      expect(broken).toEqual([]);
    });
  }

  it("read a screen a language has not translated in English, whole", () => {
    const partial = messagesFor("not-a-language");
    expect(partial.home.title).toBe(english.home.title);
  });
});

describe("who decides the language", () => {
  it("is the person first, then the installation, then the browser, then English", () => {
    const accept = "pt-BR,pt;q=0.9,en;q=0.8";
    expect(resolveLanguage({ chosen: "en", installation: "pt-BR", accept })).toEqual({
      code: "en",
      source: "person",
    });
    expect(resolveLanguage({ chosen: null, installation: "pt-BR", accept: "en-US" })).toEqual({
      code: "pt-BR",
      source: "installation",
    });
    expect(resolveLanguage({ chosen: null, installation: null, accept })).toEqual({
      code: "pt-BR",
      source: "browser",
    });
    expect(resolveLanguage({ chosen: null, installation: null, accept: "zz-ZZ,xx;q=0.5" })).toEqual({
      code: "en",
      source: "default",
    });
    expect(resolveLanguage({})).toEqual({ code: "en", source: "default" });
  });

  it("skips a choice or a setting it has no catalog for", () => {
    expect(resolveLanguage({ chosen: "zz", installation: null, accept: "pt-BR" }).code).toBe("pt-BR");
    expect(resolveLanguage({ chosen: null, installation: "xx", accept: "en" })).toEqual({
      code: "en",
      source: "browser",
    });
  });

  it("reads the browser's languages by weight, and answers a variant with the language it knows", () => {
    expect(acceptedTags("en;q=0.5, pt-PT , fr;q=0, *;q=0.1")).toEqual(["pt-PT", "en"]);
    expect(acceptedTags("")).toEqual([]);
    expect(resolveLanguage({ accept: "zz;q=1, pt-PT;q=0.7, en;q=0.6" })).toEqual({
      code: "pt-BR",
      source: "browser",
    });
    expect(matchLanguage("PT-br")).toBe("pt-BR");
    expect(matchLanguage("en-US")).toBe("en");
    expect(matchLanguage("zz")).toBeNull();
  });
});

describe("a language chosen in the browser", () => {
  it("is read from its cookie, and only when sintr speaks it", () => {
    expect(chosenInCookie("a=1; sintr_language=pt-BR; b=2")).toBe("pt-BR");
    expect(chosenInCookie("sintr_language=pt-br")).toBe("pt-BR");
    expect(chosenInCookie("sintr_language=zz")).toBeNull();
    expect(chosenInCookie("other_sintr_language=pt-BR")).toBeNull();
    expect(chosenInCookie("sintr_language=%E0%A4%A")).toBeNull();
    expect(chosenInCookie(null)).toBeNull();
  });
});

describe("dates and names in the page's language", () => {
  const at = new Date("2026-10-20T21:40:00Z");
  const sp = { timezone: "America/Sao_Paulo" };

  it("write English as before, and Portuguese as Portuguese does", () => {
    expect(intlOf("en")).toBe("en-GB");
    expect(intlOf("pt-BR")).toBe("pt-BR");
    expect(formatMoment(at, { language: "en", ...sp })).toBe("Tuesday 20 October at 18:40");
    expect(formatMoment(at, { language: "pt-BR", ...sp })).toBe("terça-feira, 20 de outubro às 18:40");
    expect(formatDay(at, { language: "pt-BR", ...sp })).toBe("20 de outubro de 2026");
    expect(weekday(2, "en")).toBe("Tuesday");
    expect(weekday(2, "pt-BR")).toBe("terça-feira");
    expect(languageName("pt-BR", "en")).toBe("Portuguese");
    expect(languageName("en", "pt-BR")).toBe("inglês");
  });
});
