import { describe, expect, it } from "vitest";
import { findVerbatim, isSaveCommand, statedNumbers, wasStated } from "../src/words";

describe("findVerbatim", () => {
  const person = [
    "Na reunião de segunda, meu chefe perguntou do prazo na frente de todo mundo.",
    "Pensei: “eu vou decepcionar   todo mundo”. Fiquei com uma angústia enorme, uns 80.",
  ];

  it("returns the person's own span, exactly as they typed it", () => {
    // Case, spacing and quote style may differ in the model's copy...
    expect(findVerbatim(person, '"Eu vou decepcionar todo mundo."')).toBe("eu vou decepcionar   todo mundo");
    // ...but what comes back is the person's text, not the model's.
    expect(findVerbatim(person, "ANGÚSTIA")).toBe("angústia");
  });

  it("refuses a paraphrase, a translation and a partial word", () => {
    expect(findVerbatim(person, "vou falhar com todos")).toBeNull();
    expect(findVerbatim(person, "I am going to let everyone down")).toBeNull();
    expect(findVerbatim(person, "angústi")).toBeNull();
    expect(findVerbatim(person, "")).toBeNull();
    expect(findVerbatim(person, '""')).toBeNull();
  });

  it("matches at word boundaries only", () => {
    expect(findVerbatim(["fiquei ansiosa"], "ansiosa")).toBe("ansiosa");
    expect(findVerbatim(["fiquei ansiosa"], "ansiosa demais")).toBeNull();
    expect(findVerbatim(["I was anxious"], "anxiety")).toBeNull();
  });
});

describe("stated numbers", () => {
  it("reads digits, decimals with a comma, hours and minutes, and small number words", () => {
    expect(statedNumbers(["uns 80, talvez 70"])).toEqual(expect.arrayContaining([80, 70]));
    expect(wasStated(["dormi 6,5 horas"], 6.5)).toBe(true);
    expect(wasStated(["dormi 6h30"], 6.5)).toBe(true);
    expect(wasStated(["dormi seis horas e meia"], 6.5)).toBe(true);
    expect(wasStated(["mood 4/5"], 4)).toBe(true);
    expect(wasStated(["energia três"], 3)).toBe(true);
  });

  it("does not see a number that was never written", () => {
    expect(wasStated(["foi muito forte"], 80)).toBe(false);
    expect(wasStated(["uns 180"], 80)).toBe(false);
    expect(wasStated(["dormi 6 horas"], 6.5)).toBe(false);
    // Articles and ordinary words are not numbers.
    expect(wasStated(["tive uma reunião com um cliente"], 1)).toBe(false);
    expect(wasStated(["a reunião dos chefes"], 2)).toBe(false);
    expect(wasStated(["it happened once, with one colleague"], 1)).toBe(false);
  });
});

describe("isSaveCommand", () => {
  it.each([
    "salva",
    "Salva!",
    "pode salvar",
    "sim, salva",
    "salva, por favor",
    "save it",
    "Yes, save it please",
    "confirmo",
    "guárdalo",
  ])("accepts %j as an explicit yes", (text) => expect(isSaveCommand(text)).toBe(true));

  it.each([
    "salva, mas muda a intensidade para 70",
    "não salva",
    "ok",
    "sim",
    "acho que sim",
    "salva?",
    "confirma?",
    "save the first one and drop the second",
    "",
  ])("does not take %j as a yes", (text) => expect(isSaveCommand(text)).toBe(false));
});
