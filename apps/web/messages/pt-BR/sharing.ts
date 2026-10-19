import type { Messages } from "../types";

/** Compartilhar com o terapeuta: convites nos dois sentidos, o vínculo, o que ele vê, como parar. */
export const sharing = {
  title: "Compartilhar",
  heading: "Quem pode ver o que você escreve",
  lede: "Seu diário é só seu. Você pode dar ao seu terapeuta acesso aos relatórios que aprovar, e retirar esse acesso a qualquer momento.",
  scope: "Seu terapeuta pode ler os relatórios que você aprovar; nada além disso.",
  never: "Nunca seus registros, check-ins, conversas ou rascunhos.",
  eachReport:
    "Você escolhe a cada relatório, a não ser que decida de outro jeito. Nada é compartilhado antes de você aprovar.",
  stopAnyTime: "Você pode parar a qualquer momento, e o terapeuta perde o acesso na mesma hora.",
  modes: {
    ask: {
      label: "Perguntar a cada vez",
      sentence: "Cada vez que você aprovar um relatório, escolhe se ele vai para o terapeuta.",
    },
    auto: {
      label: "Enviar o que eu aprovar",
      sentence: "Todo relatório que você aprovar vai para o terapeuta assim que for aprovado.",
    },
  },
  mode: {
    legend: "Quando você aprovar um relatório",
    later: "Você pode mudar isso depois.",
    save: "Salvar",
  },
  consent: {
    before: "Concordo em compartilhar os relatórios que eu aprovar com",
    afterHere: ", como descrito aqui. Posso parar a qualquer momento.",
    afterAbove: ", como descrito acima. Posso parar a qualquer momento.",
  },
  seen: {
    nobody: "Agora, ninguém pode ver nada do que você escreve.",
    one: (who: string) => `${who} pode ler os relatórios que você compartilhar. Ninguém mais pode ver nada.`,
    many: (count: number) =>
      `${count} terapeutas podem ler os relatórios que você compartilhar com cada um. Ninguém mais pode ver nada.`,
  },
  give: {
    title: "Dê acesso ao seu terapeuta",
    code: {
      title: "Você recebeu um código",
      text: "Seu terapeuta tem um consultório no sintr e enviou um código ou um link para você.",
      label: "O código",
      button: "Continuar",
    },
    invite:
      "O sintr cria um link para você enviar. O terapeuta aceita pelo consultório, e depois você confirma.",
    waiting: "Convites esperando seu terapeuta",
    worksUntil: (day: string) => `, vale até ${day}`,
    cancel: "Cancelar",
    cancelLabel: (code: string) => `Cancelar o convite ${code}`,
  },
  how: {
    title: "Como funciona o compartilhamento",
    items: [
      {
        term: "Só relatórios aprovados",
        text: "Um relatório só chega ao seu terapeuta depois que você aprova. Rascunhos, registros, check-ins e conversas nunca chegam.",
      },
      {
        term: "Lido no sintr",
        text: "O terapeuta lê o relatório no consultório, no sintr, e pode baixar o PDF. Um PDF baixado fica com o terapeuta, como um e-mail ficaria.",
      },
      {
        term: "Um passo para parar",
        text: "Pare de compartilhar e o terapeuta perde na hora o acesso a tudo o que você compartilhou pelo sintr.",
      },
      {
        term: "Você fica sabendo",
        text: "Cada relatório compartilhado mostra quando o terapeuta abriu pela primeira vez.",
      },
    ],
  },
  invite: {
    title: "Convidar seu terapeuta",
    lede: "Dê ao seu terapeuta um jeito de ler os relatórios que você aprovar, no sintr, no lugar do PDF por e-mail ou junto com ele.",
    steps: [
      { title: "Envie o link", text: "Ou leia o código para o terapeuta. Vale por sete dias, uma vez só." },
      {
        title: "O terapeuta aceita",
        text: "Pelo consultório no sintr. Se ainda não tiver um, o link ajuda a abrir.",
      },
      {
        title: "Você confirma",
        text: "Você vê o nome e os dados do terapeuta, e diz sim. Só então dá para compartilhar.",
      },
    ],
    name: "Como o terapeuta vai ver você",
    nameHint: "Opcional. O nome pelo qual seu terapeuta conhece você; dá para mudar depois.",
    make: "Criar um convite para meu terapeuta",
    making: "Criando o convite",
    made: "Envie para seu terapeuta do jeito que vocês costumam conversar. Quando o terapeuta aceitar no consultório, no sintr, você vai ver isso em Compartilhar e confirmar que é a pessoa certa. Nada é compartilhado antes disso.",
  },
  panel: {
    forNote: (note: string) => `Para ${note}`,
    code: "O código",
    link: "Ou o link",
    copyCode: "o código",
    copyLink: "o link",
    until: { before: "Vale até", after: ", uma vez só." },
  },
  pending: {
    label: (who: string) => `${who} espera sua confirmação`,
    title: (who: string) => `${who} aceitou seu convite`,
    body: "Confirme que é seu terapeuta, e o vínculo começa. Até lá, nada pode ser compartilhado.",
    each: "Você escolhe a cada relatório, a não ser que decida de outro jeito. Você pode parar a qualquer momento.",
    form: "Confirmar o vínculo",
    confirm: "Confirmar, é meu terapeuta",
    confirming: "Confirmando",
    decline: "Não é meu terapeuta",
    declining: "Recusando",
  },
  active: {
    label: (who: string) => `Compartilhando com ${who}`,
    since: (day: string) => `Vínculo desde ${day}.`,
    shared: {
      label: (who: string) => `Relatórios compartilhados com ${who}`,
      title: "O que você compartilhou",
      on: (day: string) => `Compartilhado em ${day}.`,
      opened: (day: string) => `O terapeuta abriu em ${day}.`,
      notOpened: "Ainda não foi aberto.",
      none: "Nada ainda. Quando você aprovar um relatório, pode compartilhar pela página dele.",
    },
    stop: {
      label: "Parar de compartilhar",
      aria: (who: string) => `Parar de compartilhar com ${who}`,
      confirm: "Sim, parar de compartilhar",
      keep: "Continuar compartilhando",
      pending: "Parando",
      explanation: (who: string) =>
        `${who} perde na hora o acesso a todos os relatórios que você compartilhou aqui. Um PDF que já foi baixado fica com o terapeuta, como um e-mail ficaria.`,
    },
  },
  name: {
    seenAs: "Na lista do terapeuta, você aparece como",
    afterName: ".",
    afterNeutral: ", um rótulo neutro.",
    change: "Mudar",
    reportName: (name: string) =>
      `Seus relatórios mostram o nome que você definiu em Terapia, ${name}, assim como o PDF.`,
    label: "Como o terapeuta vê você",
    save: "Salvar",
    cancel: "Cancelar",
    empty: (neutral: string) => `Deixe vazio e o terapeuta vê ${neutral}.`,
  },
  notices: {
    label: "O que mudou",
    new: "Novo.",
    someone: "O consultório do seu terapeuta",
    pending: (who: string) => `${who} aceitou seu convite. Confirme para começar a compartilhar.`,
    ended: (who: string) => `${who} encerrou o vínculo e não vê mais seus relatórios.`,
    declined: (who: string) => `${who} desistiu do seu convite. Nada foi compartilhado.`,
    other: (who: string) => `${who} atualizou o vínculo.`,
  },
  problems: {
    code: "Confira o código: 12 letras e números, como K7QD-2MXP-9F4R.",
    invites: "Você já tem cinco convites esperando. Cancele um de que não precisa mais e crie outro.",
    consent: "Marque a caixa para dar seu consentimento, ou recuse.",
    notWaiting: "Este vínculo não está mais esperando. Recarregue a página.",
    changed:
      "O consultório mudou o nome ou os dados desde que esta página abriu. Recarregue a página e leia de novo.",
    nameTooLong: "Use no máximo 80 caracteres.",
  },
  join: {
    title: "Um convite",
    diary: "Seu diário",
    signIn: "Entrar",
    invalid: {
      title: "Este convite não funciona mais.",
      body: "Ele pode ter expirado, sido cancelado ou já usado. Peça um novo a quem enviou.",
    },
    busy: {
      title: "Muitas tentativas a partir daqui.",
      body: "Espere alguns minutos e abra o link de novo.",
    },
    backToDiary: "Voltar para o seu diário",
    whatIs: "O que é o sintr?",
    fromPractice: {
      heading: "convida você a compartilhar seus relatórios.",
      signedOut: (until: string) =>
        `O sintr é um diário privado para a semana entre as sessões. Para aceitar, crie o seu ou entre. O convite vale até ${until}.`,
      create: "Criar seu diário",
      haveOne: "Já tenho um",
      own: "Este é o convite do seu próprio consultório. Envie para a pessoa que você quer convidar.",
      back: "Voltar para o seu consultório",
      notNow: (until: string) => `Agora não? Saia desta página; o convite vale até ${until}.`,
    },
    fromPerson: {
      someone: "Uma pessoa que você atende",
      heading: "quer que você receba os relatórios que aprovar.",
      accept:
        "Quando você aceitar, a pessoa confirma do lado dela que é você. Depois, cada relatório que ela aprovar e escolher compartilhar aparece no seu consultório no sintr.",
      only: "Você vê os relatórios que a pessoa compartilhar, e nada mais. Ela pode parar a qualquer momento.",
      signedOut: (until: string) =>
        `Entre para aceitar pelo seu consultório, ou crie uma conta e abra um consultório. O convite vale até ${until}.`,
      create: "Criar uma conta",
      haveOne: "Já tenho uma",
      own: "Este é o seu próprio convite. Envie para o seu terapeuta.",
      back: "Voltar para Compartilhar",
    },
    asPerson: {
      form: "Aceitar o convite",
      name: "Como o terapeuta vai ver você",
      nameHint:
        "Opcional. O nome pelo qual o terapeuta conhece você, na lista do consultório. Se ficar vazio, aparece um rótulo neutro.",
      reportName: (name: string) =>
        `Os relatórios em si mostram o nome que você definiu em Terapia, ${name}.`,
      accept: "Aceitar e vincular",
      accepting: "Vinculando",
    },
    asPractice: {
      form: "Aceitar pelo seu consultório",
      forPractice: { before: "Você aceita em nome de", after: "." },
      open: "Para aceitar, abra primeiro seu consultório no sintr. É um passo só.",
      accept: "Aceitar pelo meu consultório",
      openAndAccept: "Abrir meu consultório e aceitar",
      accepting: "Aceitando",
    },
    problems: {
      gone: "Este convite não funciona mais: pode ter expirado, sido cancelado ou já usado. Peça um novo.",
      busy: "Muitas tentativas a partir daqui. Espere alguns minutos e tente de novo.",
      consent: "Marque a caixa para dar seu consentimento, ou deixe para depois.",
      nameTooLong: "Use no máximo 80 caracteres no seu nome.",
      linkedPractice: "Você já tem vínculo com este consultório.",
      ownPractice: "Este é o convite do seu próprio consultório.",
      noSeat: "Este consultório não tem vaga livre agora. Avise seu terapeuta; nada foi compartilhado.",
      tooLong: "Algum campo está longo demais. Encurte e tente de novo.",
      linkedPerson: "Você já tem vínculo com esta pessoa.",
      ownInvite: "Este é o seu próprio convite.",
      noSeatOwn: "Seu consultório não tem vaga livre. Libere uma, ou peça mais, e abra este link de novo.",
    },
  },
} satisfies Messages["sharing"];
