import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, inject, it, vi } from "vitest";
import { createAuth } from "../src/auth/create-auth";
import { loadConfig } from "../src/config";
import { generateMasterKey } from "../src/crypto";
import { profiles, users } from "../src/db/schema";
import { memoryTransport } from "../src/email";
import { createLogger } from "../src/log";
import { openTestDatabase } from "./support";

/**
 * Password reset and email verification, which F0 left closed until there
 * was an email transport. The transport here is the in-process fake: no
 * network. The links reach the person's inbox and nowhere else: not the
 * logs, not the browser's response.
 */

const handle = openTestDatabase();
const config = loadConfig({
  DATABASE_URL: inject("databaseUrl"),
  SINTR_AUTH_SECRET: randomUUID() + randomUUID(),
  SINTR_MASTER_KEY: generateMasterKey(),
});
const lines: string[] = [];
const logger = createLogger({ level: "debug", write: (_level, line) => lines.push(line) });
const email = memoryTransport();
const auth = createAuth({ db: handle.db, config, logger, email });
const closed = createAuth({ db: handle.db, config, logger: createLogger({ level: "error" }) });
// As the web reads a request's language: a chosen one in a cookie, else the browser's.
const speaking = createAuth({
  db: handle.db,
  config,
  logger,
  email,
  languageFor: async (headers) => {
    const chosen = /sintr_language=([\w-]+)/u.exec(headers.get("cookie") ?? "")?.[1];
    if (chosen) return { code: chosen, chosen: true };
    return { code: headers.get("accept-language")?.startsWith("pt") ? "pt-BR" : "en", chosen: false };
  },
});
const password = "a long enough password";

afterAll(() => handle.close());

function address() {
  return `person-${randomUUID()}@example.test`;
}

function linkIn(text: string): URL {
  const match = /https?:\/\/\S+/u.exec(text);
  expect(match, "a link in the message").not.toBeNull();
  return new URL(match![0]);
}

async function signUp(to: string) {
  return auth.api.signUpEmail({ body: { email: to, password, name: "", consent: true } as never });
}

/** Emails leave after the answer (finding the person's language first), so the tests wait for them. */
async function sentAfter(count: number, more = 1) {
  await vi.waitFor(() => expect(email.sent.length).toBe(count + more));
}

