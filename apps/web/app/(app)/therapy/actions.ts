"use server";

import { ValidationError, isEmailAddress, isTimeZone, type TherapySettingsPatch } from "@sintr/core";
import { revalidatePath } from "next/cache";
import { getMessages } from "@/lib/server/language";
import { requireScope } from "@/lib/server/runtime";
import { isLead } from "@/lib/therapy";

export interface TherapyFormState {
  saved: boolean;
  problems: Record<string, string>;
}

/** The report's languages as offered; "" follows the language the person reads sintr in. */
const LANGUAGES: Record<string, string | null> = { "": null, en: "en", pt: "pt-BR", es: "es" };

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
  const said = (await getMessages()).therapy.problems;
  const problems: Record<string, string> = {};

  const timezone = text(form, "timezone");
  if (!isTimeZone(timezone)) problems.timezone = said.timezone;
  const chosenLanguage = text(form, "language");
  const language = LANGUAGES[chosenLanguage];
  if (language === undefined || !Object.hasOwn(LANGUAGES, chosenLanguage)) problems.language = said.language;

  const dayValue = text(form, "sessionDay");
  const sessionDay = dayValue === "" ? null : Number(dayValue);
  if (sessionDay !== null && !(Number.isInteger(sessionDay) && sessionDay >= 0 && sessionDay <= 6)) {
    problems.sessionDay = said.sessionDay;
  }
  const timeValue = text(form, "sessionTime");
  const sessionTime = timeValue === "" ? null : timeValue;
  if (sessionTime !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(sessionTime)) {
    problems.sessionTime = said.sessionTime;
  }
  if ((sessionDay === null) !== (sessionTime === null)) {
    problems[sessionDay === null ? "sessionDay" : "sessionTime"] = said.dayAndTime;
  }

  const lead = Number(text(form, "reportLeadMinutes"));
  if (!isLead(lead)) problems.reportLeadMinutes = said.lead;

  const therapistName = text(form, "therapistName");
  const therapistEmail = text(form, "therapistEmail");
  if (therapistEmail && !isEmailAddress(therapistEmail)) {
    problems.therapistEmail = said.therapistEmail;
  }
  const delivery = text(form, "deliveryChannel");
  if (delivery !== "email" && delivery !== "download") problems.deliveryChannel = said.delivery;
  if (delivery === "email" && !therapistEmail) {
    problems.therapistEmail = said.sendNeedsEmail;
  }
  const displayName = text(form, "displayName");

  if (Object.keys(problems).length > 0) return { saved: false, problems };

  const patch: TherapySettingsPatch = {
    therapistName: therapistName || null,
    therapistContact: therapistEmail || null,
    sessionDay,
    sessionTime,
    reportLeadMinutes: lead,
    deliveryChannel: delivery as "email" | "download",
    reportNoticeEmail: form.get("reportNoticeEmail") === "on",
  };
  try {
    await scope.profile.update({
      timezone,
      reportLanguage: language ?? null,
      displayName: displayName || null,
    });
    await scope.therapySettings.update(patch);
  } catch (error) {
    if (error instanceof ValidationError) {
      return { saved: false, problems: { form: said.form } };
    }
    throw error;
  }
  revalidatePath("/", "layout");
  return { saved: true, problems: {} };
}
