import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

/** The window glyph: a skewed two-by-two pane of morning light on ink. */
export function Glyph({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={cn("size-7", className)}
      {...props}
    >
      <defs>
        <linearGradient id="sintr-glyph" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#cfe3f3" />
          <stop offset=".55" stopColor="#f6e1d3" />
          <stop offset="1" stopColor="#f7cfb5" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="#16171a" />
      <g fill="url(#sintr-glyph)" transform="translate(10.4 6.2) skewX(-14)">
        <rect x="0" y="0" width="6" height="8.8" rx="1" />
        <rect x="7.2" y="0" width="6" height="8.8" rx="1" />
        <rect x="0" y="10.2" width="6" height="8.8" rx="1" />
        <rect x="7.2" y="10.2" width="6" height="8.8" rx="1" />
      </g>
    </svg>
  );
}

/** The glyph and the serif wordmark. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-ink", className)}>
      <Glyph />
      <span className="-translate-y-px font-serif text-[1.625rem] font-normal leading-none tracking-[-0.02em]">
        sintr
      </span>
    </span>
  );
}

/**
 * The window light: a tall two-by-three window projected obliquely onto the
 * wall, with blurred leaf shadows, multiplied onto the page. Decorative only.
 * Use one per page, in the upper right of the first viewport, never behind
 * long text. Motion (a slow breath and swaying leaves) only runs when the
 * reader has not asked for reduced motion.
 */
export function WindowLight({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("sintr-light absolute overflow-hidden", className)}>
      <svg viewBox="0 0 1000 1000" focusable="false" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="sintr-light-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset=".18" className="sintr-light__s1" />
            <stop offset=".5" className="sintr-light__s2" />
            <stop offset=".82" className="sintr-light__s3" />
          </linearGradient>
          <filter id="sintr-light-edge" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="11" />
          </filter>
          <filter id="sintr-light-leaf" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.4" />
          </filter>
          <filter id="sintr-light-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 .42  0 0 0 0 .42  0 0 0 0 .44  0 0 0 .11 0" />
          </filter>
          <mask
            id="sintr-light-window"
            maskUnits="userSpaceOnUse"
            x="-500"
            y="-500"
            width="2000"
            height="2000"
          >
            <g filter="url(#sintr-light-edge)" fill="#fff" transform="translate(430 110) skewX(-15) skewY(8)">
              <rect x="0" y="0" width="150" height="188" rx="3" />
              <rect x="166" y="0" width="150" height="188" rx="3" />
              <rect x="0" y="204" width="150" height="188" rx="3" />
              <rect x="166" y="204" width="150" height="188" rx="3" />
              <rect x="0" y="408" width="150" height="188" rx="3" />
              <rect x="166" y="408" width="150" height="188" rx="3" />
            </g>
          </mask>
        </defs>
        <g mask="url(#sintr-light-window)">
          <rect x="200" y="60" width="600" height="840" fill="url(#sintr-light-grad)" />
          <rect x="200" y="60" width="600" height="840" filter="url(#sintr-light-grain)" />
          <g className="sintr-light__leaves" filter="url(#sintr-light-leaf)">
            <g className="sintr-light__branch sintr-light__branch--a">
              <path
                className="sintr-light__stem"
                d="M960 60 C 870 120, 800 170, 700 250 S 560 380, 500 470"
              />
              <path d="M900 104c-26-30-68-34-92-16 25 27 62 34 92 16z" />
              <path d="M866 128c9-39-10-76-39-87-7 36 9 71 39 87z" />
              <path d="M816 164c-32-23-74-20-94 4 28 19 67 21 94-4z" />
              <path d="M786 186c14-37 2-78-25-92-12 34-2 73 25 92z" />
              <path d="M733 225c-35-16-76-5-90 21 32 12 71 5 90-21z" />
              <path d="M701 250c19-34 16-76-7-94-18 30-16 69 7 94z" />
              <path d="M651 291c-35-11-74 5-85 34 34 7 69-5 85-34z" />
              <path d="M618 321c25-30 28-73 7-94-21 27-25 66-7 94z" />
              <path d="M575 362c-37-5-73 16-80 46 34 2 67-16 80-46z" />
              <path d="M545 398c27-27 35-67 18-92-23 23-32 62-18 92z" />
              <path d="M515 442c-35 2-65 28-67 58 34-5 62-28 67-58z" />
            </g>
            <g className="sintr-light__branch sintr-light__branch--b">
              <path
                className="sintr-light__stem"
                d="M960 560 C 890 600, 830 650, 780 720 S 700 840, 690 920"
              />
              <path d="M902 590c-21-32-62-43-89-30 20 30 57 43 89 30z" />
              <path d="M865 615c16-35 7-76-18-92-12 34-5 71 18 92z" />
              <path d="M821 657c-30-25-73-27-94-5 27 23 66 27 94 5z" />
              <path d="M796 686c19-34 18-74-4-94-18 30-18 69 4 94z" />
              <path d="M757 739c-34-18-74-9-90 16 32 14 71 9 90-16z" />
              <path d="M732 776c25-28 30-69 11-92-21 25-27 64-11 92z" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
