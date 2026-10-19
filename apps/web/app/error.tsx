"use client";

import { Button } from "@sintr/ui";
import { useMessages } from "@/components/language";

/** No error detail is shown: messages are for logs, and logs carry no content. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useMessages().common.error;
  return (
    <main id="main" className="wrap pb-24 pt-[clamp(48px,12vh,140px)]">
      <h1 className="text-title">{t.heading}</h1>
      <p className="mt-4 max-w-[34em] text-lede text-ink-2">{t.body}</p>
      <Button className="mt-8" onClick={reset}>
        {t.retry}
      </Button>
    </main>
  );
}
