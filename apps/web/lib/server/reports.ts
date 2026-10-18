import "server-only";
import { renderPdf } from "@sintr/core/pdf";
import { runtime } from "./runtime";

/** Print a report document with the configured Chromium. */
export function printPdf(html: string): Promise<Uint8Array> {
  return renderPdf(html, { executablePath: runtime().config.chromiumPath });
}
