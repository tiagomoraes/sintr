import type { Messages } from "../types";

/**
 * Seus outros assistentes (Conectar): manter o diário pelo assistente com que
 * você já conversa, por MCP. Menus e botões de outros produtos ficam entre
 * aspas, com o nome que têm nas telas em inglês desses produtos; comandos,
 * arquivos, endereços e chaves nunca mudam.
 */
export const connect = {
  title: "Seus outros assistentes",
  lede: "Se você já conversa com o ChatGPT, o Claude, o Gemini ou o Hermes, eles podem manter o seu diário aqui: conte o que aconteceu e, quando você disser sim, o registro fica guardado no sintr, nas suas palavras.",
  instead: "Prefere não configurar nada?",
  insteadLink: "Fale ou escreva no Início",
  insteadAfter: "em vez disso.",
  connected: "Seus assistentes",
  how: {
    label: "Como funciona",
    make: {
      title: "Crie uma chave",
      text: "Uma chave particular que deixa um assistente acessar o seu diário. Você pode desligá-la quando quiser.",
    },
    give: {
      title: "Passe para o seu assistente",
      text: "Escolha o seu assistente abaixo e copie o que ele precisa. Leva um ou dois minutos.",
    },
    talk: {
      title: "Converse como sempre",
      text: "Quando algo acontecer, conte ao seu assistente. Ele faz o rascunho do registro com você e guarda aqui quando você disser sim.",
    },
  },
  heading: {
    made: "Sua nova chave",
    another: "Conectar outro assistente",
    first: "Conectar um assistente",
  },
  make: {
    button: "Criar uma chave",
    making: "Criando sua chave",
    more: "Dar um nome, ou escolher o que o assistente pode fazer",
    name: "Nome",
    optional: "(opcional)",
    placeholder: "Por exemplo, Claude no meu notebook",
    hint: "Para você distinguir suas chaves depois.",
    access: "O que o assistente pode fazer",
  },
  access: {
    read_write: {
      label: "Ler e salvar",
      hint: "Ele pode rever os seus últimos dias e salvar novos registros e check-ins.",
    },
    write: {
      label: "Só salvar",
      hint: "Ele pode salvar novos registros e check-ins, e nunca lê o seu diário.",
    },
    read: {
      label: "Só ler",
      hint: "Ele pode ler os seus últimos dias e as anotações da sua terapia, e não salva nada.",
    },
  },
  defaultName: "Meu assistente",
  problems: {
    access: "Escolha o que o seu assistente pode fazer.",
    tooMany: (max: number) =>
      `Você já tem ${max} chaves. Desconecte uma que não usa mais e depois crie uma nova.`,
  },
  panel: {
    for: (name: string) => `Para ${name}`,
    key: "sua chave",
    copyNow: "Copie agora: o sintr mostra a chave só desta vez. Se você perder, crie uma nova.",
    filled: "Ela já está preenchida nos passos abaixo.",
    connected: (last: string) => `Conectado. ${last}`,
    waiting:
      "Esperando o seu assistente. Quando terminar os passos abaixo, pergunte algo a ele; esta linha muda quando ele chegar ao sintr.",
    hide: "Já guardei, esconder a chave",
  },
  setup: {
    title: "Passe para o seu assistente",
    made: "Seu endereço e sua chave já estão preenchidos. Copie cada parte onde os passos indicam. Os menus e botões entre aspas estão com o nome que têm em inglês em cada produto.",
    waiting: (placeholder: string) =>
      `Crie uma chave acima e ela aparece preenchida aqui; até lá, estes passos mostram ${placeholder} no lugar dela. Os menus e botões entre aspas estão com o nome que têm em inglês em cada produto.`,
    choose: "Seu assistente",
    check: "Para conferir se funcionou: ",
    blocked: (name: string, address: string) =>
      `O ${name} acessa o sintr a partir dos próprios servidores, e este sintr está em ${address}, que só este computador ou esta rede alcançam. Antes, ele precisa de um endereço https público (o guia de auto-hospedagem explica como).`,
    fromFile: "O caminho abaixo, por um arquivo, já funciona neste computador.",
  },
  snippets: {
    address: { label: "o endereço", caption: "Endereço" },
    command: { label: "o comando", caption: "Comando" },
    configuration: { label: "a configuração", caption: "Configuração" },
    endpoint: { label: "o endpoint", caption: "Endpoint" },
  },
  download: "Baixar sintr-mcp.mjs",
  guides: {
    terminal: "Em um terminal, execute:",
    claude: {
      what: "Adiciona o sintr ao Claude como um conector, no claude.ai e no aplicativo do Claude.",
      customize: "No Claude, abra “Customize” e depois “Connectors”.",
      add: "Escolha “+ Add” e depois “Add custom connector”. Dê a ele o nome sintr.",
      url: "Cole isto como a URL. Ela leva a sua chave, então guarde-a só para você.",
      signIn:
        "Quando ele perguntar como as pessoas entram, escolha “No sign-in” (algumas páginas escrevem “No sign in”) e adicione o conector.",
      check:
        "Em uma nova conversa, escolha o botão “+”, depois “Connectors”, e ative o sintr. Depois pergunte: o que eu escrevi no sintr esta semana?",
      free: "Contas gratuitas do Claude podem adicionar um conector personalizado.",
      team: "Nos planos Team ou Enterprise, um proprietário adiciona os conectores para todos; por isso, use o arquivo do aplicativo para computador, abaixo: sua chave é só sua.",
      desktop:
        "Ou, no aplicativo do Claude para computador, por um arquivo (funciona com um sintr neste computador)",
      bridge:
        "Baixe a ponte, um pequeno programa que leva as mensagens entre o Claude e o sintr. Ela precisa do Node.js 20 ou mais recente neste computador.",
      config:
        "No aplicativo do Claude, abra “Settings”, depois “Developer”, depois “Edit Config”. No Mac, “Settings” fica no menu “Claude”, no alto da tela. No Windows, o arquivo é %APPDATA%\\Claude\\claude_desktop_config.json.",
      file: "Adicione isto ao arquivo e troque /path/to/sintr-mcp.mjs pelo lugar onde você salvou a ponte. Se o arquivo já tiver mcpServers, adicione só a parte do sintr dentro dele.",
      restart: "Feche o Claude por completo e abra de novo.",
    },
    chatgpt: {
      what: "Adiciona o sintr ao ChatGPT no chatgpt.com, como um app personalizado.",
      open: "Abra chatgpt.com/plugins, escolha o botão “+” e depois “Add custom MCP server”.",
      url: "Dê o nome sintr. Em “Connection”, cole isto como “Server URL”:",
      auth: "Na autenticação, escolha “No authentication”.",
      create: "Marque “I understand and want to continue” e depois escolha “Create as a plugin”.",
      install: "Encontre o sintr nos seus plugins e instale.",
      check:
        "Comece uma nova conversa, digite @ e escolha sintr, depois pergunte: o que eu escrevi esta semana?",
      plans:
        "A OpenAI oferece servidores MCP personalizados no ChatGPT Business, Enterprise e Edu. Se você não vir a opção no seu plano, consulte a ajuda atual da OpenAI.",
      address:
        "O ChatGPT não consegue enviar uma chave sozinho, então a chave vai dentro do endereço. Qualquer pessoa com o endereço pode usar o seu diário: guarde-o em sigilo e desconecte a chave aqui se ele vazar.",
    },
    gemini: {
      what: "Adiciona o sintr ao Gemini CLI, o assistente do Google no terminal.",
      list: "Abra o gemini e digite /mcp: o sintr aparece na lista com o que ele pode fazer.",
      check: "Pergunte ao Gemini: o que eu escrevi no sintr esta semana?",
      app: "O app Gemini, em gemini.google.com, conecta apps personalizados com um login que o sintr ainda não oferece, então não conseguimos confirmar que funciona lá. Consulte a ajuda atual do Google antes de tentar.",
      antigravity:
        "Ou, no Antigravity CLI (em junho de 2026 o Google levou para lá as contas gratuitas e do Google One que usavam o Gemini CLI)",
      file: "Adicione isto a ~/.gemini/config/mcp_config.json (dentro de mcpServers, se o arquivo já tiver):",
      listed: "Digite /mcp para ver o sintr na lista.",
    },
    claudeCode: {
      what: "Adiciona o sintr ao Claude Code, para todos os projetos deste computador.",
      list: "Execute claude mcp list: o sintr aparece como conectado. Dentro do Claude Code, /mcp também mostra.",
      check: "Pergunte ao Claude Code: o que eu escrevi no sintr esta semana?",
    },
    hermes: {
      what: "Adiciona o sintr ao Hermes Agent.",
      run: "Em um terminal, execute isto e cole a sua chave quando o Hermes pedir:",
      test: "Execute hermes mcp test sintr para ver se ele conecta. Em uma sessão aberta, /reload-mcp carrega o sintr.",
      check: "Pergunte ao Hermes: o que eu escrevi no sintr esta semana?",
      config: "Ou, no arquivo de configuração do Hermes",
      file: "Adicione isto a ~/.hermes/config.yaml (em mcp_servers, se o arquivo já tiver):",
    },
  },
  keys: {
    label: "Assistentes conectados",
    meta: (access: string, made: string, prefix: string) =>
      `${access}. Criada em ${made}. Começa com ${prefix}.`,
    after:
      "Desconectar desliga a chave na hora. O que o assistente já salvou continua no seu diário, e você pode conectá-lo de novo com uma nova chave.",
    disconnect: "Desconectar",
    disconnecting: "Desconectando",
    disconnectName: (name: string) => `Desconectar ${name}`,
    canUse: (scopes: string) => `Pode usar: ${scopes}`,
    notUsed: "Ainda não foi usada.",
    lastTalked: (since: string, client: string | null) =>
      `Falou com o sintr pela última vez ${since}${client ? `, pelo ${client}` : ""}.`,
    since: {
      justNow: "agora mesmo",
      minute: "há um minuto",
      minutes: (n: number) => `há ${n} minutos`,
      hour: "há uma hora",
      hours: (n: number) => `há ${n} horas`,
      yesterday: "ontem",
      on: (day: string) => `em ${day}`,
    },
  },
  copy: {
    copy: "Copiar",
    copied: "Copiado",
    copyLabel: (label: string) => `Copiar ${label}`,
    copiedLabel: (label: string) => `Copiado: ${label}`,
    copiedStatus: (label: string) => `Copiado: ${label}.`,
    failed: "Selecione e copie à mão.",
  },
  technical: {
    summary: "Detalhes para quem gosta da parte técnica",
    endpoint: {
      term: "O endpoint",
      body: "O sintr é um servidor MCP sobre Streamable HTTP. Ele não guarda estado: cada requisição é um POST respondido com JSON, sem sessão e sem fluxo de eventos.",
    },
    key: {
      term: "A chave",
      before: "Envie como",
      middle: ". Clientes que só aceitam um endereço podem colocá-la no final dele (",
      after:
        "); aí o endereço vira um segredo. A chave é a única credencial: cookies nunca são lidos ali, e um navegador em outro site é recusado. O sintr guarda só um hash SHA-256 dela.",
    },
    bridge: {
      term: "De um programa no seu computador",
      before:
        "Para clientes que iniciam servidores como programas locais, a ponte encaminha o stdio para o endpoint com a sua chave. Ela precisa do Node.js 20 ou mais recente; defina",
      and: "e",
      or: ", ou coloque",
      in: "em",
      after: ". Em http simples, ela só fala com este computador.",
    },
    tools: {
      term: "O que o seu assistente pode fazer",
      needs: (scopes: string) => `Precisa de ${scopes}.`,
      or: " ou ",
      after:
        "As descrições estão em inglês, como o assistente as recebe. Uma chave que só pode ler, ou só salvar, nem vê as outras ferramentas.",
    },
    told: {
      term: "O que o seu assistente recebe",
      body: "Ao se conectar, ele recebe estas instruções, em inglês, feitas com as mesmas regras do assistente dentro do sintr. O que ele salva é conferido com as suas próprias palavras antes de ser guardado.",
    },
    leaves: {
      term: "O que sai deste diário",
      body: "O provedor do seu assistente recebe o que você conta a ele e o que o sintr responde às ferramentas dele: os seus últimos dias, um registro que ele abre, a agenda e as anotações da sua terapia, os registros de um período quando ele ajuda você a se preparar. Os termos desse provedor valem para isso. Nada é enviado ao seu terapeuta a partir de um assistente; os relatórios são aprovados e enviados aqui.",
      guide: "O guia completo, com todos os clientes (em inglês)",
    },
  },
} satisfies Messages["connect"];
