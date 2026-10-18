import { pgTable, text } from "drizzle-orm/pg-core";
import { bytea, createdAt } from "../columns";
import { users } from "./auth";

/**
 * One data encryption key (DEK) per user, stored only in wrapped form: sealed
 * with the master key (KEK) named by `kek_id`, bound to the user's id.
 */
export const userKeys = pgTable("user_keys", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  kekId: text("kek_id").notNull(),
  wrappedDek: bytea("wrapped_dek").notNull(),
  createdAt: createdAt(),
});
