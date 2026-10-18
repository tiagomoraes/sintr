"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn("block font-sans text-label font-medium text-ink", className)}
      {...props}
    />
  );
}

/** A quiet text field: white, one hairline, the focus ring in ink. */
export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "block h-12 w-full rounded-command border border-rule-strong bg-paper px-4",
        "font-sans text-body text-ink placeholder:text-ink-3",
        "transition-[border-color] duration-300 ease-out-expo hover:border-ink-soft",
        "focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        "aria-[invalid=true]:border-ink",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A drawn checkbox: a 16px square, 1.5px Soft Ink outline when open, an ink
 * fill with a white check when done. It is a native input, so it works with
 * the keyboard and without JavaScript.
 */
export function Checkbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "relative mt-[0.2em] size-4 shrink-0 cursor-pointer appearance-none rounded-tick border-[1.5px] border-ink-soft bg-paper",
        "transition-colors duration-200 checked:border-ink checked:bg-ink",
        "after:absolute after:left-[4px] after:top-[1px] after:hidden after:h-[8px] after:w-[4px] after:rotate-45",
        "after:border-b-[1.5px] after:border-r-[1.5px] after:border-paper after:content-[''] checked:after:block",
        className,
      )}
      {...props}
    />
  );
}

export function FieldHint({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("mt-2 text-caption text-ink-3", className)} {...props} />;
}

/** Errors are said plainly in ink; there is no alarm color in the system. */
export function FieldError({ className, ...props }: ComponentProps<"p">) {
  return <p role="alert" className={cn("mt-2 text-caption text-ink", className)} {...props} />;
}
