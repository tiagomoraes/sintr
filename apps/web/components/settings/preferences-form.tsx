"use client";

import { Button, FieldError, FieldHint, cn } from "@sintr/ui";
import { useActionState, useState, useSyncExternalStore } from "react";
import type { PreferencesState } from "@/app/(app)/settings/actions";
import { submitWith } from "@/lib/use-form-action";

const RETENTION = [
  { value: "keep", label: "Until I delete them" },
  { value: "30", label: "30 days after the last message" },
  { value: "90", label: "90 days after the last message" },
  { value: "365", label: "A year after the last message" },
];

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
  const [state, action, pending] = useActionState(save, { saved: false, problems: {} });
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
    <form onSubmit={submitWith(action)} className="space-y-10" aria-label="Time zone and conversations">
      <div>
        <label htmlFor="settings-timezone" className="block text-label font-medium text-ink">
          Your time zone
        </label>
        <select
          id="settings-timezone"
          name="timezone"
          value={zone}
          onChange={(event) => setZone(event.target.value)}
          className="mt-2 block h-12 w-full max-w-md rounded-command border border-rule-strong bg-paper px-4 font-sans text-body text-ink hover:border-ink-soft focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {timezones.map((name) => (
            <option key={name} value={name}>
              {name.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <FieldHint>Dates in your diary, and the assistant&apos;s sense of today, follow it.</FieldHint>
        {device && zone !== device ? (
          <button
            type="button"
            onClick={() => setZone(device)}
            className="mt-3 inline-flex min-h-8 items-center rounded-pill border border-rule px-3.5 text-[0.8125rem] font-medium text-ink-2 hover:border-rule-strong hover:text-ink"
          >
            Use this device&apos;s time zone, {device.replaceAll("_", " ")}
          </button>
        ) : null}
        {state.problems.timezone ? <FieldError>{state.problems.timezone}</FieldError> : null}
      </div>

      <fieldset className="min-w-0 border-0 p-0">
        <legend className="p-0 text-label font-medium text-ink">Keep conversations</legend>
        <p className="mt-1 max-w-[36em] text-caption text-ink-3">
          Entries and check-ins you saved stay in your diary either way. Only the conversations go.
        </p>
        <div className="mt-3 space-y-2">
          {RETENTION.map((option) => (
            <label key={option.value} className="flex items-center gap-3 text-[0.9688rem] text-ink-2">
              <input
                type="radio"
                name="retention"
                value={option.value}
                defaultChecked={option.value === retention}
                className={cn(
                  "size-4 shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-ink-soft bg-paper",
                  "checked:border-[5px] checked:border-ink",
                )}
              />
              {option.label}
            </label>
          ))}
        </div>
        {state.problems.retention ? <FieldError>{state.problems.retention}</FieldError> : null}
      </fieldset>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button type="submit" disabled={pending}>
          Save
        </Button>
        {state.saved ? (
          <p role="status" className="text-[0.9375rem] text-ink-2">
            Saved.
          </p>
        ) : null}
      </div>
    </form>
  );
}
