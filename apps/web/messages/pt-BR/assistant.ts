import type { Messages } from "../types";

/** O assistente em toda parte: o canto de cada página e a conversa que ele abre ao lado da página. */
export const assistant = {
  open: "Falar com o sintr",
  openWhile: (state: string) => `Falar com o sintr. ${state}`,
  hint: "Fale ou escreva, sem sair desta página",
  close: "Fechar",
  lede: "Fale ou escreva, aqui mesmo. Eu faço uma ou duas perguntas e escrevo um rascunho de registro para você conferir. Nada é guardado até você confirmar.",
  ledeWriteOnly:
    "Escreva aqui, muito ou pouco, como quiser. Eu faço uma ou duas perguntas e escrevo um rascunho de registro para você conferir. Nada é guardado até você confirmar.",
} satisfies Messages["assistant"];
