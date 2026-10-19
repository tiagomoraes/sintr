"use client";

import { Button, FieldError, FieldHint, Select, cn } from "@sintr/ui";
import { useActionState, useRef, useState, useSyncExternalStore } from "react";
import type { PreferencesState } from "@/app/(app)/settings/actions";
import { submitWith } from "@/lib/use-form-action";
import { useHydrated } from "@/lib/use-hydrated";
import { useMessages } from "@/components/language";
import { useUnsaved } from "@/components/unsaved";

/** How long conversations are kept, as the form posts it; each is said in `settings.time.retention`. */
const RETENTION = ["keep", "30", "90", "365"] as const;

const noSubscription = () => () => undefined;

export function PreferencesForm({
  timezone,
  timezones,
  retentionDays,
  save,
}: {
  timezone: string;
  timezones: string[];
  retentionDays: number | null;
  save: (state: PreferencesState, form: FormData) => Promise<PreferencesState>;
}) {
  const { time: T, unsaved: U } = useMessages().settings;
  const [state, action, pending] = useActionState(save, { saved: false, problems: {} });
  const hydrated = useHydrated();
  const form = useRef<HTMLFormElement>(null);
  useUnsaved(form, { timezone: U.timezone, retention: U.retention }, state.saved ? state : null);
  const [zone, setZone] = useState(timezone);
  // The device's own zone, read in the browser only (null while rendering on the server).
  const detected = useSyncExternalStore(
    noSubscription,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
  const device = detected && detected !== timezone && timezones.includes(detected) ? detected : null;
  const retention = retentionDays === null ? "keep" : String(retentionDays);

  return (
    // A post, and a Save that waits for the page to be alive: no field ever travels in an address.
    <form
      ref={form}
      method="post"
      action="/settings"
      onSubmit={submitWith(action)}
      className="space-y-10"
      aria-label={T.label}
    >
      <div>
        <label htmlFor="settings-timezone" className="block text-label font-medium text-ink">
          {T.zone}
        </label>
        <Select
          id="settings-timezone"
          name="timezone"
          value={zone}
          onChange={(event) => setZone(event.target.value)}
          className="mt-2 max-w-md"
        >
          {timezones.map((name) => (
            <option key={name} value={name}>
              {name.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
        <FieldHint>{T.zoneHint}</FieldHint>
        {device && zone !== device ? (
          <button
            type="button"
            onClick={() => setZone(device)}
            className="mt-3 inline-flex min-h-8 items-center rounded-pill border border-rule px-3.5 text-[0.8125rem] font-medium text-ink-2 hover:border-rule-strong hover:text-ink"
          >
            {T.device(device.replaceAll("_", " "))}
          </button>
        ) : null}
        {state.problems.timezone ? <FieldError>{state.problems.timezone}</FieldError> : null}
      </div>

      <fieldset className="min-w-0 border-0 p-0">
        <legend className="p-0 text-label font-medium text-ink">{T.keep}</legend>
        <p className="mt-1 max-w-[36em] text-caption text-ink-3">{T.keepHint}</p>
        <div className="mt-3 space-y-2">
          {RETENTION.map((option) => (
            <label key={option} className="flex items-center gap-3 text-[0.9688rem] text-ink-2">
              <input
                type="radio"
                name="retention"
                value={option}
                defaultChecked={option === retention}
                className={cn(
                  "size-4 shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-ink-soft bg-paper",
                  "checked:border-[5px] checked:border-ink",
                )}
              />
              {T.retention[option]}
            </label>
          ))}
        </div>
        {state.problems.retention ? <FieldError>{state.problems.retention}</FieldError> : null}
      </fieldset>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button type="submit" disabled={!hydrated || pending}>
          {T.save}
        </Button>
        {state.saved ? (
          <p role="status" className="text-[0.9375rem] text-ink-2">
            {T.saved}
          </p>
        ) : null}
      </div>
    </form>
  );
}
