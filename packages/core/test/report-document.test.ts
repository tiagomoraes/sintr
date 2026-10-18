import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REPORT_ASSETS } from "../src/report/assets.generated";
import { buildCorpus, checkReport, entryTexts } from "../src/report/check";
import { buildDigest, digestNumbers } from "../src/report/digest";
import { cssString, reportDocument } from "../src/report/document";
import { draftContent } from "../src/report/draft";
import { REPORT_STRINGS } from "../src/report/strings";
import { DEMO_PERIOD, DEMO_TZ, demoRecords } from "./report-fixtures";

function render(
  overrides: { status?: "draft" | "reviewed" | "sent"; language?: "pt" | "en" | "es"; week?: string } = {},
) {
  const { entries, checkins } = demoRecords();
  const digest = buildDigest({ period: DEMO_PERIOD, timeZone: DEMO_TZ, entries, checkins });
  const content = {
    ...draftContent({
      digest,
      language: overrides.language ?? "pt",
      toBring: ["A conversa com a coordenadora."],
    }),
    week:
      overrides.week ??
      'Uma semana puxada no trabalho. Na quinta, "eu sempre deixo a desejar"; na sexta, "não fui eu que disse isso".',
  };
  const check = checkReport(content, {
    corpus: buildCorpus(entries.flatMap((e) => entryTexts(e))),
    entries: new Map(),
    notes: new Map(checkins.map((c) => [c.id, c.note])),
  });
  return reportDocument({
    content,
    numbers: digestNumbers(digest),
    period: DEMO_PERIOD,
    check,
    status: overrides.status ?? "draft",
    person: { name: "Pessoa Exemplo" },
    therapist: { name: "Dra. Exemplo" },
  });
}

describe("the report document", () => {
  it("is one self-contained page: fonts and the light inline, no script, nothing remote", () => {
    const html = render();
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain("data:font/woff2;base64,");
    expect(html).toContain("data:image/jpeg;base64,");
    expect(html).not.toMatch(/<script|(?:src|href)="https?:|url\(https?:|<link /iu);
  });

  it("puts only the person's verified words under the highlighter", () => {
    const html = render();
    expect(html).toContain('<q class="said">eu sempre deixo a desejar</q>');
    // Not in the diary: quoted, but never highlighted as the person's words.
    expect(html).toContain("“não fui eu que disse isso”");
    expect(html).not.toContain('<q class="said">não fui eu que disse isso</q>');
    // The moments' thoughts and the day's notes come from the records.
    expect(html).toContain('<q class="said">não tem como dar conta de tudo</q>');
    expect(html).toContain('<q class="said">dormi sem despertador</q>');
  });

  it("marks an unapproved report as a draft, and says who reviewed an approved one", () => {
    const s = REPORT_STRINGS.pt;
    const draft = render();
    expect(draft).toContain(s.draft);
    expect(draft).not.toContain("revisado por Pessoa Exemplo");
    const reviewed = render({ status: "reviewed" });
    expect(reviewed).not.toContain(s.draft);
    expect(reviewed).toContain("revisado por Pessoa Exemplo antes do envio");
  });

  it("prints the six sections in the report's language, with the numbers computed", () => {
    const html = render();
    for (const heading of [
      "Como foi a semana",
      "Para conversar na sessão",
      "Humor, energia e sono",
      "Momentos que marcaram",
    ]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain("13 a 19 de outubro.");
    expect(html).toContain("6 de 7 dias");
    expect(html).toContain("sem check-in: qua");
    expect(html).toContain("segunda, 19/10, 18h");
    expect(html).toContain("3,0"); // average mood, Portuguese decimals
    expect(html).toContain('65 <svg class="arrow"'); // the re-rate 65 to 40 is drawn with an arrow
    const english = render({ language: "en" });
    expect(english).toContain("How the week went");
    expect(english).toContain("October 13 to 19.");
  });

  it("escapes whatever the words contain", () => {
    const html = render({ week: 'Escreveu <script>alert(1)</script> & "eu sempre deixo a desejar".' });
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp;");
    expect(html).not.toContain("<script>alert");
  });

  it("keeps a name inside the running foot's CSS, whatever it holds", () => {
    expect(cssString('Ana </style><script>x</script> "B"\nC')).toBe(
      '"Ana \\3c /style\\3e \\3c script\\3e x\\3c /script\\3e  \\22 B\\22 \\a C"',
    );
  });

  it("uses no dashes in what it prints", () => {
    const text = render()
      .replace(/<style>[\s\S]*?<\/style>/gu, "")
      .replace(/data:[^"')]+/gu, "");
    expect(text).not.toMatch(/[\u2013\u2014]/u);
  });

  it("embeds the design system's fonts and the light exactly as they are on disk (make report-assets)", () => {
    const b64 = (path: string) => readFileSync(new URL(path, import.meta.url)).toString("base64");
    expect(REPORT_ASSETS.serifRoman).toBe(b64("../../ui/fonts/source-serif-4-roman.woff2"));
    expect(REPORT_ASSETS.serifItalic).toBe(b64("../../ui/fonts/source-serif-4-italic.woff2"));
    expect(REPORT_ASSETS.sans).toBe(b64("../../ui/fonts/hanken-grotesk.woff2"));
    expect(REPORT_ASSETS.light).toBe(b64("../assets/report-light.jpg"));
  });
});
