import type { Messages } from "../types";

/** O idioma em que o sintr fala: a escolha da pessoa, dita em Ajustes e oferecida com discrição no resto. */
export const language = {
  offer: "Ler o sintr em português",
  offers: "Outros idiomas",
  title: "Seu idioma",
  summary: {
    person: (name: string) => `O sintr fala ${name} com você, como você escolheu.`,
    installation: (name: string) => `O sintr fala ${name} com você, como este sintr foi configurado.`,
    browser: (name: string) => `O sintr fala ${name} com você, como o seu navegador pede.`,
    default: (name: string) => `O sintr fala ${name} com você.`,
  },
  body: "As telas, as linhas de ajuda e os e-mails que o sintr envia para você seguem esse idioma. O assistente responde no idioma em que você escreve, e as suas palavras ficam exatamente como você escreveu.",
  label: "Idioma",
  automatic: "Deixar o sintr escolher",
  automaticHint: "Assim ele segue a configuração deste sintr e, se não houver, o seu navegador.",
  save: "Salvar",
} satisfies Messages["language"];
