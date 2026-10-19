import { describe, expect, it } from "vitest";
import { formatList } from "@/lib/format";
import { changedFields, fieldsOf, leavesPage, type LinkClick } from "@/lib/unsaved";

/**
 * F9: what the guard decides without a page. A form is unsaved by the
 * fields that differ from what stands saved, and a click leaves the page
 * only when it takes the person off it in this tab.
 */

describe("changedFields", () => {
  const saved = fieldsOf([
    ["timezone", "America/Sao_Paulo"],
    ["retention", "keep"],
  ]);

  it("finds nothing when nothing changed", () => {
    const now = fieldsOf([
      ["timezone", "America/Sao_Paulo"],
      ["retention", "keep"],
    ]);
    expect(changedFields(saved, now)).toEqual([]);
  });

  it("names each field that changed", () => {
    const now = fieldsOf([
      ["timezone", "Europe/Lisbon"],
      ["retention", "keep"],
    ]);
    expect(changedFields(saved, now)).toEqual(["timezone"]);
  });

  it("counts a field that appeared or went, and tells an empty field from none", () => {
    const before = fieldsOf([["model", "vendor/model"]]);
    const after = fieldsOf([
      ["model", "vendor/model"],
      ["removeKey", "on"],
    ]);
    expect(changedFields(before, after)).toEqual(["removeKey"]);
    expect(changedFields(fieldsOf([["baseUrl", ""]]), fieldsOf([]))).toEqual(["baseUrl"]);
  });

  it("keeps every value of a name, in order", () => {
    const one = fieldsOf([
      ["day", "1"],
      ["day", "3"],
    ]);
    expect(one.get("day")).toEqual(["1", "3"]);
    expect(
      changedFields(
        one,
        fieldsOf([
          ["day", "3"],
          ["day", "1"],
        ]),
      ),
    ).toEqual(["day"]);
  });

  it("leaves files out", () => {
    const form = new FormData();
    form.append("note", "x");
    form.append("file", new Blob(["x"]), "x.txt");
    expect([...fieldsOf(form).keys()]).toEqual(["note"]);
  });
});

describe("leavesPage", () => {
  const here = "https://sintr.example/settings";
  const click = (overrides: Partial<LinkClick>): LinkClick => ({
    href: "https://sintr.example/entries",
    target: "",
    download: false,
    button: 0,
    modified: false,
    ...overrides,
  });

  it("leaves for another page of the app, and for another site", () => {
    expect(leavesPage(click({}), here)).toBe(true);
    expect(leavesPage(click({ href: "https://sintr.example/welcome?again=1" }), here)).toBe(true);
    expect(leavesPage(click({ href: "https://findahelpline.com/" }), here)).toBe(true);
    expect(leavesPage(click({ target: "_self" }), here)).toBe(true);
  });

  it("leaves for the same page at another address, which opens it again", () => {
    expect(leavesPage(click({ href: "https://sintr.example/settings?key=own#own-key" }), here)).toBe(true);
  });

  it("stays for the same page, or a place on it", () => {
    expect(leavesPage(click({ href: here }), here)).toBe(false);
    expect(leavesPage(click({ href: `${here}#main` }), here)).toBe(false);
  });

  it("stays when the link opens elsewhere: another tab or window, a download, a call", () => {
    expect(leavesPage(click({ modified: true }), here)).toBe(false);
    expect(leavesPage(click({ button: 1 }), here)).toBe(false);
    expect(leavesPage(click({ target: "_blank" }), here)).toBe(false);
    expect(leavesPage(click({ download: true }), here)).toBe(false);
    expect(leavesPage(click({ href: "tel:188" }), here)).toBe(false);
    expect(leavesPage(click({ href: "mailto:someone@example.test" }), here)).toBe(false);
  });
});

describe("formatList", () => {
  it("joins what is unsaved as each language does", () => {
    expect(formatList(["the time zone"], "en")).toBe("the time zone");
    expect(formatList(["the assistant", "the language", "the time zone"], "en")).toBe(
      "the assistant, the language and the time zone",
    );
    expect(formatList(["no assistente", "no idioma", "no fuso horário"], "pt-BR")).toBe(
      "no assistente, no idioma e no fuso horário",
    );
  });
});
