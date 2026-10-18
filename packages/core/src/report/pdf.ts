/**
 * Print a report document to PDF with headless Chromium (Playwright). The
 * page is our own escaped HTML with every font and image inline, so the
 * browser runs it with JavaScript off and every request refused: printing
 * never reaches the network. Kept apart from the rest of the core
 * (`@sintr/core/pdf`) so only the web app carries the browser driver.
 *
 * The browser is Playwright's Chromium (`make setup` installs it), or the
 * one at SINTR_CHROMIUM_PATH (the Docker image sets the system Chromium).
 */
import { chromium } from "playwright-core";

export class PdfRenderError extends Error {
  override readonly name = "PdfRenderError";
  readonly code: "browser_missing" | "render_failed";
  constructor(code: PdfRenderError["code"]) {
    super(`the report could not be printed: ${code}`);
    this.code = code;
  }
}

export interface PdfOptions {
  /** A Chromium binary; Playwright's own when absent. */
  executablePath?: string | null;
  timeoutMs?: number;
}

export async function renderPdf(html: string, options: PdfOptions = {}): Promise<Uint8Array> {
  const timeout = options.timeoutMs ?? 60_000;
  let browser;
  try {
    browser = await chromium.launch({
      ...(options.executablePath ? { executablePath: options.executablePath } : {}),
      timeout,
      // Shared memory is small in containers; the GPU is never needed to print.
      args: ["--disable-dev-shm-usage", "--disable-gpu", "--no-first-run"],
    });
  } catch {
    throw new PdfRenderError("browser_missing");
  }
  try {
    const context = await browser.newContext({ javaScriptEnabled: false, offline: true });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    await page.setContent(html, { waitUntil: "load" });
    // The fonts are inline; make sure they are laid out before printing.
    await page.evaluate("document.fonts.ready").catch(() => undefined);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    return new Uint8Array(pdf);
  } catch {
    throw new PdfRenderError("render_failed");
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/** Does this look like a PDF file (header and trailer)? */
export function isPdf(bytes: Uint8Array): boolean {
  const head = Buffer.from(bytes.subarray(0, 5)).toString("latin1");
  const tail = Buffer.from(bytes.subarray(Math.max(0, bytes.length - 64))).toString("latin1");
  return head === "%PDF-" && tail.includes("%%EOF");
}
