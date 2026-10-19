"use client";

import { cn } from "@sintr/ui";

const option =
  "pointer-events-none flex min-h-10 items-center rounded-pill px-4 text-[0.9375rem] font-medium text-ink-2 transition-colors duration-300 peer-hover:bg-wash peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink";

/**
 * The segmented toggle: native radios inside a hairline pill, the chosen one
 * in ink. Works with the keyboard; `onChange` is optional, so it also works
 * as a plain form field.
 */
export function Segmented<T extends string>({
  name,
  options,
  value,
  defaultValue,
  onChange,
  className,
}: {
  name: string;
  options: readonly { value: T; label: string }[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full flex-wrap gap-1 rounded-[26px] border border-rule bg-paper p-1",
        className,
      )}
    >
      {options.map((choice) => (
        <label key={choice.value} className="relative">
          <input
            type="radio"
            name={name}
            value={choice.value}
            {...(value !== undefined
              ? { checked: value === choice.value }
              : { defaultChecked: defaultValue === choice.value })}
            onChange={() => onChange?.(choice.value)}
            className="peer absolute inset-0 cursor-pointer opacity-0"
          />
          <span className={option}>{choice.label}</span>
        </label>
      ))}
    </div>
  );
}
