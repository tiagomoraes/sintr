import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "../middleware";

function request(path: string, init: { proto?: string; headers?: Record<string, string> } = {}) {
  const headers = new Headers({ host: "127.0.0.1:3000", ...init.headers });
  if (init.proto) headers.set("x-forwarded-proto", init.proto);
  return new NextRequest(new URL(path, "http://127.0.0.1:3000"), { headers, method: "POST" });
}

describe("middleware", () => {
  it("sets a strict CSP with a fresh nonce on every response", () => {
    const a = middleware(request("/")).headers.get("content-security-policy")!;
    const b = middleware(request("/")).headers.get("content-security-policy")!;
    expect(a).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(a).toContain("frame-ancestors 'none'");
    expect(a).toContain("object-src 'none'");
    // Forms post here, or redirect to Stripe's own pages when a person subscribes; nowhere else.
    expect(a).toContain("form-action 'self' https://checkout.stripe.com https://billing.stripe.com;");
    expect(a).not.toBe(b);
  });

  it("hands the nonce and the requested path to the page", () => {
    const response = middleware(request("/reports?period=last"));
    expect(response.headers.get("x-middleware-request-x-sintr-path")).toBe("/reports?period=last");
    const csp = response.headers.get("content-security-policy");
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
  });

  it("decides nothing about authentication", () => {
    expect(middleware(request("/entries")).headers.get("location")).toBeNull();
  });

  it("adds HSTS only behind https", () => {
    expect(middleware(request("/")).headers.get("strict-transport-security")).toBeNull();
    expect(middleware(request("/", { proto: "https" })).headers.get("strict-transport-security")).toContain(
      "max-age=",
    );
  });

  it("gives a form posted from this site without JavaScript this site's origin, and only then", () => {
    const origin = (headers: Record<string, string>, proto?: string) =>
      middleware(request("/connect", { headers, ...(proto ? { proto } : {}) })).headers.get(
        "x-middleware-request-origin",
      );
    // Under no-referrer a plain form post says `Origin: null`; the browser's Sec-Fetch-Site says where it came from.
    expect(origin({ origin: "null", "sec-fetch-site": "same-origin" })).toBe("http://127.0.0.1:3000");
    expect(
      origin(
        {
          origin: "null",
          "sec-fetch-site": "same-origin",
          "x-forwarded-host": "diary.example.com, 10.0.0.2",
        },
        "https",
      ),
    ).toBe("https://diary.example.com");
    // From another site, or with no word from the browser, it stays what it was, and Next refuses it.
    expect(origin({ origin: "null", "sec-fetch-site": "cross-site" })).toBe("null");
    expect(origin({ origin: "null", "sec-fetch-site": "same-site" })).toBe("null");
    expect(origin({ origin: "null" })).toBe("null");
    expect(origin({ origin: "https://elsewhere.example", "sec-fetch-site": "same-origin" })).toBe(
      "https://elsewhere.example",
    );
  });
});
