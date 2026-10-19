import { WindowLight } from "@sintr/ui";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { LanguageOffers } from "@/components/language";
import { SupportLines } from "@/components/support-lines";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* On a reading page the light stays in the header and fades before the form. */}
      <WindowLight className="right-[-8vw] top-[-6vh] h-[92vh] w-[clamp(420px,54vw,860px)] [mask-image:linear-gradient(to_bottom,black_55%,transparent)] max-[900px]:hidden" />
      <SiteHeader />
      <main id="main" className="relative z-10">
        <div className="wrap grid grid-cols-12 gap-x-6 pb-24 pt-[clamp(32px,8vh,96px)]">
          <div className="col-span-12 sm:col-span-10 md:col-span-7 lg:col-span-5">{children}</div>
        </div>
      </main>
      <footer className="border-t border-rule">
        <div className="wrap py-14">
          <SupportLines />
          <LanguageOffers className="mt-10" />
        </div>
      </footer>
    </>
  );
}
