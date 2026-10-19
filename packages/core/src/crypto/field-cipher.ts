import { hkdfSync } from "node:crypto";
import { KEY_BYTES, open, seal } from "./envelope";

/**
 * Encrypts and decrypts the sensitive fields of one user with that user's
 * data key. Every value is bound to its column (`table.column`) and its owner.
 */
export interface FieldCipher {
  readonly userId: string;
  sealText(column: string, value: string): Buffer;
  openText(column: string, envelope: Uint8Array): string;
  sealJson(column: string, value: unknown): Buffer;
  openJson(column: string, envelope: Uint8Array): unknown;
  sealBytes(column: string, value: Uint8Array): Buffer;
  openBytes(column: string, envelope: Uint8Array): Buffer;
  /**
   * A key for one purpose (such as `memories.embedding`), derived from the
   * data key with HKDF: as secret as the data key, and useless for anything
   * else. Never stored.
   */
  deriveKey(purpose: string): Buffer;
}

function fieldContext(column: string, userId: string): string {
  return `sintr/field/v1/${column}/${userId}`;
}

export function createFieldCipher(dek: Uint8Array, userId: string): FieldCipher {
  const key = Buffer.from(dek);
  return {
    userId,
    sealText: (column, value) => seal(key, Buffer.from(value, "utf8"), fieldContext(column, userId)),
    openText: (column, envelope) => open(key, envelope, fieldContext(column, userId)).toString("utf8"),
    sealJson: (column, value) =>
      seal(key, Buffer.from(JSON.stringify(value), "utf8"), fieldContext(column, userId)),
    openJson: (column, envelope) =>
      JSON.parse(open(key, envelope, fieldContext(column, userId)).toString("utf8")) as unknown,
    sealBytes: (column, value) => seal(key, value, fieldContext(column, userId)),
    openBytes: (column, envelope) => open(key, envelope, fieldContext(column, userId)),
    deriveKey: (purpose) =>
      Buffer.from(hkdfSync("sha256", key, userId, `sintr/derived/v1/${purpose}`, KEY_BYTES)),
  };
}
