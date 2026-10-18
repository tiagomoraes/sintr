import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/auth/password";

describe("password hashing", () => {
  it("uses Argon2id with the OWASP baseline parameters", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(hash).not.toContain("correct horse");
  });

  it("verifies the right password and refuses a wrong one", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword({ hash, password: "correct horse battery staple" })).toBe(true);
    expect(await verifyPassword({ hash, password: "correct horse battery stapler" })).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same password")).not.toBe(await hashPassword("same password"));
  });

  it("refuses hashes of any other scheme", async () => {
    expect(await verifyPassword({ hash: "scrypt:abc:def", password: "x" })).toBe(false);
    expect(await verifyPassword({ hash: "$argon2id$garbage", password: "x" })).toBe(false);
  });
});
