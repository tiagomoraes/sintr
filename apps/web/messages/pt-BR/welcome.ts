import type { Messages } from "../types";

const DAYS = ["Domingos", "Segundas", "Terças", "Quartas", "Quintas", "Sextas", "Sábados"] as const;

/** "às terças", "aos sábados": o artigo segue o gênero do dia. */
function on(day: string): string {
  return `${/^(domingo|sábado)/iu.test(day) ? "aos" : "às"} ${day.toLowerCase()}`;
}

/** As boas-vindas depois de criar o diário: uma pergunta por tela, e cada uma pode esperar. */
export const welcome = {
  title: "Boas-vindas",
  back: "Voltar",
  skip: "Pular",
  next: "Continuar",
  progress: (step: number, of: number) => `Passo ${step} de ${of}`,
  start: {
    heading: "Este é o seu diário para a semana entre as sessões.",
    body: "Quando algo acontecer, conte aqui, por voz ou por escrito. O sintr guarda nas suas próprias palavras e, antes de cada sessão, sua semana está esperando em uma página, para você ler primeiro e compartilhar só se quiser.",
    promise: "Três perguntas curtas e pronto. Qualquer uma delas pode esperar.",
    begin: "Começar",
    later: "Agora não, me leve ao meu diário",
  },
  name: {
    heading: "Como devo chamar você?",
    body: "Só para cumprimentar você aqui. Isso nunca é enviado ao assistente e nunca aparece em um relatório.",
    label: "Seu nome, ou o nome que você prefere",
    placeholder: "Seu nome",
    tooLong: "Use no máximo 80 caracteres.",
  },
  invite: {
    heading: (who: string) => `${who} convidou você para compartilhar seus relatórios.`,
    body: "Você pode criar o vínculo agora, como parte da configuração, ou depois, em Compartilhar.",
    accept: "Aceitar e criar o vínculo",
    accepting: "Criando o vínculo",
    later: "Agora não",
    linked: (who: string) =>
      `Você e ${who} agora têm um vínculo. O consultório vê só os relatórios que você aprovar e compartilhar.`,
    problems: {
      busy: "Tentativas demais daqui. Espere alguns minutos e tente de novo.",
      consent: "Marque a caixa para dar seu consentimento, ou deixe para depois.",
      changed:
        "O consultório mudou o nome ou os dados desde que esta página abriu. Recarregue a página e leia de novo.",
      gone: "Este convite não funciona mais: ele pode ter expirado, sido cancelado ou já ter sido usado. Você pode pedir um novo depois.",
      tooLong: "Use no máximo 80 caracteres para o seu nome.",
      noSeat: "Este consultório não tem uma vaga livre agora. Avise seu terapeuta; nada foi compartilhado.",
      own: "Este é o convite do seu próprio consultório.",
    },
  },
  therapist: {
    heading: "Quem é o seu terapeuta?",
    body: "Só o nome, para os seus relatórios saberem para quem são. Nada vai para essa pessoa sem o seu sim para aquele relatório.",
    label: "O nome do seu terapeuta",
    placeholder: "O nome",
    none: "Não tenho no momento",
    tooLong: "Use no máximo 200 caracteres.",
  },
  session: {
    heading: (therapist: string | null) =>
      therapist ? `Quando é a sua sessão com ${therapist}?` : "Quando são as suas sessões?",
    body: "Uma hora antes de cada sessão, seu relatório fica pronto para você ler primeiro.",
    day: "Dia",
    time: "Horário",
    zone: (zone: string) => `No horário de ${zone}.`,
    changeZone: "Mudar",
    zoneLabel: "Seu fuso horário",
    varies: "Muda de uma semana para outra",
    needBoth: "Escolha o dia e o horário, ou deixe para depois.",
    badTime: "Escreva o horário em horas e minutos, como 18:00.",
    days: DAYS,
    short: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
  },
  ready: {
    heading: (name: string | null) => (name ? `Tudo pronto, ${name}.` : "Tudo pronto."),
    sessions: (day: string, time: string) =>
      `Suas sessões são ${on(day)}, às ${time}. Uma hora antes de cada uma, sua semana vai estar esperando em uma página.`,
    noSessions:
      "Quando quiser a sua semana em uma página, você pode prepará-la em Relatórios. Se você disser em Terapia quando são as suas sessões, ela é preparada antes de cada uma.",
    therapist: (who: string) =>
      `Seus relatórios são para ${who} e só vão para essa pessoa quando você quiser.`,
    next: "Sempre que algo acontecer, me conta, por voz ou por escrito.",
    go: "Ir para o meu diário",
  },
  problem: "Não foi possível salvar agora. Tente de novo daqui a pouco.",
  again: {
    heading: "Aqui estão as boas-vindas de novo.",
    body: "O que você me contou antes já vem preenchido. Mude o que quiser e pule o resto: pular mantém a sua resposta como está, e nada do que você escreveu é apagado.",
    later: "Agora não, voltar para Ajustes",
  },
} satisfies Messages["welcome"];
