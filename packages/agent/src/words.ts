/**
 * Deterministic checks on the person's own words. They let the driver
 * refuse a draft that invents or paraphrases, whatever model is behind it.
 * Matching forgives case, spacing and quote styles; what is stored is
 * always the person's original span, never the model's copy of it.
 */

const QUOTES: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": "'",
  "‛": "'",
  "′": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "‟": '"',
  "«": '"',
  "»": '"',
};

interface Projection {
  /** Lower case, quotes unified, whitespace runs collapsed to one space. */
  text: string;
  /** For each character of `text`, its index in the original. */
  origin: number[];
}

function project(original: string): Projection {
  const source = original.normalize("NFC");
  let text = "";
  const origin: number[] = [];
  let lastSpace = true;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]!;
    if (/\s/u.test(char)) {
      if (!lastSpace) {
        text += " ";
        origin.push(i);
      }
      lastSpace = true;
      continue;
    }
    const lowered = (QUOTES[char] ?? char).toLowerCase();
    for (const unit of lowered) {
      text += unit;
      origin.push(i);
    }
    lastSpace = false;
  }
  return { text, origin };
}

const EDGE_PUNCTUATION = /^[\s"'`([{<.,;:!?…-]+|[\s"'`)\]}>.,;:!?…-]+$/gu;

/** The candidate without surrounding quotes, brackets or end punctuation. */
function core(candidate: string): string {
  return candidate.normalize("NFC").replace(EDGE_PUNCTUATION, "");
}

const WORD = /[\p{L}\p{N}]/u;

/**
 * Find `candidate` in the person's messages, at word boundaries, forgiving
 * case, spacing and quote styles. Returns the person's own span exactly as
 * they typed it, or null if they never said it.
 */
export function findVerbatim(personTexts: readonly string[], candidate: string): string | null {
  const needle = project(core(candidate)).text;
  if (needle.length === 0) return null;
  for (const original of personTexts) {
    const source = original.normalize("NFC");
    const hay = project(source);
    let from = 0;
    for (;;) {
      const at = hay.text.indexOf(needle, from);
      if (at < 0) break;
      const end = at + needle.length;
      const before = at > 0 ? hay.text[at - 1]! : " ";
      const after = end < hay.text.length ? hay.text[end]! : " ";
      if (!WORD.test(before) && !WORD.test(after)) {
        const start = hay.origin[at]!;
        const stop = hay.origin[end - 1]! + 1;
        return source.slice(start, stop);
      }
      from = at + 1;
    }
  }
  return null;
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  one: 1,
  uno: 1,
  dois: 2,
  duas: 2,
  two: 2,
  dos: 2,
  tres: 3,
  three: 3,
  quatro: 4,
  four: 4,
  cuatro: 4,
  cinco: 5,
  five: 5,
  seis: 6,
  six: 6,
  sete: 7,
  seven: 7,
  siete: 7,
  oito: 8,
  eight: 8,
  ocho: 8,
  nove: 9,
  nine: 9,
  nueve: 9,
  dez: 10,
  ten: 10,
  diez: 10,
  onze: 11,
  eleven: 11,
  once: 11,
  doze: 12,
  twelve: 12,
  doce: 12,
};

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/\p{M}+/gu, "");
}

/** Every number the person wrote: digits, decimals with . or , and 6h30. */
export function statedNumbers(personTexts: readonly string[]): number[] {
  const found: number[] = [];
  for (const original of personTexts) {
    const text = stripAccents(original.toLowerCase());
    for (const match of text.matchAll(/(?<![\p{N}])(\d{1,3})\s*h\s*(\d{2})(?![\p{N}])/gu)) {
      found.push(Number(match[1]) + Number(match[2]) / 60);
    }
    for (const match of text.matchAll(/(?<![\p{N}.,])(\d{1,4})(?:[.,](\d{1,2}))?(?![\p{N}])/gu)) {
      found.push(Number(`${match[1]}${match[2] ? `.${match[2]}` : ""}`));
    }
    for (const match of text.matchAll(/\p{L}+/gu)) {
      const value = NUMBER_WORDS[match[0]];
      if (value !== undefined) found.push(value);
    }
    if (/\b(?:e meia|and a half|y media)\b/u.test(text)) {
      for (const match of text.matchAll(/(\d{1,2}|\p{L}+) (?:horas? )?(?:e meia|and a half|y media)/gu)) {
        const base = /^\d/.test(match[1]!) ? Number(match[1]) : NUMBER_WORDS[match[1]!];
        if (base !== undefined) found.push(base + 0.5);
      }
    }
  }
  return found;
}

/** True when the person wrote this number themselves (never guess a number). */
export function wasStated(personTexts: readonly string[], value: number): boolean {
  return statedNumbers(personTexts).some((n) => Math.abs(n - value) < 0.05);
}

const SAVE_VERB =
  "salva|salvar|salve|salva isso|guarda|guardar|guarde|registra|registrar|registre|confirma|confirmar|confirmo|" +
  "save|save it|save this|keep it|record it|confirm|confirm it|guardalo|guardala|graba|grabalo|confirmalo";
const LEAD =
  "sim|yes|yeah|ok|okay|isso|pode|perfeito|otimo|claro|si|vale|esta bien|ta bom|tudo certo|please|por favor";
const TAIL =
  "isso|ai|agora|por favor|pf|please|pls|now|then|entao|obrigado|obrigada|valeu|thanks|thank you|gracias|assim|like that|asi";
const SAVE_COMMAND = new RegExp(
  `^(?:(?:${LEAD})[ ,]+)*(?:pode |can you |you can |puedes )?(?:${SAVE_VERB})(?:[ ,]+(?:${TAIL}))*$`,
  "u",
);

/**
 * True only for an explicit instruction to save and nothing else, such as
 * "salva", "pode salvar", "sim, salva" or "save it". A message that also
 * asks for a change ("salva, mas muda a intensidade") is not one.
 */
export function isSaveCommand(text: string): boolean {
  const normalized = stripAccents(text.toLowerCase())
    .replace(/[.!?;:…]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/ ,/gu, ",");
  if (normalized.length === 0 || normalized.length > 60) return false;
  return SAVE_COMMAND.test(normalized);
}
