import { z } from "zod";
import type { FieldCipher } from "../crypto";
import type { Executor } from "../db/client";

/**
 * What every repository is built from: an executor, the one user it may read
 * and write, and that user's field cipher. There is no unscoped variant.
 */
export interface ScopeContext {
  readonly db: Executor;
  readonly userId: string;
  readonly cipher: FieldCipher;
}

const UUID = z.uuid();

/** Ids that cannot exist are answered with "not found", not a driver error. */
export function isId(value: string): boolean {
  return UUID.safeParse(value).success;
}
