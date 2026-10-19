import { NextResponse } from "next/server";
import { safeNext } from "@/lib/redirect";
import { apiError, runtime } from "@/lib/server/runtime";
import { LANGUAGE_COOKIE, matchLanguage } from "@/messages";

export const dynamic = "force-dynamic";

const YEAR = 365 * 24 * 60 * 60;

/**
 * The person chooses the language sintr speaks to them in, or gives the
 * choice back ("" lets sintr choose again). Kept in this browser, and on
 * their profile when they are signed in, so it follows them to their other
 * devices and to what sintr writes while they are away (DECISIONS 98).
 *
 * A plain form post that comes back to the page, so it works without
 * JavaScript. Under `Referrer-Policy: no-referrer` a browser sends
 * `Origin: null` on such a post, so the check is `Sec-Fetch-Site`, which no
 * page can set, and the origin only where a browser sends no such header.
 */
export async function POST(request: Request) {
  const { config } = runtime();
  const site = request.headers.get("sec-fetch-site");
  const sameOrigin = site ? site === "same-origin" : request.headers.get("origin") === config.url.origin;
  if (!sameOrigin) return apiError(403, "origin_refused");

  const form = await request.formData().catch(() => null);
  const given = form?.get("language");
  const wanted = typeof given === "string" ? given : "";
  const back = form?.get("next");
  const next = safeNext(typeof back === "string" && back ? back : undefined);
  const response = NextResponse.redirect(new URL(next, config.url), 303);
  const code = wanted === "" ? null : matchLanguage(wanted);
  if (wanted !== "" && !code) return response;

  if (code) {
    response.cookies.set(LANGUAGE_COOKIE, code, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: config.url.protocol === "https:",
      maxAge: YEAR,
    });
  } else {
    response.cookies.delete(LANGUAGE_COOKIE);
  }
  const session = await runtime().auth.api.getSession({ headers: request.headers });
  if (session) {
    const scope = await runtime().repositories.forUser(session.user.id);
    await scope.profile.update({ locale: code, ...(code ? { seenLocale: code } : {}) });
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
