import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config";
import { generateMasterKey } from "../src/crypto";
import {
  EmailError,
  emailOff,
  memoryTransport,
  outboxTransport,
  passwordResetEmail,
  reportEmail,
  reportReadyEmail,
  smtpTransport,
  verificationEmail,
} from "../src/email";

/** nodemailer builds the real MIME message, but in memory: no socket is opened. */
function inMemorySmtp() {
  const raw: string[] = [];
  const builder = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  const capture = {
    sendMail: async (options: Parameters<Transporter["sendMail"]>[0]) => {
      const info = await builder.sendMail(options);
      raw.push((info.message as Buffer).toString("utf8"));
      return info;
    },
  } as unknown as Transporter;
  const transport = smtpTransport(
    {
      kind: "smtp",
      host: "smtp.example.test",
      port: 587,
      security: "starttls",
      user: null,
      password: null,
      from: "sintr <diary@example.test>",
    },
    capture,
  );
  return { transport, raw };
}

const PDF = new Uint8Array(Buffer.from("%PDF-1.7 fake report %%EOF"));

describe("the SMTP transport", () => {
  it("sends the report with its PDF attached, from the configured address", async () => {
    const { transport, raw } = inMemorySmtp();
    await transport.send(
      reportEmail({
        to: "therapist@example.test",
        language: "pt",
        personName: "Pessoa Exemplo",
        session: "segunda, 19/10, 18h",
        pdf: PDF,
        filename: "relatorio-2026-10-19.pdf",
      }),
    );
    expect(raw).toHaveLength(1);
    const message = raw[0]!;
    expect(message).toMatch(/^From: sintr <diary@example\.test>$/mu);
    expect(message).toMatch(/^To: therapist@example\.test$/mu);
    expect(message).toContain("Content-Type: application/pdf");
    expect(message).toContain("filename=relatorio-2026-10-19.pdf");
    expect(message).toContain(Buffer.from(PDF).toString("base64"));
  });

  it("refuses a second recipient or a header smuggled into the subject", async () => {
    const { transport, raw } = inMemorySmtp();
    const base = { subject: "x", text: "x" };
    await expect(transport.send({ ...base, to: "a@example.test, b@example.test" })).rejects.toMatchObject({
      code: "invalid_message",
    });
    await expect(
      transport.send({ ...base, to: "a@example.test\r\nBcc: b@example.test" }),
    ).rejects.toBeInstanceOf(EmailError);
    await expect(
      transport.send({ to: "a@example.test", subject: "hi\r\nBcc: b@example.test", text: "x" }),
    ).rejects.toBeInstanceOf(EmailError);
    expect(raw).toHaveLength(0);
  });

  it("reports a failure as a code, never the server's words", async () => {
    const failing = smtpTransport(
      {
        kind: "smtp",
        host: "smtp.example.test",
        port: 587,
        security: "starttls",
        user: null,
        password: null,
        from: "x@example.test",
      },
      {
        sendMail: async () => Promise.reject(new Error("550 mailbox therapist@example.test unknown")),
      } as unknown as Transporter,
    );
    const error = await failing
      .send({ to: "therapist@example.test", subject: "s", text: "t" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EmailError);
    expect((error as Error).message).not.toContain("therapist@example.test");
  });
});

describe("the other transports", () => {
  it("keeps messages in memory for unit tests, and can fail on purpose", async () => {
    const memory = memoryTransport();
    await memory.send({ to: "a@example.test", subject: "s", text: "t" });
    expect(memory.sent).toHaveLength(1);
    memory.failing = true;
    await expect(memory.send({ to: "a@example.test", subject: "s", text: "t" })).rejects.toMatchObject({
      code: "send_failed",
    });
  });

  it("writes the outbox as private JSON files, attachments included (tests only)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sintr-outbox-"));
    await outboxTransport({ kind: "outbox", dir, from: "sintr <x@example.test>" }).send(
      reportEmail({
        to: "t@example.test",
        language: "en",
        personName: null,
        session: "Monday, 10/19, 18:00",
        pdf: PDF,
        filename: "report.pdf",
      }),
    );
    const [file] = readdirSync(dir);
    expect(statSync(join(dir, file!)).mode & 0o777).toBe(0o600);
    const message = JSON.parse(readFileSync(join(dir, file!), "utf8")) as {
      to: string;
      attachments: { content: string }[];
    };
    expect(message.to).toBe("t@example.test");
    expect(Buffer.from(message.attachments[0]!.content, "base64").toString()).toBe(
      Buffer.from(PDF).toString(),
    );
  });

  it("refuses everything when email is off", async () => {
    expect(emailOff.available).toBe(false);
    await expect(emailOff.send({ to: "a@example.test", subject: "s", text: "t" })).rejects.toMatchObject({
      code: "email_off",
    });
  });
});

