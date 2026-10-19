/**
 * The emails sintr sends, and nothing else. None of them carries diary
 * content in its text: the report to the therapist travels as the PDF the
 * person approved, and every other message holds a link and a sentence.
 * Copy is plain: no dashes, no emoji, no tracking.
 */
import type { ReportLanguage } from "../report/content";
import type { EmailMessage } from "./transport";

function html(paragraphs: string[], link?: { href: string; label: string }): string {
  const esc = (t: string) =>
    t.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${esc(p)}</p>`).join("");
  const button = link
    ? `<p style="margin:24px 0"><a href="${esc(link.href)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#16171a;color:#ffffff;text-decoration:none;font-weight:500">${esc(link.label)}</a></p><p style="margin:0 0 16px;color:#6b6e75;font-size:13px">${esc(link.href)}</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:32px 20px;background:#ffffff;color:#16171a;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6"><div style="max-width:520px">${body}${button}<p style="margin:32px 0 0;color:#6b6e75;font-size:13px">sintr</p></div></body></html>`;
}

const THERAPIST_COPY: Record<
  ReportLanguage,
  { subject: (who: string, session: string) => string; body: (who: string, session: string) => string[] }
> = {
  en: {
    subject: (who, session) => `Weekly report from ${who}, ${session}`,
    body: (who, session) => [
      `${who} is sharing their weekly report with you for the session on ${session}. It is attached as a PDF.`,
      "They reviewed it and approved sending it to this address. It was prepared from their own records with the help of a personal assistant; it is not a clinical assessment and is not monitored in real time.",
    ],
  },
  pt: {
    subject: (who, session) => `Relatório semanal de ${who}, ${session}`,
    body: (who, session) => [
      `${who} compartilha com você o relatório semanal para a sessão de ${session}. Ele está anexado em PDF.`,
      "A pessoa revisou o relatório e aprovou o envio para este endereço. Ele foi preparado a partir dos próprios registros, com a ajuda de um assistente pessoal; não é uma avaliação clínica e não é acompanhado em tempo real.",
    ],
  },
  es: {
    subject: (who, session) => `Informe semanal de ${who}, ${session}`,
    body: (who, session) => [
      `${who} comparte contigo su informe semanal para la sesión del ${session}. Va adjunto en PDF.`,
      "La persona lo revisó y aprobó el envío a esta dirección. Se preparó a partir de sus propios registros, con la ayuda de un asistente personal; no es una evaluación clínica y no se sigue en tiempo real.",
    ],
  },
};

const SOMEONE: Record<ReportLanguage, string> = { en: "Someone", pt: "Uma pessoa", es: "Una persona" };

/** The approved report, to the therapist, with the approved PDF attached. */
export function reportEmail(input: {
  to: string;
  language: ReportLanguage;
  personName: string | null;
  /** The session, as the report prints it. */
  session: string;
  pdf: Uint8Array;
  filename: string;
}): EmailMessage {
  const copy = THERAPIST_COPY[input.language];
  const who = input.personName?.trim() || SOMEONE[input.language];
  const paragraphs = copy.body(who, input.session);
  return {
    to: input.to,
    subject: copy.subject(who, input.session),
    text: `${paragraphs.join("\n\n")}\n\nsintr\n`,
    html: html(paragraphs),
    attachments: [{ filename: input.filename, content: input.pdf, contentType: "application/pdf" }],
  };
}

/**
 * The words of the emails a person or a professional receives about their
 * own account, in the language sintr speaks to them in (DECISIONS 98). The
 * languages sintr has them in; any other gets English.
 */
interface AccountCopy {
  ready: {
    subject: string;
    body: (session: string | null) => string[];
    link: string;
  };
  reset: { subject: string; body: string[]; link: string };
  verify: { subject: string; body: string[]; link: string };
  practice: {
    subject: (count: number) => string;
    body: (count: number) => string[];
    link: string;
  };
  /** How the session's date is written. */
  dates: string;
}

