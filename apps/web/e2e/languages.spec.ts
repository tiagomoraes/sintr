import { parseContent } from "@sintr/core";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  ASSISTANT,
  PASSWORD,
  REPORT,
  closeCore,
  core,
  currentUserId,
  newEmail,
  outbox,
  setUpAssistant,
  signUpQuietly,
} from "./support";

/**
 * F7, end to end: the same app in the person's language. A browser that
 * asks for Portuguese signs up, is welcomed, lands on its home and keeps a
 * conversation in Portuguese, gets its confirmation email and its report
 * in Portuguese; a person who chooses Portuguese in Settings keeps it over
 * an English browser; and the help lines and the choice of language work
 * without JavaScript. The assistant is the offline rehearsal model, which
 * writes its replies in English whatever the person writes: what is in
 * Portuguese here is everything sintr itself says.
 */

const HOUSE = process.env.SINTR_E2E_HOUSE_URL!;

test.afterAll(async () => {
  await closeCore();
});

const lang = (page: Page) => page.locator("html").getAttribute("lang");

/** Settings' language form: the select named `label`, and its own button. */
async function chooseInSettings(page: Page, label: string, value: string) {
  const select = page.getByLabel(label, { exact: true });
  await select.selectOption(value);
  await page.locator("form").filter({ has: select }).getByRole("button").click();
}

/** A browser without JavaScript, signed in with the same session as `page`, reading `language`. */
async function withoutScript(browser: Browser, page: Page, locale: string) {
  const context = await browser.newContext({ javaScriptEnabled: false, locale });
  await context.addCookies(await page.context().cookies());
  return { context, page: await context.newPage() };
}

test.describe("in Portuguese, from the browser", () => {
  test.use({ baseURL: HOUSE, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });

  test("signs up, is welcomed, keeps a conversation and gets its report in Portuguese", async ({ page }) => {
    const email = newEmail("portugues");
    await page.goto("/sign-up");
    expect(await lang(page)).toBe("pt-BR");
    await expect(page.getByRole("heading", { level: 1, name: "Crie seu diário." })).toBeVisible();
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(PASSWORD);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Criar seu diário" }).click();
    await expect(page).toHaveURL(/\/welcome$/);

    // The welcome, in Portuguese, with the help lines in Portuguese beside it.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Este é o seu diário para a semana entre as sessões.",
    );
    await expect(page.getByRole("link", { name: "Ligar para o CVV, 188" })).toBeVisible();
    await page.getByRole("button", { name: "Começar" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Como devo chamar você?" })).toBeVisible();
    await expect(page.getByText("Passo 1 de 3")).toBeVisible();
    await page.getByLabel("Seu nome, ou o nome que você prefere").fill("Bia");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("O nome do seu terapeuta").fill("Dra. Lima");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Quando é a sua sessão com Dra. Lima?" }),
    ).toBeVisible();
    await page.getByRole("radio", { name: "Terças" }).check();
    await page.getByLabel("Horário", { exact: true }).fill("18:00");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Tudo pronto, Bia." })).toBeVisible();
    await expect(page.getByText("Suas sessões são às terças, às 18:00.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Ir para o meu diário" }).click();

    // The home.
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("heading", { level: 1, name: "Me conta o que aconteceu." })).toBeVisible();
    await expect(page.getByText(/^(Bom dia|Boa tarde|Boa noite), Bia\.$/u)).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Seu diário" }).getByRole("link", { name: "Registros" }),
    ).toBeVisible();

    // One conversation: the person's words, a question, a draft in their words, their yes.
    const box = page.getByLabel("Sua mensagem");
    await box.fill("Na reunião de segunda, meu chefe perguntou do prazo na frente de todo mundo.");
    await box.press("Enter");
    await expect(page.getByRole("log").getByText(/What went through your mind/u)).toBeVisible(ASSISTANT);
    await box.fill("Pensei: vou decepcionar todo mundo. Ansiedade 80, vergonha 60.");
    await box.press("Enter");
    const draft = page.getByRole("article", { name: "Rascunho de registro, esperando por você" });
    await expect(draft.getByText("vou decepcionar todo mundo")).toBeVisible(ASSISTANT);
    await expect(draft.getByText("80 de 100")).toBeVisible();
    await draft.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByRole("article", { name: "Registro salvo" })).toBeVisible(ASSISTANT);

    const userId = await currentUserId(page);
    const scope = await core().repositories.forUser(userId);
    expect(await scope.entries.count()).toBe(1);
    // Nothing chosen: the browser decided, and sintr remembers what it showed.
    expect(await scope.profile.get()).toMatchObject({
      locale: null,
      seenLocale: "pt-BR",
      reportLanguage: null,
    });

    // The confirmation email went out in the language the sign-up was read in.
    await expect
      .poll(() => outbox(email).map((message) => message.subject))
      .toContain("Confirme seu e-mail no sintr");

    // The report follows the person's language: its own headings are Portuguese.
    await page.goto("/reports");
    await expect(page.getByRole("heading", { level: 1, name: "Relatórios" })).toBeVisible();
    await page.getByRole("button", { name: "Preparar agora" }).click();
    await expect(page).toHaveURL(/\/reports\/[0-9a-f-]+$/u, REPORT);
    const paper = page.getByRole("article", { name: "O relatório" });
    await expect(paper.getByRole("heading", { name: "Como foi a semana" })).toBeVisible();
    const [report] = await scope.reports.recent();
    const stored = await scope.reports.get(report!.id);
    expect(parseContent(stored?.content ?? null)?.language).toBe("pt");
  });
});

