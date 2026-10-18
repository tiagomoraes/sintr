import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { inject } from "vitest";
import { createAuth } from "../src/auth/create-auth";
import { loadConfig } from "../src/config";
import { generateMasterKey } from "../src/crypto";
import { accounts, auditLog, consents, profiles, sessions, userKeys, users } from "../src/db/schema";
import { HEALTH_DATA_CONSENT_VERSION } from "../src/domain";
import { createLogger } from "../src/log";
import { openTestDatabase } from "./support";

const handle = openTestDatabase();
const config = loadConfig({
  DATABASE_URL: inject("databaseUrl"),
  SINTR_AUTH_SECRET: randomUUID() + randomUUID(),
  SINTR_MASTER_KEY: generateMasterKey(),
});
const auth = createAuth({ db: handle.db, config, logger: createLogger({ level: "error" }) });
const password = "a long enough password";
/** The sign-up form sends this flag; Better Auth types do not know it. */
const withConsent: Record<string, unknown> = { consent: true };

afterAll(() => handle.close());

function email() {
  return `person-${randomUUID()}@example.test`;
}

async function signUp(address: string, extra: Record<string, unknown> = { consent: true }) {
  return auth.api.signUpEmail({ body: { email: address, password, name: "Ana Clara", ...extra } });
}

describe("sign up", () => {
  it("creates the user with Argon2id, a wrapped key, a profile and a recorded consent", async () => {
    const address = email();
    const result = await signUp(address);
    const userId = result.user.id;

    const [user] = await handle.db.select().from(users).where(eq(users.id, userId));
    expect(user?.email).toBe(address);
    expect(user?.name, "minimisation: no name in the auth table").toBe("");

    const [account] = await handle.db.select().from(accounts).where(eq(accounts.userId, userId));
    expect(account?.password).toMatch(/^\$argon2id\$/);

    expect(await handle.db.select().from(userKeys).where(eq(userKeys.userId, userId))).toHaveLength(1);
    expect(await handle.db.select().from(profiles).where(eq(profiles.userId, userId))).toHaveLength(1);

    const [consent] = await handle.db.select().from(consents).where(eq(consents.userId, userId));
    expect(consent).toMatchObject({
      purpose: "health_data_processing",
      granted: true,
      version: HEALTH_DATA_CONSENT_VERSION,
    });

    const actions = (await handle.db.select().from(auditLog).where(eq(auditLog.userId, userId))).map(
      (e) => e.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining(["account.created", "consent.recorded", "session.created"]),
    );
  });

  it("refuses to create an account without the health data consent", async () => {
    const address = email();
    await expect(signUp(address, {})).rejects.toThrow(/consent_required/);
    await expect(signUp(address, { consent: "yes" })).rejects.toThrow(/consent_required/);
    expect(await handle.db.select().from(users).where(eq(users.email, address))).toHaveLength(0);
  });

  it("refuses short passwords", async () => {
    await expect(
      auth.api.signUpEmail({ body: { email: email(), password: "short", name: "", ...withConsent } }),
    ).rejects.toThrow();
  });
});

describe("sign in and sessions", () => {
  it("issues a new session on every sign-in and resolves it from the cookie", async () => {
    const address = email();
    await signUp(address);
    const first = await auth.api.signInEmail({ body: { email: address, password }, returnHeaders: true });
    const second = await auth.api.signInEmail({ body: { email: address, password }, returnHeaders: true });
    expect(first.response.token).not.toBe(second.response.token);

    const cookie = first.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("sintr.session_token=");
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");

    const session = await auth.api.getSession({ headers: new Headers({ cookie: cookie.split(";")[0]! }) });
    expect(session?.user.email).toBe(address);
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const address = email();
    await signUp(address);
    const wrong = await auth.api
      .signInEmail({ body: { email: address, password: "not the password at all" } })
      .catch((e: Error) => e);
    const unknown = await auth.api.signInEmail({ body: { email: email(), password } }).catch((e: Error) => e);
    expect(wrong).toBeInstanceOf(Error);
    expect(unknown).toBeInstanceOf(Error);
    expect((wrong as Error).message).toBe((unknown as Error).message);
  });

  it("revokes the session on sign-out", async () => {
    const address = email();
    await signUp(address);
    const signIn = await auth.api.signInEmail({ body: { email: address, password }, returnHeaders: true });
    const cookie = (signIn.headers.get("set-cookie") ?? "").split(";")[0]!;
    await auth.api.signOut({ headers: new Headers({ cookie }) });
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull();
    expect(
      await handle.db.select().from(sessions).where(eq(sessions.token, signIn.response.token)),
    ).toHaveLength(0);
  });
});

describe("closed sign-up", () => {
  it("refuses new accounts when SINTR_SIGNUP is closed", async () => {
    const closed = createAuth({
      db: handle.db,
      config: { ...config, signup: "closed" },
      logger: createLogger({ level: "error" }),
    });
    await expect(
      closed.api.signUpEmail({ body: { email: email(), password, name: "", ...withConsent } }),
    ).rejects.toThrow();
  });
});
