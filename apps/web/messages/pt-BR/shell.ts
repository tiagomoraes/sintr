import type { Messages } from "../types";

/** A moldura do diário: as seções, o menu no celular e a luz. */
export const shell = {
  nav: {
    label: "Seu diário",
    practiceLabel: "Seu consultório",
    something: ", algo novo",
    home: "Início",
    entries: "Registros",
    checkins: "Check-ins",
    memory: "Memória",
    therapy: "Terapia",
    reports: "Relatórios",
    sharing: "Compartilhar",
    connect: "Outros assistentes",
    settings: "Ajustes",
    plan: "Plano",
    practice: "Consultório",
    dashboard: "Painel",
  },
  about: {
    home: "Conte o que aconteceu, por voz ou por escrito.",
    entries: "Os momentos que você guardou, nas suas palavras.",
    checkins: "Uma linha sobre o dia: humor, energia, sono.",
    memory: "O que o seu assistente lembra de você, e de onde veio.",
    therapy: "Seu terapeuta e quando são suas sessões.",
    reports: "Sua semana em uma página, antes de cada sessão.",
    sharing: "Deixe seu terapeuta ler os relatórios que você aprovar.",
    connect: "Mantenha seu diário pelo ChatGPT, Claude ou Gemini.",
    settings: "O assistente, seu e-mail, seu fuso horário.",
    plan: "Quanto do assistente você tem neste mês.",
    practice: "Os relatórios que seus pacientes compartilham com você.",
  },
  menu: { open: "Menu", close: "Fechar", title: "Seu diário" },
  strip: {
    before: "Se você está em perigo ou pensando em se machucar, ligue para",
    or: "ou",
    after: "O sintr é um diário, não um serviço de crise.",
    callCvv: "Ligar para o CVV, 188",
    callSamu: "Ligar para o SAMU, 192",
  },
  signOut: "Sair",
  homeLink: "sintr, início",
  skip: "Pular para o conteúdo",
  notice: {
    openSharing: "Abrir Compartilhar",
    reportReady: (when: string) => `Seu relatório para a sessão de ${when} está pronto para você ler.`,
    weeklyReady: "Seu relatório da semana está pronto para você ler.",
    readIt: "Ler",
  },
  practiceNote:
    "Os relatórios chegam quando uma pessoa os aprova e compartilha, nunca em tempo real, e o sintr não acompanha ninguém: é um diário que as pessoas mantêm para si mesmas, não um prontuário clínico, uma ferramenta de monitoramento ou um serviço de crise. Se algo em um relatório preocupar você, procure a pessoa do jeito que você costuma fazer.",
} satisfies Messages["shell"];
