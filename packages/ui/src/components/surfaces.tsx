import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

/** A hairline outline, 18px radius, no fill and no shadow (the help panel). */
export function Panel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("rounded-panel border border-rule bg-paper px-[26px] py-6", className)} {...props} />
  );
}

/** A white card resting in the light: hairline, 14px radius, the card shadow. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("overflow-hidden rounded-file border border-rule bg-paper shadow-card", className)}
      {...props}
    />
  );
}

/** The one tinted surface. */
export function Wash({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("rounded-file border border-rule bg-wash px-[22px] py-5", className)} {...props} />
  );
}

export function Separator({ className, ...props }: ComponentProps<"hr">) {
  return <hr className={cn("m-0 h-px border-0 bg-rule", className)} {...props} />;
}

/**
 * The peach highlighter, for a person's own quoted words only.
 * It is never emphasis in general.
 */
export function Verbatim({ className, ...props }: ComponentProps<"q">) {
  return (
    <q
      className={cn(
        "bg-[linear-gradient(to_top,transparent_0_8%,var(--color-verbatim)_8%_42%,transparent_42%)] [box-decoration-break:clone] px-[0.04em]",
        className,
      )}
      {...props}
    />
  );
}
