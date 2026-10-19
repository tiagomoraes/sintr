import type { Messages } from "../types";

/** Uma conversa com o assistente, além do início: o que deu errado, e o que fazer enquanto não há assistente. */
export const talk = {
  problems: {
    not_configured:
      "Este sintr ainda não tem um assistente próprio. Você pode usar sua própria chave, em Ajustes.",
    key_required: "Este provedor precisa de uma chave de API. Você pode adicioná-la em Ajustes.",
    base_url_required: "Falta o endereço deste provedor. Você pode adicioná-lo em Ajustes.",
    invalid_url: "O endereço do provedor não parece certo. Você pode conferi-lo em Ajustes.",
    credentials_in_url: "O endereço do provedor não pode conter uma senha. Você pode mudá-lo em Ajustes.",
    https_required: "Aqui, o endereço do provedor precisa usar https. Você pode mudá-lo em Ajustes.",
    private_address: "Aqui, o endereço do provedor precisa ser público. Você pode mudá-lo em Ajustes.",
    key_refused: "O provedor recusou a chave. Você pode conferi-la em Ajustes.",
    model_not_found: "O provedor não conhece este modelo. Você pode conferir o nome dele em Ajustes.",
    rate_limited: "O provedor está ocupado, ou a chave chegou ao limite. Tente de novo daqui a pouco.",
    unreachable:
      "Não foi possível conectar ao provedor. Confira o endereço dele em Ajustes, ou tente de novo.",
    timeout: "O provedor demorou demais para responder. Tente de novo daqui a pouco.",
    signed_out: "Sua sessão terminou. Entre de novo para continuar.",
    not_found: "Esta conversa não está disponível.",
    nothing_to_retry: "Não há nada para tentar de novo aqui. Escreva sua mensagem outra vez.",
  },
  fallback:
    "O assistente não conseguiu responder agora. Sua mensagem está guardada, e você pode tentar de novo.",
  house: {
    rate_limited: "O assistente está ocupado agora. Sua mensagem está guardada; tente de novo daqui a pouco.",
    timeout:
      "O assistente demorou demais para responder. Sua mensagem está guardada; tente de novo daqui a pouco.",
    fallback:
      "O assistente não está disponível agora. Sua mensagem está guardada, e você pode tentar de novo mais tarde.",
  },
  setup: {
    title: "Este sintr ainda não tem um assistente próprio.",
    body: "Para conversar aqui, traga uma chave de um provedor que você escolher, ou aponte o sintr para um modelo no seu próprio computador. Leva um minuto, em Ajustes. O que você escrever vai só para esse provedor, e a chave é criptografada antes de ser guardada.",
    without: "Os check-ins e o seu relatório semanal funcionam sem ele.",
    ownKey: "Usar sua própria chave",
    checkin: "Fazer um check-in",
  },
} satisfies Messages["talk"];
