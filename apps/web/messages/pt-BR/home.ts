import type { Messages } from "../types";

/** O início: a primeira tela, que é a própria caixa de escrever. */

const PARTS = { morning: "Bom dia", afternoon: "Boa tarde", evening: "Boa noite" } as const;

export const home = {
  title: "Me conta o que aconteceu.",
  greeting: (part: keyof typeof PARTS, name: string | null) =>
    name ? `${PARTS[part]}, ${name}.` : `${PARTS[part]}.`,
  lede: "Fale ou escreva, muito ou pouco, como quiser. Eu escuto, faço uma ou duas perguntas e escrevo um rascunho de registro para você conferir. Nada é guardado até você confirmar.",
  ledeWriteOnly:
    "Com suas palavras, muito ou pouco, como quiser. Eu escuto, faço uma ou duas perguntas e escrevo um rascunho de registro para você conferir. Nada é guardado até você confirmar.",
  ledeAtLimit:
    "Com suas palavras, muito ou pouco, como quiser. Nada é guardado como registro até você confirmar.",
  placeholder: { first: "O que aconteceu?", next: "Escreva aqui", atLimit: "Escreva o que aconteceu" },
  messageLabel: "Sua mensagem",
  send: "Enviar",
  keys: "Enter envia. Shift e Enter para uma nova linha.",
  /** "Ou um check-in rápido, o relatório desta semana ou o que você guardou." */
  doors: {
    label: "Ou",
    checkin: "um check-in rápido",
    report: "o relatório desta semana",
    entries: "o que você guardou",
    between: ", ",
    last: " ou ",
    after: ".",
  },
  unfinished: "Você parou no meio da configuração.",
  unfinishedLink: "Continuar de onde parou",
  earlier: "Conversas anteriores",
  untitled: "Uma conversa",
  started: (when: string) => `Iniciada em ${when}`,
  newConversation: "Nova conversa",
  deleteTitle: "Apagar esta conversa",
  deleteBody:
    "Isso remove de vez as mensagens dela e qualquer rascunho que você não salvou. Os registros e check-ins que você salvou a partir dela continuam no seu diário.",
  deleteIt: "Apagar conversa",
  status: {
    resting: "",
    listening: "Ouvindo",
    transcribing: "Escrevendo o que você disse",
    thinking: "O sintr está pensando",
    proposing: "Um rascunho está esperando por você",
    paused: "O diário está pausado",
  },
  you: "Você: ",
  them: "sintr: ",
  writing: "O sintr está escrevendo",
  log: "Conversa",
  /** "O diário está pausado aqui. Comece uma nova conversa quando quiser." */
  paused: "O diário está pausado aqui.",
  pausedLink: "Comece uma nova conversa",
  pausedAfter: "quando quiser.",
  noAssistant: "Este sintr não tem um assistente próprio. Use sua própria chave em",
  noAssistantLink: "Ajustes",
  noAssistantAfter: "para continuar esta conversa.",
  tryAgain: "Tentar de novo",
  checkSettings: "Conferir o assistente em Ajustes",
  heardRisk:
    "Se você está em perigo, por favor ligue para alguém agora. Suas palavras estão na caixa abaixo, e nada é enviado até você decidir.",
  rehearsal:
    "Modo de ensaio: respostas e transcrições vêm de um assistente roteirizado e offline (SINTR_FAKE_AGENT). Nada é enviado a um provedor.",
} satisfies Messages["home"];