describe("the messages", () => {
  const all = [
    reportEmail({
      to: "t@example.test",
      language: "en",
      personName: "Ana",
      session: "Monday",
      pdf: PDF,
      filename: "r.pdf",
    }),
    reportEmail({
      to: "t@example.test",
      language: "pt",
      personName: null,
      session: "segunda",
      pdf: PDF,
      filename: "r.pdf",
    }),
    reportEmail({
      to: "t@example.test",
      language: "es",
      personName: "Ana",
      session: "lunes",
      pdf: PDF,
      filename: "r.pdf",
    }),
    reportReadyEmail({
      to: "p@example.test",
      url: "http://localhost:3000/reports/1",
      session: "Monday, October 19",
    }),
    passwordResetEmail({ to: "p@example.test", url: "http://localhost:3000/api/auth/reset-password/abc" }),
    verificationEmail({ to: "p@example.test", url: "http://localhost:3000/api/auth/verify-email?token=abc" }),
  ];

  it("carry no dashes and no emoji", () => {
    for (const message of all) {
      expect(`${message.subject}\n${message.text}\n${message.html}`).not.toMatch(/[\u2013\u2014\u{1F000}-\u{1FAFF}]/u);
    }
  });

  it("send the person a link and a sentence, never the report's words", () => {
    const ready = all[3]!;
    expect(ready.attachments).toBeUndefined();
    expect(ready.text).toContain("http://localhost:3000/reports/1");
    expect(ready.text).toContain("Nothing has been sent to anyone.");
  });

  it("name the person to the therapist, and fall back gracefully without a name", () => {
    expect(all[0]!.subject).toBe("Weekly report from Ana, Monday");
    expect(all[1]!.subject).toBe("Relatório semanal de Uma pessoa, segunda");
  });
});

describe("email configuration", () => {
  const base = () => ({
    DATABASE_URL: "postgres://sintr:pw@localhost:5432/sintr",
    SINTR_AUTH_SECRET: "a".repeat(48),
    SINTR_MASTER_KEY: generateMasterKey(),
  });

  it("is off by default, and empty values in .env mean unset", () => {
    expect(loadConfig(base()).email).toEqual({ kind: "off" });
    expect(loadConfig({ ...base(), SINTR_SMTP_HOST: "", SINTR_EMAIL_FROM: "" }).email).toEqual({
      kind: "off",
    });
  });

  it("reads an SMTP server from the environment", () => {
    const config = loadConfig({
      ...base(),
      SINTR_SMTP_HOST: "smtp.example.test",
      SINTR_SMTP_PORT: "465",
      SINTR_SMTP_SECURITY: "tls",
      SINTR_SMTP_USER: "diary",
      SINTR_SMTP_PASSWORD: "a-secret-password",
      SINTR_EMAIL_FROM: "sintr <diary@example.test>",
    });
    expect(config.email).toEqual({
      kind: "smtp",
      host: "smtp.example.test",
      port: 465,
      security: "tls",
      user: "diary",
      password: "a-secret-password",
      from: "sintr <diary@example.test>",
    });
  });

  it("needs a sender with a server, and refuses test and plain-text settings in saas mode", () => {
    expect(() => loadConfig({ ...base(), SINTR_SMTP_HOST: "smtp.example.test" })).toThrow(/SINTR_EMAIL_FROM/);
    expect(() => loadConfig({ ...base(), SINTR_MODE: "saas", SINTR_EMAIL_OUTBOX: "/tmp/x" })).toThrow(
      ConfigError,
    );
    expect(() =>
      loadConfig({
        ...base(),
        SINTR_MODE: "saas",
        SINTR_SMTP_HOST: "smtp.example.test",
        SINTR_SMTP_SECURITY: "none",
        SINTR_EMAIL_FROM: "x@example.test",
      }),
    ).toThrow(/SINTR_SMTP_SECURITY/);
  });

  it("never echoes the password in an error", () => {
    let message = "";
    try {
      loadConfig({
        ...base(),
        SINTR_SMTP_HOST: "bad host!",
        SINTR_SMTP_PASSWORD: "a-secret-password",
        SINTR_EMAIL_FROM: "x@example.test",
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("SINTR_SMTP_HOST");
    expect(message).not.toContain("a-secret-password");
  });
});
