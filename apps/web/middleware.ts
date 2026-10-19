import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request security headers. Authentication is not decided here: every
 * page that needs a person checks the session on the server (see
 * lib/server/runtime.ts), so there is one gate, not an optimistic copy.
 */

function contentSecurityPolicy(nonce: string, https: boolean): string {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // React style attributes need inline styles; no third-party CSS is loaded.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "frame-ancestors 'none'",
    // Subscribing goes to Stripe's own pages; without JavaScript that is a form's redirect.
    "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
    "base-uri 'self'",
    "object-src 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const https = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce, https);

  const headers = new Headers(request.headers);
  // Next reads the nonce from this request header and puts it on its scripts.
  headers.set("content-security-policy", csp);
  // Lets a server-side redirect to sign in come back to the same page.
  headers.set("x-sintr-path", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  // A form posted without JavaScript carries `Origin: null` under `Referrer-Policy: no-referrer`, and
  // Next's server actions refuse a post whose origin they cannot read. When the browser's own
  // Sec-Fetch-Site, which no page can set, says the post came from this site, it is given this site's
  // origin, the host Next compares it with: the check of the language route (DECISIONS 98 and 136).
  if (request.headers.get("origin") === "null" && request.headers.get("sec-fetch-site") === "same-origin") {
    const host =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
    if (host) headers.set("origin", `${https ? "https" : "http"}://${host}`);
  }

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  if (https) response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: the API, the MCP endpoint (a bearer token, no HTML) and static files carry no CSP nonce.
      source: "/((?!api/|mcp|_next/static|_next/image|icon.svg|sintr-mcp.mjs).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
