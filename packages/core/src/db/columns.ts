import { customType, timestamp } from "drizzle-orm/pg-core";

/**
 * Raw bytes. Used for sealed (encrypted) content and for wrapped keys.
 * Whether a bytea column is sealed content or key material is declared in
 * `sealed.ts`; a test fails if a bytea column is neither.
 */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
  toDriver: (value) => value,
  fromDriver: (value) => Buffer.from(value),
});

export const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
