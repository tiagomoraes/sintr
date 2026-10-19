import type { z } from "zod";
import { BillingError } from "./billing/stripe";
import { DecryptionError } from "./crypto";

/**
 * Errors that cross the core boundary. Messages name what failed, never the
 * values involved, so they are safe to log and to show.
 */

export class NotFoundError extends Error {
  override readonly name = "NotFoundError";
  constructor(what: string) {
    super(`${what} not found`);
  }
}

export class ValidationError extends Error {
  override readonly name = "ValidationError";
  readonly fields: string[];
  constructor(fields: string[]) {
    super(`invalid input: ${fields.join(", ") || "value"}`);
    this.fields = fields;
  }
}

export class ConsentRequiredError extends Error {
  override readonly name = "ConsentRequiredError";
  constructor(purpose: string) {
    super(`a recorded consent is required: ${purpose}`);
  }
}

export class InvalidStateError extends Error {
  override readonly name = "InvalidStateError";
}

/** A database failure, reduced to its SQLSTATE and constraint name. */
export class DataAccessError extends Error {
  override readonly name = "DataAccessError";
  readonly code: string;
  readonly constraint: string | undefined;
  constructor(code: string, constraint?: string) {
    super(constraint ? `database error ${code} on ${constraint}` : `database error ${code}`);
    this.code = code;
    this.constraint = constraint;
  }
}

const KNOWN = [
  NotFoundError,
  ValidationError,
  ConsentRequiredError,
  InvalidStateError,
  DataAccessError,
  DecryptionError,
  BillingError,
];

function findPostgresError(error: unknown): { code?: unknown; constraint_name?: unknown } | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if ((current as { name?: unknown }).name === "PostgresError") {
      return current;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

/**
 * Replace driver errors (whose messages quote SQL parameters and row values)
 * with a DataAccessError. Known core errors pass through unchanged.
 */
export function sanitizeError(error: unknown): Error {
  if (KNOWN.some((type) => error instanceof type)) return error as Error;
  const pg = findPostgresError(error);
  if (pg) {
    return new DataAccessError(
      typeof pg.code === "string" ? pg.code : "unknown",
      typeof pg.constraint_name === "string" ? pg.constraint_name : undefined,
    );
  }
  return new DataAccessError("internal");
}

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((issue) => issue.path.join(".") || "value"));
  }
  return result.data;
}
