import type { Messages } from "../types";

/** Cada intervalo de cobrança, no singular e no plural. */
const UNITS: Record<string, readonly [string, string]> = {
  day: ["dia", "dias"],
  week: ["semana", "semanas"],
  month: ["mês", "meses"],
  year: ["ano", "anos"],
};

/**
 * A tela do plano: o que o assistente incluído significa neste mês, o uso do
 * mês, a assinatura, as vagas de um consultório; e as palavras do limite numa
 * conversa.
 */
export const plan = {
  title: "Seu plano",
  lede: "Seu diário é o mesmo em qualquer plano: seus registros, check-ins e relatórios nunca dependem dele. Um plano diz respeito apenas a quanto do assistente você pode usar.",
  names: { free: "Gratuito", personal: "Pessoal", unlimited: "Ilimitado" },
  subscribed:
    "Obrigado. Seu plano muda assim que o Stripe confirmar o pagamento, em geral em menos de um minuto; esta página mostra a mudança quando ela acontecer.",
  unavailable:
    "Não foi possível abrir a página de pagamento agora. Nada foi cobrado; tente de novo daqui a pouco.",
  on: (name: string) => `Você está no plano ${name}.`,
  allowance: {
    unlimited: "O assistente, sem limite mensal.",
    messages: (n: number | null) =>
      n === null
        ? "mensagens com o assistente sem limite"
        : `${n} ${n === 1 ? "mensagem" : "mensagens"} com o assistente`,
    reports: (n: number | null) =>
      n === null
        ? "relatórios escritos por ele sem limite"
        : `${n} ${n === 1 ? "relatório escrito" : "relatórios escritos"} por ele`,
    both: (messages: string, reports: string) => `${messages} e ${reports}, todo mês.`,
  },
  source: {
    grant: "Dado a você por quem mantém este sintr.",
    practice: "Incluído no plano do seu consultório.",
  },
  subscription: {
    ends: (end: string | null, after: string) =>
      `${end ? `Termina em ${end}` : "Termina no fim deste período"}. Depois disso você passa para ${after}, e seu diário continua como está.`,
    afterPlan: (name: string) => `o plano ${name}`,
    paid: (end: string | null) => `Pago pelo Stripe${end ? `, com renovação em ${end}` : ""}.`,
    pastDue:
      "O último pagamento não foi aprovado. O plano continua enquanto o Stripe tenta de novo; você pode trocar o cartão na página do Stripe.",
    ended: "Sua última assinatura terminou.",
    manage: "Gerenciar a assinatura",
    receipts: "Seus pagamentos e recibos",
  },
  month: "Este mês",
  meters: {
    messages: "Mensagens com o assistente",
    reports: "Relatórios escritos pelo assistente",
  },
  speaking: "Minutos de fala transcritos",
  meter: {
    soFar: (used: number) => `${used} até agora`,
    of: (used: number, limit: number) => `${used} de ${limit}`,
  },
  startsAgain: (next: string) => `A contagem recomeça em ${next}.`,
  runOut: (next: string) =>
    `Quando acabarem, nada se perde. Você ainda pode escrever no Início, e o que escrever fica guardado como rascunho de registro, nas suas próprias palavras; os check-ins e o seu relatório continuam funcionando, preparados a partir do que você escreveu. A contagem recomeça em ${next}.`,
  own: {
    title: "Você usa sua própria chave.",
    body: "Nada é contado aqui, e o seu provedor cobra de você diretamente.",
    back: "Você pode voltar ao assistente incluído em",
    backLink: "Ajustes",
    backAfter: "quando quiser.",
  },
  none: {
    title: "Não há plano para escolher aqui.",
    body: "Este sintr não tem um assistente próprio, então nada é contado: você usa sua própria chave, e o seu provedor cobra de você diretamente.",
  },
  ownKey: "Usar sua própria chave",
  more: {
    title: "Mais do assistente",
    personal: (name: string, allowance: string, price: string | null) =>
      `${name}: ${allowance}${price ? ` Custa ${price}.` : ""}`,
    practice: "Como terapeuta, você tem isso no plano Consultório, mais abaixo, para o seu próprio diário.",
    subscribe: (name: string) => `Assinar o plano ${name}`,
    stripe:
      "Você paga na página do Stripe e pode cancelar lá quando quiser. Seu diário continua como está, de qualquer forma.",
    closed: "As assinaturas não estão abertas neste sintr. Quem o mantém pode dar um plano para você.",
    ownKey: "Ou use sua própria chave: aqui não custa nada, e o seu provedor cobra de você.",
  },
  practice: {
    title: "Seu consultório",
    summary: (plan: string, seats: string) =>
      `${plan}: ${seats}. Cada vaga é um paciente vinculado ao seu consultório, ou um convite esperando resposta.`,
    unlimited: (linked: number) =>
      `vagas ilimitadas, ${linked} ${linked === 1 ? "paciente vinculado" : "pacientes vinculados"}`,
    limited: (seats: number, inUse: number) => `${seats} ${seats === 1 ? "vaga" : "vagas"}, ${inUse} em uso`,
    after: "os padrões deste sintr",
    inUse: "Vagas em uso",
    offer: (price: string | null) =>
      `O plano Consultório: as vagas que você escolher${price ? `, a ${price} cada uma` : ""}, e o assistente incluído para o seu próprio diário, como no Pessoal.`,
    seats: "Vagas",
    subscribe: "Assinar",
    range: (max: number) => `Escolha entre 1 e ${max} vagas.`,
    grant: "Concedidas ao seu consultório por quem mantém este sintr.",
    config: "Definidas pela configuração deste sintr; quem o mantém pode mudá-las.",
    patients:
      "Os planos dos seus pacientes são deles. Compartilhar com você nunca muda esses planos, então parar não custa nada a eles.",
  },
  price: (money: string, interval: "day" | "week" | "month" | "year", count: number) => {
    const [one, many] = UNITS[interval] ?? [interval, interval];
    return count === 1 ? `${money} por ${one}` : `${money} a cada ${count} ${many}`;
  },
  notes: {
    used: "As mensagens deste mês com o assistente acabaram.",
    stillWrite: (next: string) =>
      `Você ainda pode escrever aqui: o que você enviar fica guardado como rascunho de registro, nas suas palavras, para você confirmar. Os check-ins e o seu relatório continuam funcionando. O assistente volta a responder em ${next}.`,
    seePlan: "Ver seu plano",
    answersAgain: (next: string) =>
      `O assistente volta a responder em ${next}; até lá, o que você enviar fica guardado como rascunho de registro.`,
    left: (n: number, next: string) =>
      `${n === 1 ? "Resta 1 mensagem" : `Restam ${n} mensagens`} com o assistente neste mês, até ${next}.`,
    yourPlan: "Seu plano",
    included: "O assistente está incluído no seu",
    includedLink: "plano",
    includedAfter: ".",
  },
  reply: {
    saved: (kind: "entry" | "checkin") =>
      `Salvo: ${kind === "entry" ? "seu registro" : "seu check-in"} está no seu diário. As mensagens deste mês com o assistente acabaram, então não consigo dizer mais do que isso.`,
    kept: "As mensagens deste mês com o assistente acabaram, então não consigo responder a esta mensagem. Suas palavras estão guardadas: estão no rascunho abaixo, como um registro nas suas próprias palavras. Confirme para salvar, ou mude antes.",
    waiting:
      "As mensagens deste mês com o assistente acabaram, então não consigo responder a esta mensagem. Sua mensagem fica guardada nesta conversa.",
  },
} satisfies Messages["plan"];
