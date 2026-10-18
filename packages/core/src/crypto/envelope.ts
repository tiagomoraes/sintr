import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM envelope used for every encrypted value in sintr.
 *
 * Layout: [version: 1 byte][iv: 12 bytes][ciphertext][auth tag: 16 bytes]
 *
 * The additional authenticated data (AAD) binds a ciphertext to where it
 * belongs (for example `entries.situation` of one user), so a value copied to
 * another column or another user fails to open instead of decrypting.
 */

export const ENVELOPE_VERSION = 0x01;
export const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const ALGORITHM = "aes-256-gcm";

/** The smallest possible envelope: an empty plaintext. */
export const ENVELOPE_OVERHEAD = 1 + IV_BYTES + TAG_BYTES;

export class DecryptionError extends Error {
  override readonly name = "DecryptionError";
  constructor() {
    // Never include the ciphertext, the key or the context in the message.
    super("ciphertext could not be authenticated");
  }
}

function assertKey(key: Uint8Array): void {
  if (key.byteLength !== KEY_BYTES) {
    throw new RangeError(`encryption key must be ${KEY_BYTES} bytes`);
  }
}

export function seal(key: Uint8Array, plaintext: Uint8Array, aad: string): Buffer {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([Buffer.of(ENVELOPE_VERSION), iv, body, cipher.getAuthTag()]);
}

export function open(key: Uint8Array, envelope: Uint8Array, aad: string): Buffer {
  assertKey(key);
  const bytes = Buffer.from(envelope.buffer, envelope.byteOffset, envelope.byteLength);
  if (bytes.byteLength < ENVELOPE_OVERHEAD || bytes[0] !== ENVELOPE_VERSION) {
    throw new DecryptionError();
  }
  const iv = bytes.subarray(1, 1 + IV_BYTES);
  const tag = bytes.subarray(bytes.byteLength - TAG_BYTES);
  const body = bytes.subarray(1 + IV_BYTES, bytes.byteLength - TAG_BYTES);
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    throw new DecryptionError();
  }
}
