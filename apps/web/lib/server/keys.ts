import "server-only";
import { accessOf, type UserScope } from "@sintr/core";
import type { KeyView } from "@/components/connect/key-list";
import { ACCESS_COPY, lastTalkedText } from "@/lib/connect";
import { formatDay } from "@/lib/format";

/** The person's keys that still work, as the Connect screen and Settings show them. */
export async function workingKeys(scope: UserScope, now: Date = new Date()): Promise<KeyView[]> {
  const [keys, profile] = await Promise.all([scope.apiTokens.list(), scope.profile.get()]);
  const locale = { language: "en-GB", timezone: profile.timezone };
  return keys
    .filter((key) => key.revokedAt === null && (key.expiresAt === null || key.expiresAt > now))
    .map((key) => {
      const access = accessOf(key.scopes);
      return {
        id: key.id,
        name: key.name,
        access: access ? ACCESS_COPY[access].label : `Can use: ${key.scopes.join(", ")}`,
        lastTalked: lastTalkedText(key, now, profile.timezone),
        used: key.lastUsedAt !== null,
        made: formatDay(key.createdAt, locale),
        prefix: key.tokenPrefix,
      };
    });
}
