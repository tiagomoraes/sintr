import { NextResponse } from "next/server";
import { calendarHref, isMonth } from "@/lib/calendar";
import { formScope, runtime } from "@/lib/server/runtime";
import { keepSession } from "@/lib/server/sessions";

export const dynamic = "force-dynamic";

/**
 * The calendar's forms without JavaScript: a plain form post from Therapy
 * that comes back to it, saying what was kept, or to the sheet it came
 * from, saying what to change. With JavaScript the same forms call the
 * server actions in app/(app)/therapy/sessions.ts, which keep the same
 * things through the same function.
 */
export async function POST(request: Request) {
  const guard = await formScope(request);
  if (guard instanceof Response) return guard;
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.redirect(new URL("/therapy", runtime().config.url), 303);
  const intent = form.get("intent");
  const outcome = await keepSession(guard.scope, typeof intent === "string" ? intent : "", form);
  const month = form.get("month");
  let next = calendarHref({ month: typeof month === "string" && isMonth(month) ? month : undefined });
  if ("problem" in outcome) {
    // Back to the sheet the form was in, only ever a state of the calendar.
    const from = form.get("return");
    const sheet = typeof from === "string" && /^\/therapy\?[\w=&.%-]*$/.test(from) ? from : next;
    next = `${sheet}${sheet.includes("?") ? "&" : "?"}problem=${outcome.problem}`;
  } else if (outcome.done) {
    next = `${next}${next.includes("?") ? "&" : "?"}done=${outcome.done}`;
  }
  const response = NextResponse.redirect(new URL(`${next}#sessions`, runtime().config.url), 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
