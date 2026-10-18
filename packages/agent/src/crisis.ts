/**
 * The crisis protocol (the pack's privacy-and-safety rules). A message that
 * signals acute risk stops the journaling flow: no questions, no structure,
 * no draft. The person gets a warm, fixed message that points to human help,
 * written in advance so it never depends on a model being reachable.
 *
 * This screen is the deterministic layer and runs before any model call.
 * It is deliberately sensitive to self-harm and narrower on violence, where
 * hyperbole is common; the model is told to signal anything it notices
 * beyond these patterns (the signal_crisis tool).
 */

export type CrisisLanguage = "pt" | "en" | "es";
export type RiskKind = "self_harm" | "violence";

export type Screening = { risk: false } | { risk: true; kind: RiskKind; language: CrisisLanguage };

interface Pattern {
  kind: RiskKind;
  language: CrisisLanguage;
  pattern: RegExp;
}

/** Lower case, no accents, single spaces: "Não aguento" becomes "nao aguento". */
function fold(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/\p{M}+/gu, "")
      // Phones type the curly apostrophe: "don\u2019t" must read as "don't".
      .replace(/[\u2018\u2019\u02BC\u0060\u00B4]/gu, "'")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}' ]+/gu, " ")
      .replace(/\s+/gu, " ")
      .trim()
  );
}

/**
 * Figures of speech that mention dying without meaning it. Only the figure
 * is removed, never what follows it: "morrendo de vontade de me matar"
 * becomes "vontade de me matar", which still stops the diary.
 */
const IDIOMS: [RegExp, string][] = [
  [
    /\bmorr\w* de (vergonha|rir|riso|raiva|medo|sono|fome|frio|calor|tedio|saudade|inveja|cansaco|amor|ciume|preguica|curiosidade|vontade|ansiedade|nervoso)\b/gu,
    "$1",
  ],
  [
    /\bmorir(?:me)? de (verguenza|risa|miedo|sueno|hambre|frio|calor|aburrimiento|envidia|ganas|amor)\b/gu,
    "$1",
  ],
  [/\bdie of (embarrassment|shame|boredom|laughter|laughing|curiosity|envy)\b/gu, "$1"],
  [/\bdying (to|of)\b/gu, "$1"],
];

const P = (kind: RiskKind, language: CrisisLanguage, source: string): Pattern => ({
  kind,
  language,
  pattern: new RegExp(`(?:^| )(?:${source})(?: |$)`, "u"),
});

const PATTERNS: Pattern[] = [
  // Portuguese, self-harm. Desire and intent in the first person; "ela vai
  // me matar" (hyperbole) and "achei que ia morrer" (panic) do not match.
  P(
    "self_harm",
    "pt",
    [
      "(?:quero|queria|tenho vontade de|vontade de|penso em|pensando em|pensei em) (?:me )?morrer",
      "(?:quero|queria|vou|vontade de|penso em|pensando em|pensei em|tentar|tentei) me matar",
      // "eu me mato de trabalhar" is a figure of speech; "eu me mato" alone is not.
      "eu me mato(?! de )",
      "suicid\\w*",
      "tirar (?:a )?minha (?:propria )?vida",
      "acabar com (?:a )?minha vida",
      "por fim a minha vida",
      "(?:quero|queria|vou|vontade de|penso em|pensei em) me (?:machucar|cortar|ferir)",
      "me (?:machuco|corto|cortei|machuquei) (?:de proposito|pra aliviar|para aliviar)",
      "automutila\\w*|autolesa\\w*",
      "nao (?:quero|aguento|consigo) (?:mais )?viver",
      "nao quero mais estar aqui",
      "seria melhor (?:se eu )?(?:nao existir|nao existisse|morrer|morresse|sumir|sumisse)",
      "melhor sem mim",
      "overdose",
      "tomar todos os (?:remedios|comprimidos)",
    ].join("|"),
  ),
  // English, self-harm
  P(
    "self_harm",
    "en",
    [
      "kill(?:ing)? myself",
      "end(?:ing)? my (?:own )?life",
      "take my (?:own )?life",
      "end it all",
      "(?:want|wanted|wanna) to die",
      "wish i (?:was|were) dead",
      "better off dead",
      "better off without me",
      "suicid\\w*",
      "(?:want|wanted|wanna|going|thinking about|thought about|urge) to (?:hurt|harm|cut) myself",
      "(?:hurting|harming|cutting) myself",
      "self ?harm\\w*",
      "don'?t want to (?:be alive|live|exist)",
      "no reason to live",
      "can'?t go on living",
      "overdose",
    ].join("|"),
  ),
  // Spanish, self-harm
  P(
    "self_harm",
    "es",
    [
      "(?:quiero|queria|ganas de) morir(?:me)?",
      "(?:quiero|voy a|pienso en|pense en) matarme",
      "me quiero matar",
      "suicid\\w*",
      "quitarme la vida",
      "acabar con mi vida",
      "(?:quiero|voy a) hacerme dano",
      "(?:quiero|voy a) cortarme",
      "no quiero (?:seguir )?viviendo",
      "no quiero vivir",
      "estarian mejor sin mi",
    ].join("|"),
  ),
  // Violence towards someone else: stated future intent only. Anger told in
  // the past ("I wanted to kill him") is something to record, and is left to
  // the model's judgement.
  P(
    "violence",
    "pt",
    [
      "vou (?:matar|esfaquear|machucar|agredir) (?:ele|ela|eles|elas|alguem|voce|voces|todo mundo)",
      "(?:comprei|peguei) uma arma pra (?:matar|acabar)",
    ].join("|"),
  ),
  P(
    "violence",
    "en",
    "(?:i'?m going to|i am going to|i'?m gonna|i will|i'?ll) (?:kill|stab|shoot) (?:him|her|them|someone|somebody|everyone|you)",
  ),
  P("violence", "es", "voy a (?:matar|apunalar)(?:lo|la|los|las| a alguien| a el| a ella)"),
];

