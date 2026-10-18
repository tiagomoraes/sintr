import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, inject, it } from "vitest";
import { createAuth } from "../src/auth/create-auth";
import { loadConfig } from "../src/config";
import { generateMasterKey } from "../src/crypto";
import { users } from "../src/db/schema";
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

describe("email verification", () => {
  it("sends a link on sign-up that verifies the address", async () => {
    const to = address();
    const sent = email.sent.length;
    const { user } = await signUp(to);
    const message = email.sent.at(-1)!;
    expect(email.sent.length).toBe(sent + 1);
    expect(message.to).toBe(to);
    const link = linkIn(message.text);
    expect(link.origin).toBe(config.url.origin);
    expect(link.pathname).toBe("/api/auth/verify-email");

    await auth.api.verifyEmail({ query: { token: link.searchParams.get("token")! } });
    const [row] = await handle.db.select().from(users).where(eq(users.id, user.id));
    expect(row?.emailVerified).toBe(true);
  });
});

describe("password reset", () => {
  it("emails a link whose token sets a new password, and the old one stops working", async () => {
    const to = address();
    await signUp(to);
    const before = email.sent.length;
    await auth.api.requestPasswordReset({ body: { email: to, redirectTo: "/reset-password" } });
    expect(email.sent.length).toBe(before + 1);
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
    expect(email.sent.length).toBe(before + 2); // the sign-up's verification and the known reset only
  });

  it("does not tell the browser when the email could not be sent", async () => {
    const to = address();
    await signUp(to);
    email.failing = true;
    try {
      await expect(
        auth.api.requestPasswordReset({ body: { email: to, redirectTo: "/reset-password" } }),
      ).resolves.toBeTruthy();
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
