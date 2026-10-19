import { randomInt } from "node:crypto";

/**
 * Invite codes: 12 characters of Crockford's base32 (60 bits), shown as
 * XXXX-XXXX-XXXX so they can be read aloud or typed from a message. The
 * alphabet has no I, L, O or U; what a person types is forgiven for case,
 * spaces and dashes, and I, L and O read as 1, 1 and 0.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const LENGTH = 12;

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < LENGTH; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** The canonical form (12 characters, no dashes), or null when it cannot be a code. */
export function normalizeInviteCode(input: string): string | null {
  if (input.length > 64) return null;
  const folded = input
    .toUpperCase()
    .replace(/[\s-]+/gu, "")
    .replace(/[IL]/gu, "1")
    .replace(/O/gu, "0");
  if (folded.length !== LENGTH) return null;
  for (const char of folded) if (!ALPHABET.includes(char)) return null;
  return folded;
}

/** XXXX-XXXX-XXXX. */
export function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}
