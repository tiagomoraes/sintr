import type { Messages } from "../types";

/** Os dias, para quem lê a tela sem vê-la. */
const DIAS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const;
/** "Toda terça", "todo sábado": o ritmo semanal numa frase. */
const TODO = [
  "Todo domingo",
  "Toda segunda",
  "Toda terça",
  "Toda quarta",
  "Toda quinta",
  "Toda sexta",
  "Todo sábado",
] as const;
/** "na terça", "no sábado". */
const NO_DIA = [
  "no domingo",
  "na segunda",
  "na terça",
  "na quarta",
  "na quinta",
  "na sexta",
  "no sábado",
] as const;
/** "às terças", "aos sábados". */
const NOS_DIAS = [
  "aos domingos",
  "às segundas",
  "às terças",
  "às quartas",
  "às quintas",
  "às sextas",
  "aos sábados",
] as const;

/** "às terças e às quintas", "às segundas, às quartas e às sextas", com maiúscula quando abre a frase. */
function nosDias(days: readonly number[], abre = false): string {
  const partes = days.map((day) => NOS_DIAS[day] ?? "");
  const lista =
    partes.length <= 1 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
  return abre ? lista.charAt(0).toUpperCase() + lista.slice(1) : lista;
}

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
    "Sem uma sessão no seu calendário, nenhum relatório é preparado sozinho. Você ainda pode preparar um em Relatórios quando quiser.",
  change: "Mudar",
  calendar: {
    title: "Suas sessões",
    summary: (ritmos: readonly string[]) =>
      ritmos.length === 0 ? "Nenhuma no seu calendário ainda." : ritmos.map((ritmo) => `${ritmo}.`).join(" "),
    rhythm: {
      weekly: (day: number, time: string) => `${TODO[day]}, às ${time}`,
      fortnightly: (day: number, time: string) => `A cada duas semanas, ${NO_DIA[day]}, às ${time}`,
      every_15_days: (time: string) => `A cada 15 dias, às ${time}`,
      weekdays: (days: readonly number[], time: string) => `${nosDias(days, true)}, às ${time}`,
      once: (date: string, time: string) => `Uma vez, ${naData(date)} ${date}, às ${time}`,
    },
    caption: {
      weekly: "Toda semana",
      fortnightly: "A cada duas semanas",
      every_15_days: "A cada 15 dias",
      weekdays: (days: readonly number[]) => `Toda semana, ${nosDias(days)}`,
      once: "Não se repete",
      moved: (from: string) => `Remarcada de ${from}`,
      cancelled: "Cancelada",
      passed: "Já passou",
      next: "A próxima sessão",
    },
    add: "Adicionar uma sessão",
    addOn: (day: string) => `Adicionar uma sessão ${naData(day)} ${day}`,
    comingUp: "As próximas",
    noneComing: "Nenhuma sessão por vir. Adicione uma, e o relatório é preparado antes dela.",
    month: {
      grid: (month: string) => `Suas sessões em ${month}`,
      previous: "Mês anterior",
      next: "Próximo mês",
      today: "Hoje",
    },
    day: {
      empty: "Nenhuma sessão neste dia.",
      sessions: (count: number) => (count === 1 ? "1 sessão" : `${count} sessões`),
    },
    zone: (zone: string) => `Os horários seguem o fuso de ${zone}.`,
    changeZone: "Mudar o fuso horário",
    zoneLabel: "Seu fuso horário",
    zoneHint:
      "Cada sessão mantém o seu dia e horário, lidos nesse fuso, e o mesmo vale para a hora em que cada relatório é preparado.",
    saveZone: "Salvar o fuso horário",
    session: {
      report: (moment: string) => `O relatório dela é preparado ${naData(moment)} ${moment}.`,
      movedFrom: (from: string) => `Remarcada de ${from}. O resto do ritmo continua onde estava.`,
      cancelled: "Cancelada. O resto do ritmo continua.",
      passed: "Esta sessão já passou.",
      change: "Mudar",
      cancel: "Cancelar esta sessão",
      putBack: (where: string) => `Voltar para ${where}`,
      close: "Fechar",
    },
    form: {
      addTitle: "Adicionar uma sessão",
      changeTitle: "Mudar esta sessão",
      day: "Dia",
      time: "Horário",
      repeat: "Repetição",
      repeats: {
        once: "Não se repete",
        weekly: (day: number) => TODO[day] ?? "",
        fortnightly: (day: number) => `A cada duas semanas, ${NO_DIA[day]}`,
        every_15_days: "A cada 15 dias",
        weekdays: "Nos dias da semana que eu escolher",
      },
      weekdays: "Nestes dias",
      short: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
      days: DIAS,
      which: "Quais sessões",
      onlyThis: "Só esta",
      onlyThisHint: "Todas as outras sessões do ritmo ficam onde estão.",
      fromThis: "Esta e as seguintes",
      fromThisHint: "O ritmo muda a partir daqui. As sessões antes dela ficam como estavam.",
      onlyThisRhythm: "Um ritmo novo muda também as sessões depois desta.",
      add: "Adicionar a sessão",
      save: "Salvar",
      back: "Voltar",
    },
    cancel: {
      title: "Cancelar esta sessão",
      onlyThis: "Só esta",
      onlyThisHint: "O resto do ritmo continua.",
      fromThis: "Esta e todas as seguintes",
      fromThisHint: "O ritmo para aqui. As sessões antes dela ficam como estavam.",
      once: "Ela sai do seu calendário.",
      confirm: "Cancelar a sessão",
      keep: "Manter",
    },
    done: {
      added: "Adicionada ao seu calendário.",
      moved: "Remarcada. Só aquela sessão mudou: o resto do ritmo continua onde estava.",
      changed: "Mudou a partir daquela sessão. As sessões antes dela ficam como estavam.",
      cancelled: "Cancelada. Só aquela sessão: o resto do ritmo continua.",
      stopped: "O ritmo para ali. As sessões antes dela ficam como estavam.",
      removed: "Retirada do seu calendário.",
      restored: "De volta ao lugar que o ritmo dá a ela.",
      zone: "Fuso horário salvo.",
    },
    problems: {
      day: "Escolha um dia.",
      time: "Escreva o horário em horas e minutos, como 18:00.",
      repeat: "Escolha como ela se repete.",
      weekdays: "Escolha pelo menos um dia da semana.",
      gone: "Essa sessão não está mais no seu calendário. Aqui está ele como está agora.",
      passed: "Essa sessão já passou, então fica como estava.",
      timezone: "Escolha um fuso horário da lista.",
      form: "Não foi possível guardar isso agora. Tente de novo daqui a pouco.",
    },
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
  unsaved: {
    therapist: "nos dados do seu terapeuta",
    report: "no relatório",
    timezone: "no fuso horário",
  },
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
    language: "Escolha o idioma do relatório.",
    lead: "Escolha quando preparar o relatório.",
    therapistEmail: "Confira o endereço: um e-mail só, como nome@exemplo.com.",
    delivery: "Escolha o que acontece com o relatório.",
    sendNeedsEmail: "Para enviar o relatório, o sintr precisa do e-mail do seu terapeuta.",
    form: "Parte disso não pôde ser guardada como está. Confira os campos.",
  },
} satisfies Messages["therapy"];
