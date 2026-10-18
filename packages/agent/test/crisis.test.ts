import { describe, expect, it } from "vitest";
import { crisisLanguage, crisisMessage, screenForRisk } from "../src/crisis";

describe("the crisis screen", () => {
  it.each([
    ["quero morrer", "pt"],
    ["Não aguento mais viver assim", "pt"],
    ["às vezes penso em me matar", "pt"],
    ["pensei em suicídio de novo", "pt"],
    ["queria tirar minha própria vida", "pt"],
    ["todo mundo ficaria melhor sem mim", "pt"],
    ["tenho vontade de me cortar", "pt"],
    ["I want to die", "en"],
    ["I keep thinking about killing myself", "en"],
    ["I just want to end it all", "en"],
    ["I've been cutting myself again", "en"],
    ["everyone would be better off without me", "en"],
    ["quiero morir", "es"],
    ["pienso en quitarme la vida", "es"],
  ] as const)("stops the diary for %j (%s)", (text, language) => {
    expect(screenForRisk(text)).toEqual({ risk: true, kind: "self_harm", language });
  });

  it.each([
    ["vou matar ele quando chegar em casa", "pt"],
    ["I'm going to kill him tonight", "en"],
    ["voy a matarlo", "es"],
  ] as const)("stops the diary for stated intent to harm someone: %j", (text, language) => {
    expect(screenForRisk(text)).toEqual({ risk: true, kind: "violence", language });
  });

  it.each([
    "quase morri de vergonha na apresentação",
    "queria morrer de vergonha",
    "minha mãe vai me matar se eu chegar tarde",
    "achei que ia morrer, o coração disparou",
    "me cortei cozinhando, nada de mais",
    "vou matar aula amanhã",
    "fui matar a saudade da minha avó",
    "não vejo saída para esse projeto",
    "I'm dying to know how it went",
    "I could die of embarrassment",
    "my boss is going to kill me",
    "I hurt myself at the gym",
    "I was so angry I wanted to kill him",
    "estoy muerta de cansancio",
  ])("keeps listening to %j (an idiom or something to record)", (text) => {
    expect(screenForRisk(text)).toEqual({ risk: false });
  });
});

describe("the crisis message", () => {
  it.each(["pt", "en", "es"] as const)(
    "is warm, stops the diary and names CVV 188 and SAMU 192 (%s)",
    (language) => {
      const message = crisisMessage(language);
      expect(message).toContain("188");
      expect(message).toContain("192");
      expect(message).not.toMatch(/[\u2013\u2014]/u);
      expect(message).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(message.length).toBeLessThan(800);
    },
  );

  it("is written in the person's language", () => {
    expect(crisisMessage(crisisLanguage("pt-BR"))).toContain("Que bom que você me contou");
    expect(crisisMessage(crisisLanguage("es-AR"))).toContain("Gracias por contármelo");
    expect(crisisMessage(crisisLanguage("ja"))).toContain("Thank you for telling me");
    expect(crisisMessage(crisisLanguage(undefined))).toContain("Thank you for telling me");
  });
});
