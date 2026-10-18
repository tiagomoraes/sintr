import { resolve } from "node:path";
import type { NextConfig } from "next";

/** Headers that do not depend on the request. CSP and HSTS are set per request in middleware.ts. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

const config: NextConfig = {
  // The Docker image runs the standalone server; local builds use `next start`.
  output: process.env.SINTR_STANDALONE === "1" ? "standalone" : undefined,
  // The monorepo root, so the standalone build traces workspace packages.
  outputFileTracingRoot: resolve(process.cwd(), "../.."),
  transpilePackages: ["@sintr/core", "@sintr/ui", "@sintr/agent", "@sintr/mcp"],
  // Native code, and the browser driver that prints reports: required at run time, not bundled.
  serverExternalPackages: ["@node-rs/argon2", "playwright-core"],
  poweredByHeader: false,
  reactStrictMode: true,
  // make lint runs ESLint for the whole repository.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      // A report's PDF may be shown inside its own page (same origin only); everything else, never.
      { source: "/((?!api/reports/[^/]+/pdf$).*)", headers: securityHeaders },
      {
        source: "/api/reports/:id/pdf",
        headers: securityHeaders.map((header) =>
          header.key === "X-Frame-Options" ? { key: "X-Frame-Options", value: "SAMEORIGIN" } : header,
        ),
      },
    ];
  },
};

export default config;