test.describe("the person's own choice", () => {
  test("wins over an English browser, everywhere and without JavaScript", async ({ page, browser }) => {
    await signUpQuietly(page, newEmail("escolha"));
    await setUpAssistant(page);
    await page.goto("/settings");
    expect(await lang(page)).toBe("en");
    await expect(page.getByText("sintr speaks English with you, as your browser asks.")).toBeVisible();
    await chooseInSettings(page, "Language", "pt-BR");

    await expect(page.getByRole("heading", { level: 1, name: "Ajustes" })).toBeVisible();
    expect(await lang(page)).toBe("pt-BR");
    await expect(page.getByText("O sintr fala português com você, como você escolheu.")).toBeVisible();
    const scope = await core().repositories.forUser(await currentUserId(page));
    expect(await scope.profile.get()).toMatchObject({ locale: "pt-BR", seenLocale: "pt-BR" });

    // The crisis screen runs before any model, and its fixed message answers in Portuguese.
    await page.goto("/home");
    await expect(page.getByRole("heading", { level: 1, name: "Me conta o que aconteceu." })).toBeVisible();
    const box = page.getByLabel("Sua mensagem");
    await box.fill("eu quero morrer");
    await box.press("Enter");
    await expect(page.getByRole("log").getByText(/Que bom que você me contou/u)).toBeVisible(ASSISTANT);
    const help = page.getByRole("region", { name: "Ajuda de uma pessoa, agora" });
    await expect(
      help.getByRole("link", { name: "Ligar para CVV, Centro de Valorização da Vida, 188" }),
    ).toBeVisible();
    await expect(help.getByText("O diário está pausado nesta conversa.", { exact: false })).toBeVisible();

    // Another device with an English browser and no JavaScript: still Portuguese, help lines included.
    const bare = await withoutScript(browser, page, "en-US");
    await bare.page.goto("/entries");
    expect(await lang(bare.page)).toBe("pt-BR");
    await expect(bare.page.getByRole("heading", { level: 1, name: "Registros" })).toBeVisible();
    const footer = bare.page.getByRole("contentinfo");
    await expect(
      footer.getByRole("heading", {
        name: "Se você está em perigo ou pensando em se machucar, por favor ligue para alguém agora.",
      }),
    ).toBeVisible();
    await expect(
      footer.getByRole("link", { name: "Ligar para SAMU, emergências médicas, 192" }),
    ).toHaveAttribute("href", "tel:192");
    await expect(footer.getByRole("link", { name: "findahelpline.com" })).toBeVisible();
    await bare.context.close();

    // Giving the choice back: the browser decides again.
    await page.goto("/settings");
    await chooseInSettings(page, "Idioma", "");
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    expect(await scope.profile.get()).toMatchObject({ locale: null, seenLocale: "en" });
  });

  test("can be made before signing in, from the foot of the page, without JavaScript", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, locale: "en-US" });
    const page = await context.newPage();
    await page.goto("/sign-in");
    expect(await lang(page)).toBe("en");
    // Offered in its own words, for whoever reads it.
    const offer = page.getByRole("button", { name: "Ler o sintr em português" });
    await expect(offer).toHaveAttribute("lang", "pt-BR");
    await offer.click();

    await expect(page).toHaveURL(/\/sign-in$/u);
    expect(await lang(page)).toBe("pt-BR");
    await expect(page.getByRole("heading", { level: 1, name: "Olá de novo." })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ligar para CVV, Centro de Valorização da Vida, 188" }),
    ).toBeVisible();
    expect((await context.cookies()).find((cookie) => cookie.name === "sintr_language")).toMatchObject({
      value: "pt-BR",
      httpOnly: true,
      sameSite: "Lax",
    });

    await page.getByRole("button", { name: "Read sintr in English" }).click();
    expect(await lang(page)).toBe("en");
    await expect(page.getByRole("heading", { level: 1, name: "Welcome back." })).toBeVisible();
    await context.close();
  });
});
