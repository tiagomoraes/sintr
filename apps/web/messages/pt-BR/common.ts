import type { Messages } from "../types";

/** Palavras que mais de uma tela usa: títulos, erros, botões que perguntam duas vezes. */
export const common = {
  description: "Um diário de humor privado para a semana entre as sessões de terapia.",
  error: {
    heading: "Não foi possível abrir esta página.",
    body: "Algo deu errado do nosso lado. Tente de novo daqui a pouco.",
    retry: "Tentar de novo",
  },
  notFound: {
    heading: "Não há nada nesta página.",
    body: "O endereço pode ter sido digitado errado, ou a página mudou de lugar.",
    link: "Voltar ao início",
    after: ".",
  },
  keep: "Manter",
  landing: {
    open: "Abrir seu diário",
    signIn: "Entrar",
    create: "Criar seu diário",
    heading: "A semana entre as sessões, guardada nas suas próprias palavras.",
    lede: "O sintr é um diário de humor privado. Anote o que aconteceu, o que passou pela cabeça e com que força você sentiu. Antes de cada sessão de terapia, sua semana está esperando em uma página, para você ler primeiro e compartilhar só se quiser.",
    already: "Já tenho um",
    promise:
      "Tudo o que você escreve é criptografado para você antes de ser armazenado. Nada sai sem a sua aprovação daquele relatório específico.",
    record: "O sintr faz o registro.",
    therapy: "Seu terapeuta faz a terapia.",
    limits:
      "Não é terapia, nem diagnóstico, nem serviço de emergência. Ele não vai rotular você nem dizer o que fazer. Guarda as suas palavras exatamente como você escreveu.",
  },
} satisfies Messages["common"];
