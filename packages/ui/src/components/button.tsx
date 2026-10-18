import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

/**
 * Buttons are full pills. Graphite ink is the only filled control: there is
 * no colored call to action. On hover the fill deepens, the pill lifts 1px
 * and a warm glow rises beneath it.
 */
export const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-pill",
    "font-sans font-medium text-[1rem] leading-none tracking-[0.005em] no-underline cursor-pointer",
    "transition-[transform,box-shadow,background-color,color,border-color] duration-[600ms] ease-out-expo",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        ink: "bg-ink text-paper shadow-ink hover:bg-ink-pressed hover:-translate-y-px hover:shadow-ink-hover active:translate-y-0",
        outline: "border border-rule bg-paper text-ink-2 hover:border-rule-strong hover:text-ink",
        quiet: "text-ink-2 hover:text-ink",
      },
      size: {
        default: "min-h-[52px] pl-[22px] pr-[26px]",
        sm: "min-h-10 px-[18px] text-label",
        inline: "min-h-0 p-0",
      },
    },
    defaultVariants: { variant: "ink", size: "default" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  /** Render the child element (for example a link) with button styles. */
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

/** Ink text with a hairline underline that darkens on hover. */
export const linkStyles =
  "text-ink underline decoration-rule-strong decoration-1 underline-offset-[0.28em] transition-[text-decoration-color] duration-[400ms] ease-out-expo hover:decoration-ink";
