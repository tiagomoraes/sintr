"use server";

import { ValidationError, isEmailAddress, isTimeZone, type TherapySettingsPatch } from "@sintr/core";
import { revalidatePath } from "next/cache";
import { requireScope } from "@/lib/server/runtime";
import { LEADS } from "@/lib/therapy";
import { fromLocalInput } from "@/lib/time";

export interface TherapyFormState {
  saved: boolean;
  problems: Record<string, string>;
}

const LANGUAGES: Record<string, string> = { en: "en", pt: "pt-BR", es: "es" };

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Save the therapy schedule, the therapist's contact and how the report is
 * delivered. Approval before sending is not a setting: every report waits
 * for the person's yes, and the database refuses anything else.
 */
export async function saveTherapy(_state: TherapyFormState, form: FormData): Promise<TherapyFormState> {
  const { scope } = await requireScope();
  const problems: Record<string, string> = {};

  const timezone = text(form, "timezone");
  if (!isTimeZone(timezone)) problems.timezone = "Choose a time zone from the list.";
  const language = LANGUAGES[text(form, "language")];
  if (!language) problems.language = "Choose the report's language.";

  const dayValue = text(form, "sessionDay");
  const sessionDay = dayValue === "" ? null : Number(dayValue);
  if (sessionDay !== null && !(Number.isInteger(sessionDay) && sessionDay >= 0 && sessionDay <= 6)) {
    problems.sessionDay = "Choose a day of the week.";
  }
  const timeValue = text(form, "sessionTime");
  const sessionTime = timeValue === "" ? null : timeValue;
  if (sessionTime !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(sessionTime)) {
    problems.sessionTime = "Write the time as hours and minutes, such as 18:00.";
  }
  if ((sessionDay === null) !== (sessionTime === null)) {
    problems[sessionDay === null ? "sessionDay" : "sessionTime"] =
      "Give both the day and the time of your sessions, or neither.";
  }

  const lead = Number(text(form, "reportLeadMinutes"));
  if (!LEADS.some((option) => option.minutes === lead))
    problems.reportLeadMinutes = "Choose when to prepare the report.";

  const movedValue = text(form, "nextSessionAt");
  let nextSessionAt: Date | null = null;
  if (movedValue && form.get("clearNextSession") !== "on") {
    nextSessionAt = isTimeZone(timezone) ? fromLocalInput(movedValue, timezone) : null;
    if (!nextSessionAt) problems.nextSessionAt = "Give the date and the time of that session.";
  }

  const therapistName = text(form, "therapistName");
  const therapistEmail = text(form, "therapistEmail");
  if (therapistEmail && !isEmailAddress(therapistEmail)) {
    problems.therapistEmail = "Check the address: one email, such as name@example.com.";
  }
  const delivery = text(form, "deliveryChannel");
  if (delivery !== "email" && delivery !== "download")
    problems.deliveryChannel = "Choose what happens to the report.";
  if (delivery === "email" && !therapistEmail) {
    problems.therapistEmail = "To send the report, sintr needs your therapist's email.";
  }
  const displayName = text(form, "displayName");

  if (Object.keys(problems).length > 0) return { saved: false, problems };

  const patch: TherapySettingsPatch = {
    therapistName: therapistName || null,
    therapistContact: therapistEmail || null,
    sessionDay,
    sessionTime,
    reportLeadMinutes: lead,
    nextSessionAt,
    deliveryChannel: delivery as "email" | "download",
    reportNoticeEmail: form.get("reportNoticeEmail") === "on",
  };
  try {
    await scope.profile.update({ timezone, language: language!, displayName: displayName || null });
    await scope.therapySettings.update(patch);
  } catch (error) {
    if (error instanceof ValidationError) {
      return { saved: false, problems: { form: "Some of it could not be kept as it is. Check the fields." } };
    }
    throw error;
  }
  revalidatePath("/", "layout");
  return { saved: true, problems: {} };
}
