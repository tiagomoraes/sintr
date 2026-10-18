import { describe, expect, it } from "vitest";
import {
  DecryptionError,
  ENVELOPE_OVERHEAD,
  ENVELOPE_VERSION,
  createFieldCipher,
  generateDataKey,
  generateMasterKey,
  open,
  parseMasterKey,
  seal,
  unwrapDataKey,
  wrapDataKey,
} from "../src/crypto";

const text = (value: string) => Buffer.from(value, "utf8");

describe("envelope (AES-256-GCM)", () => {
  const key = generateDataKey();

  it("round-trips and produces version, iv, ciphertext and tag", () => {
    const plaintext = text("eu nunca faço nada direito");
    const envelope = seal(key, plaintext, "entries.thoughts/u1");
    expect(envelope[0]).toBe(ENVELOPE_VERSION);
    expect(envelope.byteLength).toBe(plaintext.byteLength + ENVELOPE_OVERHEAD);
    expect(envelope.includes(plaintext)).toBe(false);
    expect(open(key, envelope, "entries.thoughts/u1").toString("utf8")).toBe("eu nunca faço nada direito");
  });

  it("uses a fresh iv every time", () => {
    const a = seal(key, text("same"), "ctx");
    const b = seal(key, text("same"), "ctx");
    expect(a.equals(b)).toBe(false);
  });

  it("refuses a tampered ciphertext", () => {
    const envelope = seal(key, text("situation"), "ctx");
    const at = envelope.byteLength - 20;
    envelope.writeUInt8(envelope.readUInt8(at) ^ 0x01, at);
    expect(() => open(key, envelope, "ctx")).toThrow(DecryptionError);
  });

  it("refuses the wrong context (column or owner)", () => {
    const envelope = seal(key, text("situation"), "entries.situation/user-a");
    expect(() => open(key, envelope, "entries.situation/user-b")).toThrow(DecryptionError);
    expect(() => open(key, envelope, "entries.notes/user-a")).toThrow(DecryptionError);
  });

  it("refuses the wrong key", () => {
    const envelope = seal(key, text("situation"), "ctx");
    expect(() => open(generateDataKey(), envelope, "ctx")).toThrow(DecryptionError);
  });

  it("refuses truncated or unversioned input without leaking it in the message", () => {
    expect(() => open(key, Buffer.alloc(10), "ctx")).toThrow(DecryptionError);
    const envelope = seal(key, text("secret words"), "ctx");
    envelope[0] = 0x02;
    try {
      open(key, envelope, "ctx");
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain("secret");
    }
  });

  it("rejects keys of the wrong size", () => {
    expect(() => seal(Buffer.alloc(16), text("x"), "ctx")).toThrow(RangeError);
  });
});

describe("master key and data keys", () => {
  it("parses a 32-byte base64 master key and rejects anything else", () => {
    const kek = parseMasterKey(generateMasterKey(), "k1");
    expect(kek.key.byteLength).toBe(32);
    expect(() => parseMasterKey(Buffer.alloc(16).toString("base64"), "k1")).toThrow(RangeError);
    expect(() => parseMasterKey("not base64 at all", "k1")).toThrow(RangeError);
    expect(() => parseMasterKey(generateMasterKey(), "Bad Id")).toThrow(RangeError);
  });

  it("wraps a DEK so that only the same KEK and user can unwrap it", () => {
    const kek = parseMasterKey(generateMasterKey(), "k1");
    const dek = generateDataKey();
    const wrapped = wrapDataKey(kek, dek, "user-a");
    expect(wrapped.includes(dek)).toBe(false);
    expect(unwrapDataKey(kek, wrapped, "user-a").equals(dek)).toBe(true);
    expect(() => unwrapDataKey(kek, wrapped, "user-b")).toThrow(DecryptionError);
    const other = parseMasterKey(generateMasterKey(), "k1");
    expect(() => unwrapDataKey(other, wrapped, "user-a")).toThrow(DecryptionError);
    const renamed = { id: "k2", key: kek.key };
    expect(() => unwrapDataKey(renamed, wrapped, "user-a")).toThrow(DecryptionError);
  });
});

describe("field cipher", () => {
  it("binds each value to its column and its owner", () => {
    const dek = generateDataKey();
    const a = createFieldCipher(dek, "user-a");
    const b = createFieldCipher(dek, "user-b");
    const sealed = a.sealText("entries.situation", "a reunião de segunda");
    expect(a.openText("entries.situation", sealed)).toBe("a reunião de segunda");
    expect(() => a.openText("entries.notes", sealed)).toThrow(DecryptionError);
    expect(() => b.openText("entries.situation", sealed)).toThrow(DecryptionError);
  });

  it("round-trips JSON and bytes", () => {
    const cipher = createFieldCipher(generateDataKey(), "user-a");
    const emotions = [{ name: "vergonha", intensity: 80 }];
    expect(cipher.openJson("entries.emotions", cipher.sealJson("entries.emotions", emotions))).toEqual(
      emotions,
    );
    const pdf = Buffer.from("%PDF-1.7 fake");
    expect(cipher.openBytes("reports.pdf", cipher.sealBytes("reports.pdf", pdf)).equals(pdf)).toBe(true);
  });
});
