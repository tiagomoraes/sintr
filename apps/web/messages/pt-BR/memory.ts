import type { Messages } from "../types";

/** Memória (F10): o que o sintr lembra da pessoa, para o assistente dela, de onde veio e como corrigir ou esquecer. */
export const memory = {
  title: "Memória",
  heading: "O que o sintr lembra",
  lede: {
    off: "Seu assistente conhece só a conversa que está diante dele. Com uma memória, ele sabe o seu nome e o que você já contou ao seu diário, e você não começa do zero toda vez.",
    on: "Tirada do seu próprio diário, para o seu próprio assistente. Cada lembrança mostra de onde veio. Se alguma estiver errada, corrija ou esqueça.",
  },
  offer: {
    what: {
      term: "O que ela faz",
      body: "O sintr lê o que você escreve no diário, seus registros e as notas dos check-ins, e guarda notas curtas: o seu nome, quem você é, o que vem acontecendo. Quando você conversa com o seu assistente, as que importam estão diante dele.",
    },
    who: {
      term: "Quem recebe as suas palavras",
      house: (names: string) =>
        `Para ler o seu diário e encontrar o que tem sentido parecido, o sintr envia seus registros e as notas dos check-ins para ${names}, pela conta do próprio sintr, do mesmo jeito que as suas conversas vão para lá.`,
      own: (names: string) =>
        `Para ler o seu diário e encontrar o que tem sentido parecido, o sintr envia seus registros e as notas dos check-ins para ${names}, com a sua própria chave, do mesmo jeito que as suas conversas vão para lá.`,
    },
    kept: {
      term: "O que fica guardado",
      body: "Cada lembrança é selada com a sua própria chave, como o seu diário, junto com as palavras de onde veio. Para encontrá-la pelo sentido, o sintr guarda também uma lista de números para ela, girada por uma chave que só a sua conta tem. Nada disso entra nos seus relatórios, e seu terapeuta nunca vê.",
    },
    yours: {
      term: "O que você pode fazer",
      body: "Ver cada lembrança e de onde veio, corrigir ou esquecer. Esquecer tudo desliga a memória e apaga tudo.",
    },
    never: {
      term: "O que ela nunca faz",
      body: "Uma lembrança nunca é um diagnóstico e nunca muda o que você escreveu. Palavras que indicam risco nunca são guardadas, e os canais de ajuda vêm sempre primeiro.",
    },
    agree: "Deixar o sintr lembrar",
    agreeing: "Lendo o seu diário",
    note: "Nada é lido antes de você concordar, e você pode desligar quando quiser.",
    changed:
      "Quem receberia as suas palavras mudou enquanto esta página estava aberta. Leia de novo antes de concordar.",
  },
  unavailable: {
    not_configured:
      "Ainda não há um assistente aqui, então não há para quem lembrar. Depois de configurar um em Ajustes, você pode ligar a memória.",
    off: "Este sintr não oferece memória.",
    provider_has_no_embeddings: (provider: string | null) =>
      `Seu assistente usa ${provider ?? "um provedor"}, que não consegue situar palavras pelo sentido, então o sintr não consegue manter uma memória com ele. OpenRouter, OpenAI e Google conseguem.`,
    provider_unknown: (provider: string | null) =>
      `O sintr não sabe como pedir a ${provider ?? "o seu provedor"} para situar palavras pelo sentido, então não consegue manter uma memória com ele. OpenRouter, OpenAI e Google conseguem.`,
    settings: "Abrir Ajustes",
  },
  paused: {
    route: (agreed: string, now: string) =>
      `Sua memória está pausada. Você concordou em enviar o seu diário para ${agreed}, e agora o seu assistente usa ${now}. Nada é lido nem enviado até você concordar de novo.`,
    wording:
      "Sua memória está pausada: as palavras deste acordo mudaram. Leia de novo e concorde, se quiser que ela continue.",
    unavailable: "Sua memória está pausada, e nada é lido nem enviado:",
    again: (names: string) => `Concordar para ${names}`,
  },
  status: {
    goesTo: (names: string) => `Para mantê-la, o seu diário vai para ${names}.`,
    all: "O sintr leu tudo o que você escreveu.",
    waiting: (count: number) =>
      count === 1
        ? "Uma página está esperando para ser lida."
        : `${count} páginas estão esperando para ser lidas.`,
    readNow: "Ler agora",
    reading: "Lendo",
    daily: "O sintr já leu o quanto lê em um dia aqui; o resto segue amanhã.",
    failed: "O sintr não conseguiu ler o seu diário agora. Ele tenta de novo sozinho.",
  },
  sections: {
    about: "Quem você é",
    moments: "O que vem acontecendo",
  },
  name: {
    line: (name: string) => `O sintr chama você de ${name}.`,
    source: "Das boas-vindas.",
    change: "Mudar",
  },
  empty: {
    title: "Nada ainda",
    body: "O sintr guarda lembranças do que você escreve. Escreva um registro ou uma nota de check-in, e o que vale a pena guardar aparece aqui.",
  },
  source: {
    entry: (day: string) => `Do seu registro de ${day}`,
    checkin: (day: string) => `Do seu check-in de ${day}`,
  },
  words: "Nas suas palavras",
  corrected: "Você corrigiu esta.",
  correct: {
    open: "Corrigir",
    label: "O que o sintr deve lembrar no lugar?",
    save: "Salvar",
    saving: "Salvando",
    cancel: "Cancelar",
    tooLong: "Use no máximo 300 caracteres.",
    empty: "Escreva o que o sintr deve lembrar, ou esqueça esta.",
  },
  forget: {
    label: "Esquecer",
    confirm: "Esquecer esta",
    pending: "Esquecendo",
    explanation:
      "O sintr apaga esta lembrança. Ela não volta da mesma página, a não ser que você mude essa página.",
  },
  forgetAll: {
    title: "Esquecer tudo",
    body: "Todas as lembranças, e o registro do que o sintr leu, são apagados, e a memória se desliga. Seu diário fica exatamente como está.",
    label: "Esquecer tudo",
    confirm: "Esquecer tudo e desligar",
    pending: "Esquecendo",
    explanation:
      "Isso não pode ser desfeito. Se você ligar a memória de novo depois, o sintr lê o seu diário outra vez desde o começo.",
    done: "Pronto. O sintr não guarda nenhuma memória de você agora, e nada é lido.",
  },
  download: {
    title: "Leve com você",
    body: "Cada lembrança, as palavras de onde veio e de onde, em um arquivo.",
    link: "Baixar o que o sintr lembra",
  },
  fromRecord: (count: number) =>
    count === 1 ? "O sintr lembra uma coisa disto." : `O sintr lembra ${count} coisas disto.`,
  seeMemory: "Ver em Memória",
} satisfies Messages["memory"];
