import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "sintr", template: "%s, sintr" },
  description: "A private mood diary for the week between therapy sessions.",
  // A diary is nobody's search result, whether self-hosted or not.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#ffffff", colorScheme: "light" };

// Every page renders per request so the CSP nonce reaches Next's scripts.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="absolute -top-16 left-4 z-50 rounded-pill bg-ink px-4 py-2.5 font-medium text-paper no-underline transition-[top] duration-300 focus:top-4"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
