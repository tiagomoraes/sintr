import { intlOf } from "./format";

/**
 * Sentences about a record's fields, for its dated changes. The names come
 * from the catalog (`t.entry.labels`, `t.entry.inASentence`, the check-in's
 * the same); the person's answers are shown in their own words.
 */

/**
 * The fields as a sentence names them, joined the way the page's language
 * joins a list: "what happened, the body and how it felt", "o que
 * aconteceu, o que sentiu no corpo e o que sentiu".
 */
export function fieldsInWords(
  fields: readonly string[],
  names: Readonly<Record<string, string>>,
  language: string,
): string {
  const words = fields.map((field) => names[field] ?? field);
  return new Intl.ListFormat(intlOf(language), { style: "long", type: "conjunction" }).format(words);
}

/**
 * Previous values as plain text, for "what it said before". Null when it was
 * empty. `intensity` writes an emotion's strength ("80 of 100"); numbers are
 * written the page's language's way ("7.5", "7,5").
 */
export function valueInWords(
  value: unknown,
  intensity: (value: number) => string,
  language: string,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  const number = (n: number) => new Intl.NumberFormat(intlOf(language)).format(n);
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return value
      .map((item) => {
        if (item && typeof item === "object" && "name" in item) {
          const { name, intensity: strength } = item as { name: unknown; intensity?: unknown };
          return typeof strength === "number" ? `${String(name)}, ${intensity(strength)}` : String(name);
        }
        if (typeof item === "number") return number(item);
        return typeof item === "string" ? item : "";
      })
      .join("; ");
  }
  if (typeof value === "number") return number(value);
  return typeof value === "string" || typeof value === "boolean" ? String(value) : null;
}
