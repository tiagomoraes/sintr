import "server-only";
import { accessOf, type UserScope } from "@sintr/core";
import type { KeyView } from "@/components/connect/key-list";
import { isQuiet, lastTalkedText } from "@/lib/connect";
import { formatDay } from "@/lib/format";
import { currentLanguage, getMessages } from "@/lib/server/language";

/** The person's keys that still work, as the Connect screen and Settings show them, in the page's language. */
export async function workingKeys(scope: UserScope, now: Date = new Date()): Promise<KeyView[]> {
  const [keys, profile, t, language] = await Promise.all([
    scope.apiTokens.list(),
    scope.profile.get(),
    getMessages(),
    currentLanguage(),
  ]);
  const locale = { language: language.code, timezone: profile.timezone };
  return keys
    .filter((key) => key.revokedAt === null && (key.expiresAt === null || key.expiresAt > now))
    .map((key) => {
      const access = accessOf(key.scopes);
      return {
        id: key.id,
        name: key.name,
        access: access ? t.connect.access[access].label : t.connect.keys.canUse(key.scopes.join(", ")),
        accessKnown: access !== null,
        lastTalked: lastTalkedText(key, now, locale, t),
        used: key.lastUsedAt !== null,
        made: formatDay(key.createdAt, locale),
        prefix: key.tokenPrefix,
        quiet: isQuiet(key, now),
      };
    });
}