const ACCOUNT_COPY: Partial<Record<string, AccountCopy>> & { en: AccountCopy } = {
  en: {
    ready: {
      subject: "Your report is ready to read",
      body: (session) => [
        session
          ? `Your report for the session on ${session} is ready to read.`
          : "Your weekly report is ready to read.",
        "Nothing has been sent to anyone. It waits for you to read it, change what you want, and approve it.",
      ],
      link: "Read the report",
    },
    reset: {
      subject: "Set a new password for your sintr diary",
      body: [
        "Someone asked to set a new password for the sintr diary of this address. If it was you, open the link below within an hour.",
        "If it was not you, ignore this message: your password stays as it is.",
      ],
      link: "Set a new password",
    },
    verify: {
      subject: "Confirm your email for sintr",
      body: [
        "Confirm that this address is yours, so sintr can write to it when a report is ready. Open the link below within an hour.",
        "If you did not create a sintr diary, ignore this message.",
      ],
      link: "Confirm this address",
    },
    practice: {
      subject: (count) =>
        count === 1 ? "A report was shared with you" : `${count} reports were shared with you`,
      body: (count) => [
        count === 1
          ? "A person you see shared a report with your practice on sintr."
          : `People you see shared ${count} reports with your practice on sintr.`,
        "It waits for you in your practice. This email says nothing about who shared it or what it says.",
      ],
      link: "Open your practice",
    },
    dates: "en-GB",
  },
  pt: {
    ready: {
      subject: "Seu relatório está pronto para ler",
      body: (session) => [
        session
          ? `Seu relatório para a sessão de ${session} está pronto para ler.`
          : "Seu relatório da semana está pronto para ler.",
        "Nada foi enviado a ninguém. Ele espera você ler, mudar o que quiser e aprovar.",
      ],
      link: "Ler o relatório",
    },
    reset: {
      subject: "Crie uma nova senha para o seu diário no sintr",
      body: [
        "Alguém pediu para criar uma nova senha para o diário sintr deste endereço. Se foi você, abra o link abaixo em até uma hora.",
        "Se não foi você, ignore esta mensagem: sua senha continua a mesma.",
      ],
      link: "Criar uma nova senha",
    },
    verify: {
      subject: "Confirme seu e-mail no sintr",
      body: [
        "Confirme que este endereço é seu, para que o sintr possa escrever para você quando um relatório estiver pronto. Abra o link abaixo em até uma hora.",
        "Se você não criou um diário no sintr, ignore esta mensagem.",
      ],
      link: "Confirmar este endereço",
    },
    practice: {
      subject: (count) =>
        count === 1
          ? "Um relatório foi compartilhado com você"
          : `${count} relatórios foram compartilhados com você`,
      body: (count) => [
        count === 1
          ? "Uma pessoa que você atende compartilhou um relatório com o seu consultório no sintr."
          : `Pessoas que você atende compartilharam ${count} relatórios com o seu consultório no sintr.`,
        count === 1
          ? "Ele espera por você no seu consultório. Este e-mail não diz quem compartilhou nem o que o relatório diz."
          : "Eles esperam por você no seu consultório. Este e-mail não diz quem compartilhou nem o que os relatórios dizem.",
      ],
      link: "Abrir o seu consultório",
    },
    dates: "pt-BR",
  },
};

/** The copy for a language tag (pt-BR, en, es...): by its language, English when sintr has none. */
export function accountCopy(language: string | null | undefined): AccountCopy {
  const base = (language ?? "").toLowerCase().split(/[-_]/u)[0] ?? "";
  return ACCOUNT_COPY[base] ?? ACCOUNT_COPY.en;
}

/** To the person: a report is ready to read. A link only, never its words. */
export function reportReadyEmail(input: {
  to: string;
  url: string;
  /** The session, already written in the email's language. */
  session: string | null;
  language?: string | null;
}): EmailMessage {
  const copy = accountCopy(input.language).ready;
  const paragraphs = copy.body(input.session);
  return {
    to: input.to,
    subject: copy.subject,
    text: `${paragraphs.join("\n\n")}\n\n${input.url}\n\nsintr\n`,
    html: html(paragraphs, { href: input.url, label: copy.link }),
  };
}

export function passwordResetEmail(input: {
  to: string;
  url: string;
  language?: string | null;
}): EmailMessage {
  const copy = accountCopy(input.language).reset;
  return {
    to: input.to,
    subject: copy.subject,
    text: `${copy.body.join("\n\n")}\n\n${input.url}\n\nsintr\n`,
    html: html(copy.body, { href: input.url, label: copy.link }),
  };
}

export function verificationEmail(input: {
  to: string;
  url: string;
  language?: string | null;
}): EmailMessage {
  const copy = accountCopy(input.language).verify;
  return {
    to: input.to,
    subject: copy.subject,
    text: `${copy.body.join("\n\n")}\n\n${input.url}\n\nsintr\n`,
    html: html(copy.body, { href: input.url, label: copy.link }),
  };
}

/**
 * To a professional who asked for it: reports arrived in their practice. A
 * link and a count only; never who shared them or what they say.
 */
export function practiceReportEmail(input: {
  to: string;
  url: string;
  count: number;
  language?: string | null;
}): EmailMessage {
  const copy = accountCopy(input.language).practice;
  const paragraphs = copy.body(input.count);
  return {
    to: input.to,
    subject: copy.subject(input.count),
    text: `${paragraphs.join("\n\n")}\n\n${input.url}\n\nsintr\n`,
    html: html(paragraphs, { href: input.url, label: copy.link }),
  };
}
