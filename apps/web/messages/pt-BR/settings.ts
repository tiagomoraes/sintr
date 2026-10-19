import type { Messages } from "../types";

/** Ajustes, na voz narrativa: quem responde a você, como o sintr chega até você e o seu horário. */
export const settings = {
  title: "Ajustes",
  lede: "Quem responde a você, como o sintr chega até você e o seu horário.",
  welcomeAgain: {
    body: "Você pode passar pelas boas-vindas de novo quando quiser: o que você já contou vem preenchido, qualquer pergunta pode ser pulada e nada do que você escreveu é apagado.",
    link: "Passar pelas boas-vindas de novo",
  },
  assistant: {
    title: "Seu assistente",
    included: (name: string) =>
      `O assistente está incluído. Ele usa um modelo de ${name}, pela própria conta do sintr: o que você escreve numa conversa é enviado para lá para ser respondido, e para nenhum outro lugar. Você não precisa de uma chave.`,
    plan: (label: string) => `Você está no plano ${label}`,
    plans: { free: "Gratuito", personal: "Pessoal", unlimited: "Ilimitado" },
    planNoLimit: ", sem limite mensal.",
    planUsed: (used: number, limit: string) => `: ${used} de ${limit} usadas este mês.`,
    message: { one: "mensagem", many: "mensagens" },
    planLink: "Seu plano",
    door: "Usar a sua própria chave",
    doorBody:
      "Traga uma chave de um provedor que você escolher, ou um modelo na sua própria máquina. Suas conversas e relatórios passam a ir para esse provedor, sob o seu próprio acordo com ele, e não contam no seu plano: aqui é gratuito, e quem cobra é o provedor.",
    own: (provider: string, model: string, house: boolean) =>
      `Você está usando a sua própria chave, com ${provider} (${model}). O que você escreve numa conversa vai para esse provedor, sob o seu acordo com ele${house ? ", e não conta em nenhum plano." : ", e para nenhum outro lugar."}`,
    endpoint: "um serviço compatível com a OpenAI",
    back: "Voltar ao assistente incluído",
    backNote: "Sua chave é removida do sintr.",
    ownDoor: "Sua própria chave",
    none: "Este sintr não tem um assistente próprio, então ele conversa com um modelo que você escolher, com a sua própria chave. O que você escreve numa conversa é enviado para esse provedor, e para nenhum outro lugar.",
    keyNote:
      "A chave é criptografada com a sua própria chave de dados antes de ser guardada, nunca mais é mostrada e só é usada para chegar a esse provedor.",
  },
  form: {
    label: "O assistente",
    provider: "Provedor",
    compatible: "Compatível com OpenAI",
    compatibleHint:
      "Qualquer serviço que fale a API de chat da OpenAI: a própria OpenAI, OpenRouter, Ollama, LiteLLM e outros.",
    directHint: (name: string) => `O sintr fala diretamente com o provedor ${name}, com a sua chave.`,
    url: "Endereço do serviço",
    urlHint:
      "Quando o sintr roda no Docker, um modelo na mesma máquina fica em http://host.docker.internal, e não em localhost.",
    model: "Modelo",
    models: {
      openai_compatible: "O nome do modelo nesse serviço",
      anthropic: "Por exemplo claude-sonnet-5-5",
      google: "O nome do modelo Gemini",
    },
    key: "Chave de API",
    keyKeep: "Deixe vazio para manter a chave salva",
    keyPaste: "Cole a sua chave",
    keySaved: (hint: string | null) =>
      `Há uma chave salva${hint ? `, terminando em ${hint}` : ""}. Ela nunca é mostrada de novo, e é removida se você mudar o provedor ou o endereço dele.`,
    keyOptional: "Opcional para um serviço local, como o Ollama.",
    keyFrom: "Da sua conta no provedor.",
    keyRemove: "Remover a chave salva",
    save: "Salvar o assistente",
    saved: "Salvo.",
  },
  test: {
    label: "Testar a conexão",
    testing: "Testando",
    note: "Um pedido curto ao provedor, com a configuração salva.",
    rehearsal:
      "O assistente de ensaio respondeu. Ele funciona offline e com respostas prontas, então nada saiu desta máquina.",
    ok: "O assistente respondeu. Está tudo pronto para conversar.",
    problems: {
      not_configured: "Salve um provedor e um modelo primeiro.",
      key_required: "Este provedor precisa de uma chave de API.",
      base_url_required: "Este provedor precisa do endereço dele.",
      key_refused: "O provedor recusou a chave. Confira se ela está completa e ainda ativa.",
      model_not_found: "O provedor não conhece este modelo. Confira o nome.",
      rate_limited: "O provedor está ocupado, ou a chave chegou ao limite. Tente de novo daqui a pouco.",
      unreachable: "Não foi possível falar com o provedor. Confira o endereço e se ele está no ar.",
      timeout: "O provedor demorou demais para responder.",
      provider_error: "O provedor respondeu com um erro. Confira o modelo e a chave.",
      invalid_url: "O endereço não parece certo.",
      credentials_in_url: "O endereço não pode conter uma senha.",
      https_required: "Aqui o endereço precisa usar https.",
      private_address: "Aqui o endereço precisa ser público.",
    },
  },
  voice: {
    ready: (who: string) =>
      `Quando você fala em vez de digitar, o que você disse é passado para texto por ${who}, e a gravação é descartada logo depois: o sintr nunca a guarda. Você lê as palavras antes de elas serem enviadas.`,
  },
  others: {
    title: "Seus outros assistentes",
    body: "ChatGPT, Claude, Gemini ou Hermes podem guardar registros aqui para você, cada um com a sua própria chave.",
    more: "Conectar outro",
    first: "Conectar um",
    none: "Nenhum assistente está conectado.",
  },
  email: { title: "Seu e-mail" },
  practice: {
    titleOwn: "Seu consultório",
    titleNew: "Você é terapeuta?",
    own: (name: string) =>
      `Seu consultório, ${name}, recebe os relatórios que os seus pacientes compartilham com você.`,
    ownLink: "Abrir o painel",
    open: "Abra um consultório nesta conta para receber os relatórios que os seus pacientes escolherem compartilhar com você. O seu próprio diário continua como está.",
    openLink: "Abrir um consultório",
  },
  time: {
    title: "Seu fuso horário e suas conversas",
    label: "Fuso horário e conversas",
    zone: "Seu fuso horário",
    zoneHint: "As datas do seu diário e o que o assistente entende por hoje seguem esse fuso.",
    device: (zone: string) => `Usar o fuso horário deste aparelho, ${zone}`,
    keep: "Guardar as conversas",
    keepHint:
      "Os registros e check-ins que você salvou ficam no seu diário de qualquer jeito. Só as conversas vão embora.",
    retention: {
      keep: "Até eu apagar",
      30: "30 dias depois da última mensagem",
      90: "90 dias depois da última mensagem",
      365: "Um ano depois da última mensagem",
    },
    save: "Salvar",
    saved: "Salvo.",
  },
  problems: {
    provider: "Escolha um provedor.",
    model: "Escreva o nome do modelo como o seu provedor escreve.",
    url: {
      invalid_url: "Escreva o endereço completo, começando com http:// ou https://.",
      credentials_in_url: "Deixe a senha fora do endereço; a chave vai no campo dela.",
      https_required: "Use um endereço https.",
      private_address: "Use um endereço https público.",
    },
    houseUrl:
      "Esse é o endereço do assistente deste sintr, que já está incluído. Use o endereço do seu provedor.",
    keyOther: "A chave salva é de outro provedor. Cole a chave deste.",
    keyNeeded: "Este provedor precisa de uma chave de API.",
    fields: "Confira os campos e tente de novo.",
    retention: "Escolha por quanto tempo guardar as conversas.",
    timezone: "Escolha um fuso horário da lista.",
  },
} satisfies Messages["settings"];
