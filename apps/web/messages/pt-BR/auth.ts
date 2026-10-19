import type { Messages } from "../types";

/** Entrar e criar o diário, a senha, o endereço de e-mail, o consentimento: a conta em si. */
export const auth = {
  signIn: {
    title: "Entrar",
    heading: "Olá de novo.",
    lede: "Entre para abrir seu diário.",
    forgot: "Esqueceu sua senha?",
    newHere: "Primeira vez aqui?",
    create: "Criar seu diário",
  },
  signUp: {
    title: "Criar seu diário",
    heading: "Crie seu diário.",
    lede: "Basta um e-mail e uma senha. Sem nome, sem perfil para preencher.",
    closed: "O cadastro está fechado neste sintr. Se ele é seu, defina SINTR_SIGNUP como open e reinicie.",
    already: "Já tem um?",
    signIn: "Entrar",
  },
  form: {
    email: "E-mail",
    password: "Senha",
    passwordHint: "Pelo menos 10 caracteres. Uma frase curta funciona bem.",
    signIn: "Entrar",
    signUp: "Criar seu diário",
  },
  errors: {
    generic: "Algo deu errado. Tente de novo daqui a pouco.",
    tooMany: "Tentativas demais. Espere um minuto e tente de novo.",
    mismatch: "Esse e-mail e essa senha não combinam.",
    exists: "Já existe um diário com este e-mail. Entre nele em vez de criar outro.",
    tooShort: "Use uma senha de pelo menos 10 caracteres.",
    tooLong: "Use uma senha de no máximo 128 caracteres.",
    badEmail: "Confira o endereço de e-mail.",
    consent: "Para guardar seu diário, o sintr precisa do seu consentimento abaixo.",
    closed: "O cadastro está fechado neste sintr.",
  },
  forgot: {
    title: "Esqueceu sua senha",
    heading: "Uma senha nova.",
    lede: "Escreva seu e-mail e o sintr envia um link para você definir uma nova.",
    noEmail:
      "O e-mail não está configurado neste sintr, então ele não consegue enviar um link. Se ele é seu, configure o SMTP como descrito em docs/SELFHOST.md.",
    back: "Voltar para entrar",
    sent: "Se existe um diário para esse endereço, um link para definir uma senha nova está a caminho. Ele vale por uma hora.",
    tooMany: "Tentativas demais. Espere alguns minutos e tente de novo.",
    send: "Me envie um link",
  },
  reset: {
    title: "Definir uma senha nova",
    heading: "Defina uma senha nova.",
    expired: "Este link expirou ou já foi usado.",
    askAgain: "Peça um novo",
    done: "Sua senha foi trocada, e todos os acessos que estavam abertos foram encerrados.",
    signIn: "Entrar",
    label: "Senha nova",
    save: "Definir a senha nova",
  },
  email: {
    confirmed: "está confirmado.",
    notConfirmed: "ainda não está confirmado.",
    thanks:
      "Obrigado. Agora o sintr pode avisar por e-mail quando um relatório estiver pronto, se você pedir isso em Terapia.",
    send: "Enviar o link de confirmação",
    sent: "O link está a caminho. Ele vale por uma hora.",
    failed: "Não foi possível enviar agora. Tente de novo em alguns minutos.",
    why: "Só é preciso para e-mails do sintr, como o aviso de que um relatório está pronto.",
    unavailable: "O e-mail não está configurado neste sintr, então nada é enviado para este endereço.",
  },
  consent: {
    title: "Antes de escrever",
    heading: "Antes de escrever qualquer coisa.",
    lede: "Um diário como este guarda informações de saúde, então a lei pede o seu consentimento específico, e nós também.",
    missing: "Marque a caixa para dar seu consentimento, ou saia.",
    agree: "Concordo, abrir meu diário",
    /** O texto que a pessoa aceita (LGPD art. 11): o mesmo sentido do inglês, sem tirar nem pôr. */
    statement:
      "Concordo que o sintr guarde o que eu escrevo aqui, incluindo coisas sobre a minha saúde mental, para que ele possa manter este diário para mim. Isso é criptografado antes de ser armazenado, não é usado para mais nada e nunca é compartilhado com ninguém, a menos que eu aprove aquele relatório específico.",
    privacy: "Como o sintr trata os seus dados",
  },
} satisfies Messages["auth"];
