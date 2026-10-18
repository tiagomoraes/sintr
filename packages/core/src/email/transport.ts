/**
 * Email: one small interface, a few transports.
 *
 * - `smtp`: the self-host transport, configured from the environment
 *   (SINTR_SMTP_*). A managed provider can be another transport later.
 * - `outbox`: tests only. Each message is written as a JSON file to a
 *   directory instead of being sent, so the end-to-end suite can read what
 *   the app would have sent. Refused in saas mode.
 * - `memory`: an in-process fake for unit tests.
 * - `off`: no email configured. Sending refuses; the app says so.
 *
 * A transport never logs: no address, subject, body or link reaches the
 * logs. Errors leave as EmailError with a code.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export interface EmailAttachment {
  filename: string;
  content: Uint8Array;
  contentType: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export type EmailConfig =
  | {
      kind: "smtp";
      host: string;
      port: number;
      /** starttls: upgrade on 587; tls: TLS from the start (465); none: a trusted local relay. */
      security: "starttls" | "tls" | "none";
      user: string | null;
      password: string | null;
      from: string;
    }
  | { kind: "outbox"; dir: string; from: string }
  | { kind: "off" };

export class EmailError extends Error {
  override readonly name = "EmailError";
  readonly code: "email_off" | "send_failed" | "invalid_message";
  constructor(code: EmailError["code"]) {
    super(`email: ${code}`);
    this.code = code;
  }
}

export interface EmailTransport {
  readonly kind: EmailConfig["kind"] | "memory";
  /** Whether sending can work at all. */
  readonly available: boolean;
  send(message: EmailMessage): Promise<void>;
}

const ADDRESS = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/u;

/** A plain address, one recipient, nothing that could add another header. */
export function isEmailAddress(value: string): boolean {
  return value.length <= 320 && ADDRESS.test(value);
}

function checked(message: EmailMessage): EmailMessage {
  if (!isEmailAddress(message.to) || /[\r\n]/u.test(message.subject)) throw new EmailError("invalid_message");
  return message;
}

export function smtpTransport(
  config: Extract<EmailConfig, { kind: "smtp" }>,
  /** For tests: a nodemailer transport that never opens a socket. */
  transporter?: Transporter,
): EmailTransport {
  const mailer =
    transporter ??
    nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.security === "tls",
      requireTLS: config.security === "starttls",
      ignoreTLS: config.security === "none",
      ...(config.user ? { auth: { user: config.user, pass: config.password ?? "" } } : {}),
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 60_000,
      logger: false,
      debug: false,
    });
  return {
    kind: "smtp",
    available: true,
    async send(message) {
      const { to, subject, text, html, attachments } = checked(message);
      try {
        await mailer.sendMail({
          from: config.from,
          to,
          subject,
          text,
          ...(html ? { html } : {}),
          ...(attachments
            ? {
                attachments: attachments.map((a) => ({
                  filename: a.filename,
                  content: Buffer.from(a.content),
                  contentType: a.contentType,
                })),
              }
            : {}),
        });
      } catch {
        // The error can quote the server's reply, which may echo the address.
        throw new EmailError("send_failed");
      }
    },
  };
}

/** Tests only: write each message to `dir` as JSON, never send it. */
export function outboxTransport(config: Extract<EmailConfig, { kind: "outbox" }>): EmailTransport {
  return {
    kind: "outbox",
    available: true,
    async send(message) {
      const { to, subject, text, html, attachments } = checked(message);
      mkdirSync(config.dir, { recursive: true, mode: 0o700 });
      const file = join(config.dir, `${Date.now()}-${randomUUID()}.json`);
      const body = {
        from: config.from,
        to,
        subject,
        text,
        html: html ?? null,
        attachments: (attachments ?? []).map((a) => ({
          filename: a.filename,
          contentType: a.contentType,
          content: Buffer.from(a.content).toString("base64"),
        })),
      };
      writeFileSync(file, JSON.stringify(body), { mode: 0o600 });
    },
  };
}

export interface MemoryTransport extends EmailTransport {
  readonly sent: EmailMessage[];
  /** Make the next sends fail, to test what happens when email is down. */
  failing: boolean;
}

export function memoryTransport(): MemoryTransport {
  const sent: EmailMessage[] = [];
  const transport: MemoryTransport = {
    kind: "memory",
    available: true,
    sent,
    failing: false,
    async send(message) {
      const value = checked(message);
      if (transport.failing) throw new EmailError("send_failed");
      sent.push(value);
    },
  };
  return transport;
}

export const emailOff: EmailTransport = {
  kind: "off",
  available: false,
  async send() {
    throw new EmailError("email_off");
  },
};

export function createEmailTransport(config: EmailConfig): EmailTransport {
  switch (config.kind) {
    case "smtp":
      return smtpTransport(config);
    case "outbox":
      return outboxTransport(config);
    case "off":
      return emailOff;
  }
}
