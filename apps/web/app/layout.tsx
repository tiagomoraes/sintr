import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { LanguageProvider } from "@/components/language";
import { currentLanguage, getMessages } from "@/lib/server/language";
import { messagesFor } from "@/messages";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: { default: "sintr", template: "%s, sintr" },
    description: t.common.description,
    // A diary is nobody's search result, whether self-hosted or not.
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = { themeColor: "#ffffff", colorScheme: "light" };

// Every page renders per request so the CSP nonce reaches Next's scripts.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The language of the whole page, decided once on the server (DECISIONS 98).
  const language = await currentLanguage();
  return (
    <html lang={language.code}>
      <body>
        <a
          href="#main"
          className="absolute -top-16 left-4 z-50 rounded-pill bg-ink px-4 py-2.5 font-medium text-paper no-underline transition-[top] duration-300 focus:top-4"
        >
          {messagesFor(language.code).shell.skip}
        </a>
        <LanguageProvider code={language.code}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