describe("email verification", () => {
  it("sends a link on sign-up that verifies the address", async () => {
    const to = address();
    const sent = email.sent.length;
    const { user } = await signUp(to);
    await sentAfter(sent);
    const message = email.sent.at(-1)!;
    expect(message.to).toBe(to);
    const link = linkIn(message.text);
    expect(link.origin).toBe(config.url.origin);
    expect(link.pathname).toBe("/api/auth/verify-email");

    await auth.api.verifyEmail({ query: { token: link.searchParams.get("token")! } });
    const [row] = await handle.db.select().from(users).where(eq(users.id, user.id));
    expect(row?.emailVerified).toBe(true);
    expect(message.subject).toBe("Confirm your email for sintr");
  });

  it("writes in the language the sign-up was read in, and keeps a language chosen on the way", async () => {
    // Through the handler, as a browser reaches it: the request carries its headers to the email.
    const post = (path: string, body: unknown, headers: Record<string, string>) =>
      speaking.handler(
        new Request(`${config.url.origin}/api/auth${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: config.url.origin, ...headers },
          body: JSON.stringify(body),
        }),
      );
    const profileOf = async (email: string) => {
      const [user] = await handle.db.select().from(users).where(eq(users.email, email));
      const [row] = await handle.db.select().from(profiles).where(eq(profiles.userId, user!.id));
      return row;
    };

    const browser = address();
    let sent = email.sent.length;
    const first = await post(
      "/sign-up/email",
      { email: browser, password, name: "", consent: true },
      { "accept-language": "pt-BR,pt;q=0.9" },
    );
    expect(first.status).toBe(200);
    await sentAfter(sent);
    expect(email.sent.at(-1)!.subject).toBe("Confirme seu e-mail no sintr");
    await vi.waitFor(async () =>
      expect(await profileOf(browser)).toMatchObject({ seenLocale: "pt-BR", locale: null }),
    );

    const chooser = address();
    sent = email.sent.length;
    await post(
      "/sign-up/email",
      { email: chooser, password, name: "", consent: true },
      { "accept-language": "en-US", cookie: "sintr_language=pt-BR" },
    );
    await sentAfter(sent);
    expect(email.sent.at(-1)!.subject).toBe("Confirme seu e-mail no sintr");
    await vi.waitFor(async () =>
      expect(await profileOf(chooser)).toMatchObject({ seenLocale: "pt-BR", locale: "pt-BR" }),
    );

    // A reset asked for later follows the language the page asking for it is read in.
    sent = email.sent.length;
    await post(
      "/request-password-reset",
      { email: browser, redirectTo: "/reset-password" },
      { "accept-language": "en" },
    );
    await sentAfter(sent);
    expect(email.sent.at(-1)!.subject).toBe("Set a new password for your sintr diary");
    // Without a request (sintr asking for itself), the profile decides.
    sent = email.sent.length;
    await speaking.api.requestPasswordReset({ body: { email: chooser, redirectTo: "/reset-password" } });
    await sentAfter(sent);
    expect(email.sent.at(-1)!.subject).toBe("Crie uma nova senha para o seu diário no sintr");
  });
});

describe("an email whose language cannot be found", () => {
  it("still goes, in the installation's language", async () => {
    const lost = createAuth({
      db: handle.db,
      config,
      logger,
      email,
      languageFor: async () => {
        throw new Error("the profile could not be read");
      },
    });
    const to = address();
    const signedUp = email.sent.length;
    await signUp(to);
    await sentAfter(signedUp);
    const before = email.sent.length;
    const response = await lost.handler(
      new Request(`${config.url.origin}/api/auth/request-password-reset`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: config.url.origin,
          "accept-language": "pt-BR",
        },
        body: JSON.stringify({ email: to, redirectTo: "/reset-password" }),
      }),
    );
    expect(response.status).toBe(200);
    await sentAfter(before);
    expect(email.sent.at(-1)!.subject).toBe("Set a new password for your sintr diary");
  });
});

describe("password reset", () => {
  it("emails a link whose token sets a new password, and the old one stops working", async () => {
    const to = address();
    const signedUp = email.sent.length;
    await signUp(to);
    await sentAfter(signedUp);
    const before = email.sent.length;
    await auth.api.requestPasswordReset({ body: { email: to, redirectTo: "/reset-password" } });
    await sentAfter(before);
    const message = email.sent.at(-1)!;
    expect(message.to).toBe(to);
    const link = linkIn(message.text);
    const token = link.pathname.split("/").at(-1)!;
    expect(link.pathname).toBe(`/api/auth/reset-password/${token}`);

    await auth.api.resetPassword({ body: { newPassword: "another long password", token } });
    await expect(auth.api.signInEmail({ body: { email: to, password } })).rejects.toThrow();
    const signedIn = await auth.api.signInEmail({ body: { email: to, password: "another long password" } });
    expect(signedIn.user.email).toBe(to);
  });

  it("answers the same for an unknown address, and sends nothing", async () => {
    const before = email.sent.length;
    const known = address();
    await signUp(known);
    const forKnown = await auth.api.requestPasswordReset({
      body: { email: known, redirectTo: "/reset-password" },
    });
    const forUnknown = await auth.api.requestPasswordReset({
      body: { email: address(), redirectTo: "/reset-password" },
    });
    expect(forUnknown).toEqual(forKnown);
    await sentAfter(before, 2); // the sign-up's verification and the known reset only
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(email.sent.length).toBe(before + 2);
  });

  it("does not tell the browser when the email could not be sent", async () => {
    const to = address();
    const sent = email.sent.length;
    await signUp(to);
    await sentAfter(sent);
    const failures = () => lines.filter((line) => line.includes("auth.email_failed")).length;
    const failed = failures();
    email.failing = true;
    try {
      await expect(
        auth.api.requestPasswordReset({ body: { email: to, redirectTo: "/reset-password" } }),
      ).resolves.toBeTruthy();
      await vi.waitFor(() => expect(failures()).toBe(failed + 1));
    } finally {
      email.failing = false;
    }
  });

  it("is closed when there is no email transport", async () => {
    const response = await closed.handler(
      new Request(`${config.url.origin}/api/auth/request-password-reset`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: config.url.origin },
        body: JSON.stringify({ email: address(), redirectTo: "/reset-password" }),
      }),
    );
    expect(response.status).toBe(404);
  });
});

describe("the logs", () => {
  it("never hold a link, a token or an address", () => {
    const logged = lines.join("\n");
    expect(logged).toContain("auth.email_sent");
    expect(logged).not.toMatch(/https?:\/\//u);
    expect(logged).not.toMatch(/@example\.test/u);
    for (const message of email.sent) {
      const link = linkIn(message.text);
      const token = link.searchParams.get("token") ?? link.pathname.split("/").at(-1)!;
      expect(logged).not.toContain(token);
    }
  });
});
