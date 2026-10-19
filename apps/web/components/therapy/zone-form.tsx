"use client";

import { FieldError, Select, buttonVariants, cn } from "@sintr/ui";
import { useActionState } from "react";
import { saveTimeZone } from "@/app/(app)/therapy/sessions";
import { useMessages } from "@/components/language";
import { submitWith } from "@/lib/use-form-action";

/**
 * Under the calendar: the zone its days and times are read in, said in a
 * line, and changed behind it. A plain post to the calendar's route without
 * JavaScript, the server action with it.
 */
export function ZoneForm({
  zone,
  month,
  timezones,
}: {
  zone: string;
  month: string;
  timezones: readonly string[];
}) {
  const T = useMessages().therapy.calendar;
  const [result, action, pending] = useActionState(saveTimeZone, { problem: null });
  const place = (zone.split("/").at(-1) ?? zone).replaceAll("_", " ");
  return (
    <details className="group mt-8 border-t border-rule pt-5">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 text-[0.9375rem] text-ink-3 [&::-webkit-details-marker]:hidden">
        <span>{T.zone(place)}</span>
        <span className="text-ink underline decoration-rule-strong underline-offset-[0.28em] group-hover:decoration-ink">
          {T.changeZone}
        </span>
      </summary>
      <form
        method="post"
        action="/api/therapy/sessions"
        onSubmit={submitWith(action)}
        className="sintr-rise mt-5 max-w-md"
      >
        <input type="hidden" name="intent" value="zone" />
        <input type="hidden" name="month" value={month} />
        <label htmlFor="therapy-timezone" className="block text-label font-medium text-ink">
          {T.zoneLabel}
        </label>
        <Select id="therapy-timezone" name="timezone" defaultValue={zone} className="mt-2">
          {timezones.map((name) => (
            <option key={name} value={name}>
              {name.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
        <p className="mt-2 text-caption text-ink-3">{T.zoneHint}</p>
        {result.problem ? <FieldError>{T.problems.timezone}</FieldError> : null}
        <button
          type="submit"
          disabled={pending}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
        >
          {T.saveZone}
        </button>
      </form>
    </details>
  );
}
