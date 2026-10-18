import { linkStyles } from "@sintr/ui";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap pb-24 pt-[clamp(32px,8vh,96px)]">
        <h1 className="text-title">There is nothing on this page.</h1>
        <p className="mt-4 max-w-[34em] text-lede text-ink-2">
          The address may be mistyped, or the page has moved.{" "}
          <Link href="/" className={linkStyles}>
            Go back to the start
          </Link>
          .
        </p>
      </main>
    </>
  );
}
