import "server-only";
import { renderPdf } from "@sintr/core/pdf";
import { runtime } from "./runtime";

/** At most this many Chromiums print at once; the others wait their turn. */
const PRINTS = 2;
let printing = 0;
const waiting: (() => void)[] = [];

async function turn(): Promise<() => void> {
  if (printing >= PRINTS) await new Promise<void>((resolve) => waiting.push(resolve));
  printing += 1;
  return () => {
    printing -= 1;
    waiting.shift()?.();
  };
}

/** Print a report document with the configured Chromium, a couple at a time. */
export async function printPdf(html: string): Promise<Uint8Array> {
  const done = await turn();
  try {
    return await renderPdf(html, { executablePath: runtime().config.chromiumPath });
  } finally {
    done();
  }
}