/** Screen one message. Idioms are removed before the patterns run. */
export function screenForRisk(text: string): Screening {
  let folded = fold(text);
  for (const [idiom, keep] of IDIOMS) folded = folded.replace(idiom, keep);
  folded = folded.replace(/\s+/gu, " ");
  for (const { kind, language, pattern } of PATTERNS) {
    if (pattern.test(folded)) return { risk: true, kind, language };
  }
  return { risk: false };
}

/** pt-BR, pt, en-US, es... to the three languages the message is written in. */
export function crisisLanguage(language: string | undefined): CrisisLanguage {
  const base = (language ?? "").toLowerCase().slice(0, 2);
  return base === "pt" || base === "es" ? base : "en";
}

const MESSAGES: Record<CrisisLanguage, string> = {
  en: [
    "Thank you for telling me. I am stopping the diary here, because you matter more than any entry.",
    "If you or someone near you is in danger, please talk to a person now. In Brazil you can call CVV on 188, free and at any hour, or SAMU on 192 in an emergency. Anywhere else, call your local emergency number.",
    "If you can, reach out to someone you trust and ask them to stay with you. I am a diary, not a crisis service, so I cannot be the help you need right now. A person can.",
  ].join("\n\n"),
  pt: [
    "Que bom que você me contou. Vou parar o diário aqui, porque você importa mais do que qualquer registro.",
    "Se você ou alguém perto de você está em perigo, por favor, fale com uma pessoa agora. No Brasil, o CVV atende no 188, de graça e a qualquer hora, e o SAMU no 192 em uma emergência. Fora do Brasil, ligue para o número de emergência local.",
    "Se puder, procure alguém de confiança e peça para ficar com você. Eu sou um diário, não um serviço de crise, e não consigo ser a ajuda de que você precisa agora. Uma pessoa consegue.",
  ].join("\n\n"),
  es: [
    "Gracias por contármelo. Voy a detener el diario aquí, porque tú importas más que cualquier registro.",
    "Si tú o alguien cerca de ti está en peligro, por favor, habla con una persona ahora. En Brasil puedes llamar al CVV al 188, gratis y a cualquier hora, o al SAMU al 192 en una emergencia. En otro lugar, llama al número de emergencias local.",
    "Si puedes, busca a alguien de confianza y pídele que se quede contigo. Soy un diario, no un servicio de crisis, y no puedo ser la ayuda que necesitas ahora. Una persona sí puede.",
  ].join("\n\n"),
};

/** The fixed reply that stops the diary and points to human help. */
export function crisisMessage(language: CrisisLanguage): string {
  return MESSAGES[language];
}
