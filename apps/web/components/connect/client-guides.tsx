"use client";

import { linkStyles } from "@sintr/ui";
import { useState } from "react";
import { clientGuides, type ClientGuide, type ClientId, type Step } from "@/lib/connect";
import { Snippet } from "./copy-button";

const segmentedOption =
  "pointer-events-none flex min-h-10 items-center rounded-pill px-4 text-[0.9375rem] font-medium text-ink-2 transition-colors duration-300 peer-hover:bg-wash peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink";

function Steps({ steps, start = 1 }: { steps: readonly Step[]; start?: number }) {
  return (
    <ol className="mt-5 space-y-5" start={start}>
      {steps.map((step, index) => (
        <li key={index} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2">
          <span aria-hidden="true" className="font-serif text-[1.25rem] leading-[1.35] text-ink-soft">
            {start + index}
          </span>
          <div className="min-w-0">
            <p className="text-ink [overflow-wrap:anywhere]">{step.text}</p>
            {step.link ? (
              <p className="mt-2">
                <a href={step.link.href} download className={linkStyles}>
                  {step.link.label}
                </a>
              </p>
            ) : null}
            {step.snippet ? <Snippet text={step.snippet.text} label={step.snippet.label} /> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Guide({
  guide,
  reachableHere,
  appUrl,
}: {
  guide: ClientGuide;
  reachableHere: boolean;
  appUrl: string;
}) {
  const blocked = guide.fromTheirServers && reachableHere;
  return (
    <div>
      <p className="max-w-[36em] text-ink-2">{guide.what}</p>
      {blocked ? (
        <p className="mt-4 max-w-[36em] rounded-file border border-rule bg-wash px-5 py-4 text-[0.9375rem] text-ink-2">
          {guide.name} reaches sintr from its own servers, and this sintr is at {appUrl}, which only this
          computer or network can reach. It needs a public https address first (the self-host guide explains
          how).
          {guide.another ? " The way below, from a file, works from this computer now." : ""}
        </p>
      ) : null}
      <Steps steps={guide.steps} />
      <p className="mt-6 max-w-[36em] text-[0.9375rem] text-ink-2">
        <span className="font-medium text-ink">To check it worked: </span>
        {guide.check}
      </p>
      {guide.notes.length ? (
        <ul className="mt-4 max-w-[36em] space-y-2 text-[0.9375rem] text-ink-3">
          {guide.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      {guide.another ? (
        <details open={blocked} className="group mt-8 border-t border-rule pt-5">
          <summary className="cursor-pointer list-none text-[0.9375rem] font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden="true"
              className="mr-2.5 inline-block size-[7px] -translate-y-px rotate-[-45deg] border-b-[1.5px] border-r-[1.5px] border-current transition-transform duration-[400ms] group-open:rotate-45 motion-reduce:transition-none"
            />
            {guide.another.title}
          </summary>
          <Steps steps={guide.another.steps} />
        </details>
      ) : null}
    </div>
  );
}

/**
 * One assistant at a time: a choice of client, then its steps with the
 * address and key filled in, ready to copy.
 */
export function ClientGuides({
  appUrl,
  keyText,
  reachableHere,
}: {
  appUrl: string;
  keyText: string;
  reachableHere: boolean;
}) {
  const guides = clientGuides({ appUrl, key: keyText });
  const [chosen, setChosen] = useState<ClientId>("claude");
  const guide = guides.find((g) => g.id === chosen) ?? guides[0]!;
  return (
    <div>
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="p-0 text-label font-medium text-ink">Your assistant</legend>
        <div className="mt-3 inline-flex max-w-full flex-wrap gap-1 rounded-[26px] border border-rule bg-paper p-1">
          {guides.map((option) => (
            <label key={option.id} className="relative">
              <input
                type="radio"
                name="client"
                value={option.id}
                checked={chosen === option.id}
                onChange={() => setChosen(option.id)}
                className="peer absolute inset-0 cursor-pointer opacity-0"
              />
              <span className={segmentedOption}>{option.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-8">
        <Guide guide={guide} reachableHere={reachableHere} appUrl={appUrl} />
      </div>
    </div>
  );
}
