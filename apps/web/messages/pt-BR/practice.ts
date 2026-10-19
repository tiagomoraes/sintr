import type { Messages } from "../types";

/** O consultório: o lado do profissional, seus pacientes, seus convites e os relatórios compartilhados. */
export const practice = {
  title: "Seu consultório",
  open: {
    lede: "Para terapeutas: receba os relatórios que seus pacientes escolhem compartilhar com você, em um lugar só, tranquilo.",
    promises: [
      "Seus pacientes decidem o que você vê: os relatórios que eles aprovam e compartilham com você, nada além disso.",
      "Cada relatório é lido como a pessoa aprovou. Sem pontuações, e nada somado entre pacientes.",
      "Qualquer um de vocês pode encerrar um vínculo a qualquer momento, e ele termina na hora dos dois lados.",
    ],
    submit: "Abrir meu consultório",
    diary:
      "Seu próprio diário continua como está. Abrir um consultório adiciona este painel; nada mais muda.",
  },
  patient: (number: number) => `Paciente ${number}`,
  aPatient: "Um paciente",
  seats: {
    active: (count: number) => `${count} ${count === 1 ? "paciente ativo" : "pacientes ativos"}.`,
    unlimited: "Vagas ilimitadas.",
    inUse: (used: number, seats: number, held: number) =>
      `${used} de ${seats} ${seats === 1 ? "vaga" : "vagas"} em uso${held ? `, ${held} aguardando aceite` : ""}.`,
  },
  plans: { selfHosted: "Auto-hospedado", free: "Gratuito", practice: "Consultório" },
  notices: {
    active: (who: string) => `${who} se vinculou ao seu consultório.`,
    declined: "Uma pessoa que você aceitou escolheu não se vincular. Nada foi compartilhado.",
    ended: "Um paciente encerrou o vínculo com seu consultório. Os relatórios dele não estão mais aqui.",
    shared: (who: string) => `${who} compartilhou um relatório com você.`,
    other: (who: string) => `${who} atualizou o vínculo.`,
  },
  gone: "Esse relatório não está mais aqui: o vínculo pelo qual ele chegou foi encerrado.",
  code: { label: "Um código que um paciente deu a você", button: "Abrir" },
  report: {
    all: "Todos os relatórios",
    shared: (day: string) =>
      `Compartilhado com você em ${day}. Este é o relatório exatamente como a pessoa aprovou.`,
    pdf: "Baixar o PDF",
    close: "Fechar",
  },
  reports: {
    title: "Relatórios",
    new: "Novo",
    shared: (day: string) => `Compartilhado em ${day}`,
    none: "Nenhum relatório ainda. Quando um paciente aprovar um relatório e compartilhar com você, ele aparece aqui.",
  },
  patients: {
    title: "Pacientes",
    waiting: "Esperando a confirmação da pessoa.",
    since: (day: string) => `Vínculo desde ${day}.`,
    last: (day: string) => `Último relatório em ${day}.`,
    none: "Nenhum paciente ainda. Convide um, ou abra o código que um paciente deu a você.",
    withdraw: "Desistir",
    withdrawLabel: (who: string) => `Desistir do vínculo com ${who}`,
    withdrawConfirm: "Sim, desistir",
    withdrawExplanation: (who: string) => `O vínculo com ${who} não vai começar. A pessoa é avisada.`,
    disconnect: "Desvincular",
    disconnectLabel: (who: string) => `Desvincular ${who}`,
    disconnectConfirm: "Sim, desvincular",
    disconnectExplanation: (who: string) =>
      `${who} para de compartilhar com seu consultório na hora, e os relatórios saem deste painel. A pessoa é avisada.`,
    keep: "Manter o vínculo",
    ending: "Encerrando o vínculo",
  },
  invites: {
    title: "Convites esperando",
    until: (day: string) => `Vale até ${day}.`,
    copy: (code: string) => `o link de ${code}`,
    cancel: "Cancelar",
    cancelLabel: (code: string) => `Cancelar o convite ${code}`,
  },
  form: {
    name: "Seu nome, como as pessoas que você atende conhecem",
    nameHint: "Aparece para as pessoas que você convida, junto com o que vem abaixo.",
    place: "Consultório ou clínica",
    optional: "Opcional.",
    registration: "Registro que você quer mostrar",
    registrationHint: "Opcional, como CRP 06/123456.",
    notify: "Me avisar por e-mail quando chegar um relatório",
    saved: "Salvo.",
  },
  problems: {
    name: "Escreva seu nome como as pessoas que você atende conhecem.",
    tooLong: (max: number) => `Use no máximo ${max} caracteres.`,
    check: "Confira os campos.",
    noSeat:
      "Todas as vagas do seu consultório estão em uso. Cancele um convite de que não precisa mais, ou peça mais vagas.",
    invites: "Você já tem muitos convites esperando. Cancele antes os que não precisa mais.",
  },
  details: {
    title: "Dados do consultório",
    lede: "O que as pessoas que você convida veem, e como você fica sabendo de novos relatórios.",
    save: "Salvar",
    emailOff: "O e-mail não está configurado neste sintr. Novos relatórios aparecem no seu consultório.",
    emailTo: (email: string) =>
      `Para ${email}: um link e uma contagem, nunca quem compartilhou nem o que diz.`,
    emailVerify: "Um link e uma contagem, nunca quem nem o quê. Confirme seu e-mail em Ajustes antes.",
    plan: {
      title: "Plano e vagas",
      unlimited: "Vagas ilimitadas.",
      seats: (seats: number) =>
        `${seats} ${seats === 1 ? "vaga" : "vagas"}: cada paciente vinculado, ou convite esperando, usa uma.`,
      subscription: "Pago pelo Stripe.",
      grant: "Concedido ao seu consultório por quem mantém este sintr.",
      config: "Definido pela configuração deste sintr; quem o mantém pode mudar.",
      change: "Mudar as vagas",
      more: "Mais vagas",
    },
  },
  invite: {
    title: "Convidar um paciente",
    lede: "Dê a um paciente um código ou um link. Quando a pessoa aceitar, os relatórios que ela escolher compartilhar com você chegam ao seu consultório.",
    steps: [
      { title: "Crie o convite", text: "Um código e um link. Vale por sete dias, uma vez só." },
      {
        title: "Envie",
        text: "Leia o código para a pessoa numa sessão, ou envie o link do jeito que vocês costumam conversar.",
      },
      {
        title: "A pessoa aceita",
        text: "Ela vê primeiro seu nome e seus dados, dá o consentimento e escolhe como os relatórios chegam a você.",
      },
    ],
    footer:
      "O que você vai ver: os relatórios que a pessoa aprovar e compartilhar, como ela aprovou. Nunca os registros, check-ins, conversas ou rascunhos dela. Qualquer um de vocês pode encerrar o vínculo a qualquer momento.",
    note: "Para quem é",
    noteHint: "Opcional, e só para você: a pessoa nunca vê.",
    make: "Criar um convite",
    making: "Criando o convite",
    made: "Leia o código para a pessoa numa sessão, ou envie o link do jeito que vocês costumam conversar. Ele ocupa uma vaga até ser aceito, cancelado ou expirar.",
    another: "Criar outro convite",
  },
} satisfies Messages["practice"];
