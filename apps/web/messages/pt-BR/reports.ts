import type { Messages } from "../types";

/** "na" ou "no": a preposição antes de um momento escrito pelo Intl ("terça-feira, 20 de outubro às 18:00"). */
function na(moment: string): string {
  return /^(sábado|domingo)/u.test(moment) ? "no" : "na";
}

/** Relatórios: a lista, um relatório e a sua página, mudar, aprovar, enviar e compartilhar. */
export const reports = {
  title: "Relatórios",
  lede: "Uma página curta sobre os dias desde a sua última sessão, preparada antes da próxima. Você lê primeiro; ela só vai para o seu terapeuta se você aprovar esse relatório.",
  titles: {
    session: (when: string) => `Para a sessão de ${when}`,
    week: (day: string) => `Semana de ${day}`,
  },
  status: {
    draft: "Rascunho, esperando por você",
    reviewed: "Aprovado por você, não enviado",
    sent: "Enviado com a sua aprovação",
  },
  and: (others: string, last: string) => `${others} e ${last}`,
  sectionNames: {
    week: "como foi a semana",
    session: "os temas para a sessão",
    mood: "humor, energia e sono",
    moments: "os momentos",
    patterns: "o que se repetiu",
    helped: "o que ajudou",
  },
  list: {
    next: (prepared: string, session: string): [string, string] => [
      `O próximo é preparado ${na(prepared)} `,
      `, para a sua sessão de ${session}.`,
    ],
    noSession:
      "Nenhuma sessão está no seu calendário, então os relatórios só são preparados quando você pede.",
    setSessions: "Adicionar as suas sessões",
    used: (next: string) =>
      `Os relatórios deste mês escritos pelo assistente já foram usados, então até ${next} o sintr os prepara a partir das suas próprias palavras: os momentos, as suas anotações e os seus temas.`,
    yourPlan: "Seu plano",
    prepareNow: "Preparar agora",
    prepareWeek: "Preparar o relatório desta semana",
    empty: "Nenhum relatório ainda.",
    emptyBody:
      "Cada relatório cobre os dias desde o anterior, nas suas próprias palavras, com os números dos seus check-ins. Nada nele é uma pontuação, e tudo bem ter semanas tranquilas.",
    range: (start: string, end: string) => `${start} a ${end}`,
    sent: (to: string | null, day: string) => `Enviado para ${to ?? "o seu terapeuta"} em ${day}`,
    shared: (day: string) => `Compartilhado em ${day}`,
  },
  prepare: {
    busy: "Preparando o relatório",
    wait: "Lendo os dias desde o último relatório. Pode levar um minuto quando o seu assistente escreve.",
    failed: "Não foi possível preparar o relatório agora. Tente de novo daqui a pouco.",
  },
  report: {
    title: "Relatório",
    all: "Todos os relatórios",
    heading: { session: "O relatório de", week: "O relatório da" },
    week: (label: string) => `semana ${label}`,
    sent: (to: string | null, when: string) =>
      `Enviado com a sua aprovação para ${to ?? "o seu terapeuta"} ${na(when)} ${when}.`,
    shared: (when: string) => `Aprovado por você e compartilhado ${na(when)} ${when}.`,
    covers: (start: string, end: string) => `Cobre de ${start} até ${end}.`,
    seePlan: "Ver o seu plano",
    problems: "Vale olhar antes de aprovar",
    sharedWith: (name: string, day: string, opened: string | null) =>
      `Compartilhado com ${name} em ${day}. ${opened ? `Aberto em ${opened}.` : "Ainda não foi aberto."}`,
    pdf: {
      draftTitle: "O PDF, como rascunho",
      title: "O PDF que o seu terapeuta recebe",
      open: "Abrir o PDF",
      download: "Baixar",
      draftNote: "Marcado como rascunho na primeira página até você aprovar.",
      note: "Gerado quando você aprovou. Este é exatamente o arquivo que é enviado ou compartilhado.",
      preview: "Prévia do relatório em PDF",
    },
  },
  author: {
    notConfigured:
      "Não há um assistente configurado, então o sintr preparou o que consegue sozinho: os momentos, as suas anotações e os seus temas, nas suas próprias palavras. Como foi a semana e a leitura dos números ficam para você escrever.",
    limitReached:
      "Os relatórios deste mês escritos pelo assistente já foram usados no seu plano, então o sintr preparou o que consegue sozinho: os momentos, as suas anotações e os seus temas, nas suas próprias palavras. Como foi a semana fica para você escrever, ou o assistente pode preparar de novo no mês que vem.",
    noReport:
      "O seu assistente respondeu sem escrever o relatório, então o sintr preparou o que consegue sozinho. Você pode escrever o resto ou preparar de novo.",
    none: "O sintr preparou o que consegue sozinho.",
    unreachable:
      "Não foi possível falar com o seu assistente para escrever este rascunho, então o sintr preparou o que consegue sozinho. Você pode escrever o resto ou preparar de novo quando o assistente responder.",
  },
  problems: {
    quoteNotFound: (quoted: string) =>
      `${quoted} não está no seu diário palavra por palavra, então aparece sem o destaque que marca as suas próprias palavras.`,
    statesACause: (quoted: string) =>
      `${quoted} soa como uma causa. O relatório descreve o que aconteceu junto, não o porquê.`,
    clinicalLabel: (quoted: string) =>
      `${quoted} soa como um rótulo clínico. O relatório fica nas suas próprias palavras.`,
    undatedObservation: (quoted: string) => `Uma observação sobre o que se repetiu não tem data: ${quoted}.`,
    momentEntryChanged: (quoted: string) =>
      `O registro ${quoted} mudou depois que este relatório foi preparado. Prepare de novo para incluir a mudança.`,
    momentEntryMissing: (quoted: string) =>
      `O registro ${quoted} não está mais no seu diário. Remova o momento ou prepare o relatório de novo.`,
    noteChanged: (quoted: string) =>
      `Uma anotação de check-in mudou depois que este relatório foi preparado: ${quoted}.`,
    tooManyTopics: "Há mais de seis temas para a sessão; o ideal é de dois a quatro.",
    tooManyMoments: "Há mais de seis momentos; o ideal é de três a cinco.",
    longSummary:
      "O texto de como foi a semana está longo para a primeira página; o ideal é de três a seis linhas.",
  },
  actions: {
    change: "Mudar o texto",
    approve: "Aprovar este relatório",
    approving: "Aprovando",
    approveAndShare: (names: string) => `Aprovar e compartilhar com ${names}`,
    again: "Preparar de novo",
    preparing: "Preparando",
    approveNote: "Aprovar guarda esta versão e gera o PDF final, sem a marca de rascunho.",
    approveShares: (names: string, count: number) =>
      `Você escolheu que o que você aprova vai para ${names}, então aprovar também compartilha o relatório com ${
        count === 1 ? "esse consultório" : "cada um desses consultórios"
      }, e nada além disso.`,
    approveSendsNothing: "Nada é enviado quando você aprova.",
    againReplaces: "Preparar de novo substitui as suas mudanças; o que elas diziam fica guardado abaixo.",
    send: {
      title: "Enviar para o seu terapeuta",
      consent: (therapist: string | null): [string, string] => [
        `Aprovo enviar este relatório, exatamente como no PDF abaixo, para ${therapist ? `${therapist}, ` : ""}`,
        ".",
      ],
      button: "Aprovar e enviar",
      busy: "Enviando",
      note: "Um e-mail enviado não pode ser desfeito. O seu sim fica registrado com a data, o relatório e o endereço.",
    },
    share: {
      title: (name: string) => `Compartilhar com ${name}`,
      consent: ["Aprovo compartilhar este relatório, exatamente como no PDF abaixo, com ", " no sintr."],
      button: (name: string) => `Compartilhar com ${name}`,
      busy: "Compartilhando",
      note: "O consultório lê o relatório no sintr e pode baixar o PDF. O seu sim fica registrado com a data. Você pode parar de compartilhar em Compartilhar; um PDF que o consultório baixou fica com ele.",
    },
    keepWithPractices:
      "Nada vai por e-mail: você escolheu guardar o PDF para você. Você pode baixá-lo abaixo.",
    keep: "Você escolheu guardar os relatórios para você. Baixe o PDF para levar ou compartilhar do seu jeito.",
    noAddress:
      "Para enviar, adicione o e-mail do seu terapeuta em Terapia. Você também pode baixar o PDF e compartilhar por conta própria.",
    emailOff:
      "O e-mail não está configurado neste sintr. Baixe o PDF para levar ou compartilhar por conta própria.",
  },
  failures: {
    pdfUnavailable: "Não foi possível gerar o PDF agora. Nada mudou; tente de novo daqui a pouco.",
    practiceChanged:
      "O consultório mudou o nome ou os dados desde que esta página abriu. Nada foi compartilhado; recarregue a página e leia de novo.",
    sharingChanged:
      "Quem recebe o que você aprova mudou desde que esta página abriu. Nada foi aprovado; recarregue a página e confira de novo.",
    notFound: "Esse vínculo não está mais ativo, então nada foi compartilhado. Recarregue a página.",
    emailOff:
      "O e-mail não está configurado neste sintr, então nada foi enviado. Baixe o PDF para compartilhar por conta própria.",
    sendFailed:
      "Não foi possível enviar o e-mail, então o relatório não está marcado como enviado. Tente de novo daqui a pouco.",
    invalid:
      "O e-mail do seu terapeuta mudou desde que esta página abriu. Leia o endereço de novo antes de enviar.",
    invalidState: "O relatório mudou desde que esta página abriu. Recarregue e confira de novo.",
    invalidMessage: "O e-mail do seu terapeuta não parece certo. Confira em Terapia.",
    notShared: "Aprovado. Não foi possível compartilhar com todos os consultórios agora; compartilhe abaixo.",
    other: "Algo deu errado. Nada foi enviado. Tente de novo daqui a pouco.",
  },
  changes: {
    title: "Mudanças desde que foi preparado",
    lede: "Cada mudança fica guardada com a data e o que o relatório dizia antes.",
    edited: (sections: string | null) =>
      sections === null ? "Você não mudou nenhuma palavra." : `Você mudou ${sections}.`,
    preparedAgain: (sections: string | null) =>
      sections === null ? "Preparado de novo." : `Preparado de novo, mudando ${sections}.`,
    before: "O que dizia antes",
    labels: {
      week: "Como foi a semana",
      session: "Para conversar na sessão",
      mood: "Humor, energia e sono",
      moments: "Os momentos",
      patterns: "O que se repetiu",
      helped: "O que ajudou",
    },
  },
  editor: {
    title: "Mudar o relatório",
    lede: "Reescreva o que quiser, tire o que preferir não compartilhar. As suas palavras nos registros ficam como estão.",
    week: {
      title: "Como foi a semana",
      hint: "De três a seis linhas simples. Aspas duplas marcam as suas próprias palavras: use-as só para palavras do seu diário, como você as escreveu.",
    },
    session: {
      title: "Para conversar na sessão",
      hint: "Os seus temas primeiro, na ordem que você quiser.",
      topic: "Um tema para a sessão",
      suggested: "Sugestão do sintr. Mantenha só se quiser falar sobre isso.",
      remove: "Remover este tema",
      add: "Adicionar um tema",
    },
    mood: {
      title: "Humor, energia e sono",
      hint: "Algumas linhas que leem os números. Os números, o gráfico e a tabela dia a dia são calculados a partir dos seus check-ins.",
      notes: "Nas palavras do dia",
    },
    moments: {
      title: "Momentos que marcaram",
      hint: "O que passou pela cabeça e o que você sentiu vêm de cada registro, palavra por palavra. Para mudar, mude o registro e prepare o relatório de novo.",
      intro: "Como foram escolhidos",
      momentTitle: "Título",
      remove: (title: string) => `Remover o momento ${title}`,
      happened: "O que aconteceu",
      context: "Contexto",
      did: "O que fez",
      thoughts: "O que passou pela cabeça, do registro",
      felt: "O que sentiu, do registro:",
    },
    patterns: {
      title: "O que se repetiu",
      hint: "Cada observação com as suas datas. O que aconteceu junto, nunca o porquê.",
      when: "Quando",
      dates: "Datas",
      remove: "Remover esta observação",
      add: "Adicionar uma observação",
    },
    helped: {
      title: "O que ajudou",
      hint: "Como você registrou, com a data.",
      remove: "Remover este item",
      add: "Adicionar algo que ajudou",
    },
    remove: "Remover",
    save: "Salvar as mudanças",
    saving: "Salvando",
    cancel: "Cancelar",
    note: "O relatório volta a ser um rascunho, para ler e aprovar do jeito que ficou. O que ele dizia antes fica guardado com a data.",
    sent: "Este relatório foi enviado, então não pode mais mudar.",
    failed: "Parte do relatório não pôde ser salva como está. Confira os campos e tente de novo.",
  },
  paper: {
    label: "O relatório",
    unverified: "Não está no diário palavra por palavra",
    to: "para",
  },
} satisfies Messages["reports"];
