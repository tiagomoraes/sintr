import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "../middleware";

function request(path: string, init: { proto?: string } = {}) {
  const headers = new Headers({ host: "127.0.0.1:3000" });
  if (init.proto) headers.set("x-forwarded-proto", init.proto);
  return new NextRequest(new URL(path, "http://127.0.0.1:3000"), { headers });
}

describe("middleware", () => {
  it("sets a strict CSP with a fresh nonce on every response", () => {
    const a = middleware(request("/")).headers.get("content-security-policy")!;
    const b = middleware(request("/")).headers.get("content-security-policy")!;
    expect(a).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(a).toContain("frame-ancestors 'none'");
    expect(a).toContain("object-src 'none'");
    expect(a).toContain("form-action 'self'");
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
});
