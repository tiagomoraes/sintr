"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/redirect";
import { LANGUAGE_COOKIE, matchLanguage } from "@/messages";
import { runtime, sessionScope } from "./runtime";

const YEAR = 365 * 24 * 60 * 60;

/**
 * The person chooses the language sintr speaks to them in, or gives the
 * choice back ("" lets sintr choose again). Kept in this browser, and on
 * their profile when they are signed in, so it follows them to their other
 * devices and to what sintr writes while they are away (DECISIONS 98).
 * A form post: it works without JavaScript.
 */
export async function chooseLanguage(form: FormData): Promise<void> {
  const given = form.get("language");
  const wanted = typeof given === "string" ? given : "";
  const back = form.get("next");
  const next = safeNext(typeof back === "string" && back ? back : undefined);
  const code = wanted === "" ? null : matchLanguage(wanted);
  if (wanted !== "" && !code) redirect(next);
  const jar = await cookies();
  if (code) {
    jar.set(LANGUAGE_COOKIE, code, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: runtime().config.url.protocol === "https:",
      maxAge: YEAR,
    });
  } else {
    jar.delete(LANGUAGE_COOKIE);
  }
  const scope = await sessionScope();
  if (scope) await scope.profile.update({ locale: code, ...(code ? { seenLocale: code } : {}) });
  revalidatePath("/", "layout");
  redirect(next);
}
