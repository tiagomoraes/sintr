import type { Messages } from "../types";

/** Falar em vez de digitar. */
export const voice = {
  speak: "Falar",
  speakLabel: "Falar em vez de digitar",
  listening: "Ouvindo",
  done: "Pronto",
  cancel: "Cancelar",
  transcribing: "Escrevendo o que você disse",
  heard: "Foi isto que eu ouvi. Mude o que quiser e depois envie.",
  clear: "Limpar",
  problems: {
    denied:
      "O sintr não consegue ouvir você: o microfone está bloqueado nesta página. Você pode escrever, ou permitir o microfone nas configurações do seu navegador.",
    no_microphone: "Nenhum microfone foi encontrado neste aparelho. Você pode escrever.",
    too_short: "Foi muito curto. Fale um pouco mais, ou escreva.",
    nothing_heard:
      "Não consegui entender nenhuma palavra. Tente de novo mais perto do microfone, ou escreva.",
    failed: "Não foi possível escrever o que você disse agora. Nada foi guardado; tente de novo, ou escreva.",
    limit: "O tempo de fala deste mês acabou. Você ainda pode escrever aqui.",
  },
  dismiss: "Fechar",
  /** Quando falar não está disponível: uma linha clara, nunca um botão que não faz nada. */
  unavailable: {
    provider_has_no_audio: (provider: string | null) =>
      `${provider ? `O provedor ${provider}` : "Seu provedor"} não aceita áudio, então aqui você escreve. A fala funciona com o assistente incluído, ou com sua própria chave de OpenRouter, OpenAI, Groq ou Google.`,
    provider_unknown: (provider: string | null) =>
      `O sintr não sabe pedir ${provider ? `ao provedor ${provider}` : "ao seu provedor"} que passe a fala para texto, então aqui você escreve. A fala funciona com sua própria chave de OpenRouter, OpenAI, Groq ou Google.`,
    off: () => "A fala está desligada neste sintr, então aqui você escreve.",
    not_configured: () => "",
  },
  /** `next` já vem escrito pelo Intl: "1 de novembro". */
  limit: (next: string) =>
    `O tempo de fala deste mês acabou. Você ainda pode escrever aqui; ele se renova em ${next}.`,
  left: (minutes: number) =>
    minutes <= 1
      ? "Resta menos de um minuto de fala neste mês."
      : `Restam ${minutes} minutos de fala neste mês.`,
  privacy: (who: string) =>
    `O que você diz é passado para texto por ${who}, e a gravação é descartada logo depois: o sintr nunca a guarda.`,
} satisfies Messages["voice"];
