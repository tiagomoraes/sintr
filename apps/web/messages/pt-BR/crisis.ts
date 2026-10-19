import type { Messages } from "../types";

/** As linhas de ajuda: onde encontrar uma pessoa agora, em toda página em que alguém pode escrever. */
export const crisis = {
  heading: "Se você está em perigo ou pensando em se machucar, por favor ligue para alguém agora.",
  lines: {
    cvv: { where: "Brasil", who: "CVV, Centro de Valorização da Vida", how: "Gratuito, 24 horas" },
    samu: { where: "Brasil", who: "SAMU, emergências médicas", how: "Gratuito, 24 horas" },
  },
  call: (who: string, number: string) => `Ligar para ${who}, ${number}`,
  elsewhere:
    "Em qualquer outro lugar, ligue para o número de emergência local ou encontre uma linha gratuita e confidencial em",
  notService: "O sintr é um diário: não é terapia, nem diagnóstico, nem um serviço de crise.",
  panel: {
    label: "Ajuda de uma pessoa, agora",
    paused:
      "O diário está pausado nesta conversa. Nada dela está sendo registrado. Quando quiser voltar a escrever, você pode começar uma nova conversa.",
  },
} satisfies Messages["crisis"];
