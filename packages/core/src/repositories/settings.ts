import { eq } from "drizzle-orm";
import { SEALED, openValues, sealValues } from "../db/sealed";
import { profiles, therapySettings } from "../db/schema";
import { ProfilePatch, TherapySettingsPatch, type Profile, type TherapySettings } from "../domain";
import { parseInput } from "../errors";
import type { ScopeContext } from "./context";

const DEFAULT_PROFILE: Profile = { displayName: null, language: "en", timezone: "UTC" };

export function profileRepository({ db, userId, cipher }: ScopeContext) {
  const spec = SEALED.profiles;
  const decode = (row: typeof profiles.$inferSelect): Profile => {
    const sealed = openValues(cipher, spec, row);
    return {
      displayName: sealed.displayName as string | null,
      language: row.language,
      timezone: row.timezone,
    };
  };

  return {
    async get(): Promise<Profile> {
      const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId));
      return row ? decode(row) : { ...DEFAULT_PROFILE };
    },

    async update(patch: ProfilePatch): Promise<Profile> {
      const { displayName, ...clear } = parseInput(ProfilePatch, patch);
      const values = { ...clear, ...sealValues(cipher, spec, { displayName }) };
      const [row] = await db
        .insert(profiles)
        .values({ userId, ...values })
        .onConflictDoUpdate({ target: profiles.userId, set: { ...values, updatedAt: new Date() } })
        .returning();
      return decode(row!);
    },
  };
}

export function therapySettingsRepository({ db, userId, cipher }: ScopeContext) {
  const spec = SEALED.therapySettings;
  const decode = (row: typeof therapySettings.$inferSelect): TherapySettings => {
    const sealed = openValues(cipher, spec, row);
    return {
      therapistName: sealed.therapistName as string | null,
      therapistContact: sealed.therapistContact as string | null,
      sessionDay: row.sessionDay,
      sessionTime: row.sessionTime ? row.sessionTime.slice(0, 5) : null,
      reportLeadMinutes: row.reportLeadMinutes,
      requireApproval: true,
      deliveryChannel: row.deliveryChannel,
      nextSessionAt: row.nextSessionAt,
      reportNoticeEmail: row.reportNoticeEmail,
    };
  };

  return {
    async get(): Promise<TherapySettings> {
      const [row] = await db.select().from(therapySettings).where(eq(therapySettings.userId, userId));
      if (row) return decode(row);
      return {
        therapistName: null,
        therapistContact: null,
        sessionDay: null,
        sessionTime: null,
        reportLeadMinutes: 60,
        requireApproval: true,
        deliveryChannel: "download",
        nextSessionAt: null,
        reportNoticeEmail: false,
      };
    },

    async update(patch: TherapySettingsPatch): Promise<TherapySettings> {
      const { therapistName, therapistContact, ...clear } = parseInput(TherapySettingsPatch, patch);
      const values = { ...clear, ...sealValues(cipher, spec, { therapistName, therapistContact }) };
      const [row] = await db
        .insert(therapySettings)
        .values({ userId, ...values })
        .onConflictDoUpdate({
          target: therapySettings.userId,
          set: { ...values, updatedAt: new Date() },
        })
        .returning();
      return decode(row!);
    },
  };
}
