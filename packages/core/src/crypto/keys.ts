import { randomBytes } from "node:crypto";
import { KEY_BYTES, open, seal } from "./envelope";

/**
 * The master key encryption key (KEK). It comes from the environment and is
 * only ever used to wrap and unwrap per-user data keys; it never touches
 * content directly.
 */
export interface MasterKey {
  readonly id: string;
  readonly key: Buffer;
}

const BASE64_32_BYTES = /^[A-Za-z0-9+/]{43}=$/;
const KEY_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;

export function parseMasterKey(encoded: string, id: string): MasterKey {
  if (!KEY_ID.test(id)) {
    throw new RangeError("master key id must be 1 to 32 lowercase letters, digits or dashes");
  }
  if (!BASE64_32_BYTES.test(encoded.trim())) {
    throw new RangeError("master key must be 32 random bytes encoded as base64");
  }
  return { id, key: Buffer.from(encoded.trim(), "base64") };
}

export function generateMasterKey(): string {
  return randomBytes(KEY_BYTES).toString("base64");
}

/** A fresh per-user data encryption key (DEK). */
export function generateDataKey(): Buffer {
  return randomBytes(KEY_BYTES);
}

function dekContext(kek: MasterKey, userId: string): string {
  return `sintr/dek/v1/${kek.id}/${userId}`;
}

/** Wrap a user's DEK with the master KEK, bound to that user and KEK id. */
export function wrapDataKey(kek: MasterKey, dek: Uint8Array, userId: string): Buffer {
  if (dek.byteLength !== KEY_BYTES) {
    throw new RangeError(`data key must be ${KEY_BYTES} bytes`);
  }
  return seal(kek.key, dek, dekContext(kek, userId));
}

export function unwrapDataKey(kek: MasterKey, wrapped: Uint8Array, userId: string): Buffer {
  return open(kek.key, wrapped, dekContext(kek, userId));
}
