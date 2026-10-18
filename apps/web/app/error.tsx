"use client";

import { Button } from "@sintr/ui";

/** No error detail is shown: messages are for logs, and logs carry no content. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="wrap pb-24 pt-[clamp(48px,12vh,140px)]">
      <h1 className="text-title">This page could not open.</h1>
      <p className="mt-4 max-w-[34em] text-lede text-ink-2">
        Something went wrong on our side. Try again in a moment.
      </p>
      <Button className="mt-8" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
