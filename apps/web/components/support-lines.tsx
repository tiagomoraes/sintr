import { cn } from "@sintr/ui";
import { useId } from "react";

const LINES = [
  {
    where: "Brazil",
    who: "CVV, Centro de Valorização da Vida",
    how: "Free, 24 hours",
    number: "188",
    tel: "188",
  },
  { where: "Brazil", who: "SAMU, medical emergencies", how: "Free, 24 hours", number: "192", tel: "192" },
];

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="size-4 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.6]"
    >
      <path d="M6.2 3.5h2.9l1.5 3.9-2 1.4a12 12 0 0 0 6.6 6.6l1.4-2 3.9 1.5v2.9a1.7 1.7 0 0 1-1.8 1.7A16 16 0 0 1 4.5 5.3a1.7 1.7 0 0 1 1.7-1.8z" />
    </svg>
  );
}

/**
 * Where to find a person right now. sintr is not a crisis service, so this
 * is present wherever someone might write about acute risk.
 */
export function SupportLines({ className, headingLevel = 2 }: { className?: string; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("max-w-[44rem]", className)}>
      <Heading id={id} className="max-w-[24em] font-serif text-title-small font-normal">
        If you are in danger or thinking about harming yourself, please call someone now.
      </Heading>
      <ul className="mt-5 border-t border-ink">
        {LINES.map((line) => (
          <li
            key={line.number}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-1 border-b border-rule py-3.5 sm:grid-cols-[8rem_minmax(0,1fr)_auto]"
          >
            <span className="hidden text-caption text-ink-3 sm:block">{line.where}</span>
            <span className="font-medium leading-[1.4] text-ink">
              {line.who}
              <span className="block text-[0.875rem] font-normal text-ink-3">{line.how}</span>
            </span>
            <a
              href={`tel:${line.tel}`}
              aria-label={`Call ${line.who}, ${line.number}`}
              className="inline-flex min-h-[42px] items-center gap-2 whitespace-nowrap rounded-pill border border-ink pl-[13px] pr-4 font-semibold tabular-nums text-ink no-underline transition-colors duration-300 hover:bg-ink hover:text-paper"
            >
              <PhoneIcon />
              <span>{line.number}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-4 max-w-[38em] text-[0.875rem] text-ink-3">
        Anywhere else, call your local emergency number or find a free, confidential line at{" "}
        <a
          className="text-ink underline decoration-rule-strong underline-offset-[0.28em]"
          href="https://findahelpline.com"
        >
          findahelpline.com
        </a>
        . sintr is a diary: it is not therapy, a diagnosis or a crisis service.
      </p>
    </section>
  );
}
