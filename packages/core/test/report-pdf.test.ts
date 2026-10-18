import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkReport } from "../src/report/check";
import { collectDigest, reportLedger } from "../src/report/collect";
import { digestNumbers } from "../src/report/digest";
import { reportDocument } from "../src/report/document";
import { draftContent } from "../src/report/draft";
import { isPdf, renderPdf } from "../src/report/pdf";
import { createRepositories, type UserScope } from "../src/repositories";
import { DEMO_PERIOD, DEMO_TZ, DEMO_TO_BRING, seedDemoDiary } from "./report-fixtures";
import { createUser, openTestDatabase, testMasterKey } from "./support";

/**
 * The PDF a therapist receives, printed by the same Chromium the app uses
 * (Playwright's, installed by `make setup`), from a fixture diary written
 * through the repositories. The text is read back out of the PDF.
 */

async function pdfText(bytes: Uint8Array): Promise<{ pages: number; text: string }> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: bytes, useSystemFonts: false });
  const doc = await task.promise;
  const parts: string[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    parts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  const pages = doc.numPages;
  await task.destroy();
  return { pages, text: parts.join("\n").replace(/\s+/gu, " ") };
}

describe("the report PDF", () => {
  const handle = openTestDatabase();
  let scope: UserScope;

  beforeAll(async () => {
    const repositories = createRepositories(handle.db, testMasterKey);
    const userId = await createUser(handle.db, "pdf");
    await repositories.provision(userId);
    scope = await repositories.forUser(userId);
    await seedDemoDiary(scope);
  });

  afterAll(() => handle.close());

  it("renders from the diary, holds the person's words, and is marked as a draft until approved", async () => {
    const digest = await collectDigest(scope, DEMO_PERIOD, DEMO_TZ);
    const content = {
      ...draftContent({ digest, language: "pt", toBring: DEMO_TO_BRING }),
      week: 'Uma semana puxada no trabalho. Na sexta veio o melhor momento: a volta no parque, "faz tempo que eu não paro assim".',
      mood: "O humor ficou em 2 na terça e na quinta e subiu para 4 na sexta e no sábado. Não houve check-in na quarta.",
    };
    const ledger = await reportLedger(scope, DEMO_PERIOD, content);
    const check = checkReport(content, ledger);
    expect(check.problems).toEqual([]);

    const html = reportDocument({
      content,
      numbers: digestNumbers(digest),
      period: DEMO_PERIOD,
      check,
      status: "draft",
      person: { name: "Pessoa Exemplo" },
      therapist: { name: "Dra. Exemplo" },
    });
    const pdf = await renderPdf(html, { executablePath: process.env.SINTR_CHROMIUM_PATH ?? null });
    expect(isPdf(pdf)).toBe(true);

    const { pages, text } = await pdfText(pdf);
    expect(pages).toBeGreaterThanOrEqual(3);
    expect(text).toContain("Rascunho");
    expect(text).toContain("Como foi a semana");
    expect(text).toContain("faz tempo que eu não paro assim");
    expect(text).toContain("eu sempre deixo a desejar");
    expect(text).toContain("dormi sem despertador");
    expect(text).toContain("A conversa com a coordenadora.");
    expect(text).toContain("13 a 19 de outubro");
    expect(text).toMatch(/1 \/ \d/u); // the page counter in the running foot
  }, 60_000);
});
