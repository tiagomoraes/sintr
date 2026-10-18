import { hash, verify, type Algorithm, type Options } from "@node-rs/argon2";

/**
 * Argon2id with the OWASP baseline (19 MiB, 2 passes, 1 lane). Parameters are
 * stored in each PHC string, so raising them later keeps old hashes valid.
 */
const ARGON2ID = 2 as Algorithm;

export const PASSWORD_HASH_OPTIONS: Readonly<Options> = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, PASSWORD_HASH_OPTIONS);
}

export async function verifyPassword({
  hash: encoded,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  if (!encoded.startsWith("$argon2id$")) return false;
  try {
    return await verify(encoded, password);
  } catch {
    return false;
  }
}
