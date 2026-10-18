import type { ReactNode } from "react";
import { ShellNav } from "@/components/shell-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { SiteHeader } from "@/components/site-header";
import { SupportLines } from "@/components/support-lines";
import { requireScope } from "@/lib/server/runtime";

export default async function ShellLayout({ children }: { children: ReactNode }) {
  const { user } = await requireScope();
  return (
    <>
      <SiteHeader home="/entries">
        <span className="hidden text-caption text-ink-3 sm:inline">{user.email}</span>
        <SignOutButton />
      </SiteHeader>
      <div className="wrap grid grid-cols-12 gap-x-6 gap-y-8 pb-24 pt-4 min-[900px]:pt-12">
        <aside className="col-span-12 min-[900px]:col-span-3">
          <div className="min-[900px]:sticky min-[900px]:top-7">
            <ShellNav />
          </div>
        </aside>
        <main id="main" className="col-span-12 min-[900px]:col-span-9 min-[900px]:max-w-[52rem]">
          {children}
        </main>
      </div>
      <footer className="border-t border-rule">
        <div className="wrap py-14">
          <SupportLines />
        </div>
      </footer>
    </>
  );
}
