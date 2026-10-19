import type { Messages } from "../types";

/** Os dias, para quem lê a tela sem vê-la. */
const DIAS = [
  "Domingos",
  "Segundas-feiras",
  "Terças-feiras",
  "Quartas-feiras",
  "Quintas-feiras",
  "Sextas-feiras",
  "Sábados",
] as const;
/** "Às terças", "aos sábados": o dia das sessões numa frase. */
const NOS_DIAS = [
  "Aos domingos",
  "Às segundas",
  "Às terças",
  "Às quartas",
  "Às quintas",
  "Às sextas",
  "Aos sábados",
] as const;

/** "na terça-feira, 20 de outubro às 17:40", "no sábado, 24 de outubro às 17:40": o artigo do dia do Intl. */
function naData(moment: string): string {
  return /^(sábado|domingo)/u.test(moment) ? "no" : "na";
}

/** Terapia: quem é o seu terapeuta, quando são as sessões, o que acontece com o relatório. Dito em frases primeiro. */
export const therapy = {
  title: "Sua terapia",
  lede: "Quem é o seu terapeuta, quando vocês se encontram e o que acontece com o relatório preparado antes de cada sessão.",
  next: (prepared: string, session: string) => [
    `O próximo relatório será preparado ${naData(prepared)} `,
    prepared,
    `, para a sessão de ${session}.`,
  ],
  noNext:
    "Sem um dia e um horário de sessão, nenhum relatório é preparado sozinho. Você ainda pode preparar um em Relatórios quando quiser.",
  change: "Mudar",
  sessions: {
    title: "Suas sessões",
    summary: (day: number | null, time: string | null, zone: string) =>
      day !== null && time ? `${NOS_DIAS[day]}, às ${time}, no horário de ${zone}.` : "Ainda sem dia fixo.",
    day: "Dia",
    noDay: "Sem dia fixo",
    days: DIAS,
    short: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
    time: "Horário",
    zone: "Seu fuso horário",
    zoneHint: "O dia e o horário das suas sessões seguem esse fuso.",
    moved: "Uma sessão mudou de data?",
    movedHint:
      "Informe a nova data e o horário. Ela ocupa o lugar da sessão regular mais próxima, só dessa vez, e o relatório é preparado para ela.",
    movedBack: "A sessão voltou ao dia de sempre",
  },
  therapist: {
    title: "Seu terapeuta",
    summary: (name: string | null, email: string | null, sends: boolean) =>
      [
        name ? (email ? `${name}, em ${email}.` : `${name}.`) : "Ainda sem nome.",
        sends
          ? "Os relatórios só são enviados com o seu sim."
          : "Os relatórios ficam com você, para baixar e levar à sessão.",
      ].join(" "),
    name: "Nome",
    email: "E-mail",
    emailHint:
      "Guardado com criptografia, como o seu diário. Usado só para enviar um relatório que você aprovou.",
    delivery: "O que acontece com o relatório",
    send: "Enviar para o meu terapeuta",
    keep: "Guardar comigo",
    sendHint:
      "Quando você aprovar um relatório, pode enviar o PDF para este endereço. Cada envio pede o seu sim.",
    sendOff:
      "O e-mail ainda não está configurado neste sintr, então você pode baixar o PDF e compartilhar por conta própria.",
    keepHint: "O PDF fica com você: baixe para levar à sessão ou compartilhe do seu jeito.",
  },
  report: {
    title: "O relatório antes de cada sessão",
    summary: (lead: string, language: string, name: string | null) =>
      `Preparado ${lead.toLowerCase()} de cada sessão, em ${language}${name ? `, com o seu nome, ${name}` : ""}.`,
    lead: "Quando preparar",
    leads: {
      30: "30 minutos antes",
      60: "1 hora antes",
      120: "2 horas antes",
      180: "3 horas antes",
      360: "6 horas antes",
      720: "12 horas antes",
      1440: "Um dia antes",
      2880: "Dois dias antes",
    },
    leadHint: "Ele cobre os dias desde o último relatório até esse momento, para chegar atualizado à sessão.",
    language: "O idioma do relatório",
    languageFollow: (name: string) => `O idioma em que você lê o sintr (${name})`,
    languageHint:
      "Os títulos e as palavras do assistente seguem esse idioma. As suas palavras ficam exatamente como você escreveu.",
    name: "Seu nome, como o relatório mostra",
    nameHint: "Opcional. Sem ele, o relatório diz “a semana, nas próprias palavras”.",
    notice: "Me avisar por e-mail quando um relatório estiver pronto para ler",
    noticeOff:
      "O e-mail não está configurado neste sintr. Você verá o relatório aqui quando ele estiver pronto.",
    noticeOn: "Só um link, nunca as palavras do relatório.",
    noticeVerify: "Só um link, nunca as palavras do relatório. Confirme antes o seu e-mail em Ajustes.",
  },
  approval:
    "Todo relatório espera a sua aprovação. Nada é enviado a ninguém sem o seu sim para aquele relatório, e isso não pode ser desligado.",
  save: "Salvar",
  saved: "Salvo.",
  notes: {
    title: "Objetivos, temas e o que levar para a sessão",
    kinds: {
      session: "Nota de sessão",
      goal: "Objetivo",
      theme: "Tema",
      task: "Tarefa",
      to_bring: "Para levar à sessão",
    },
  },
  problems: {
    timezone: "Escolha um fuso horário da lista.",
    language: "Escolha o idioma do relatório.",
    sessionDay: "Escolha um dia da semana.",
    sessionTime: "Escreva o horário em horas e minutos, como 18:00.",
    dayAndTime: "Informe o dia e o horário das sessões, ou nenhum dos dois.",
    lead: "Escolha quando preparar o relatório.",
    moved: "Informe a data e o horário dessa sessão.",
    therapistEmail: "Confira o endereço: um e-mail só, como nome@exemplo.com.",
    delivery: "Escolha o que acontece com o relatório.",
    sendNeedsEmail: "Para enviar o relatório, o sintr precisa do e-mail do seu terapeuta.",
    form: "Parte disso não pôde ser guardada como está. Confira os campos.",
  },
} satisfies Messages["therapy"];
