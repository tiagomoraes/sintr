import { WindowLight } from "@sintr/ui";
import type { ReactNode } from "react";
import { SupportLines } from "@/components/support-lines";

/** An invite opens on a reading page: the light stays in the header and fades before the words. */
export default function JoinLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <WindowLight className="right-[-8vw] top-[-6vh] h-[92vh] w-[clamp(420px,54vw,860px)] [mask-image:linear-gradient(to_bottom,black_55%,transparent)] max-[900px]:hidden" />
      {children}
      <footer className="border-t border-rule">
        <div className="wrap py-14">
          <SupportLines />
        </div>
      </footer>
    </>
  );
}
