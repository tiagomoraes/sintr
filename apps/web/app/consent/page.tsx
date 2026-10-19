import { HEALTH_DATA_CONSENT_VERSION } from "@sintr/core";
import { Button, Checkbox, FieldError } from "@sintr/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConsentStatement } from "@/components/consent-statement";
import { SignOutButton } from "@/components/sign-out-button";
import { SiteHeader } from "@/components/site-header";
import { SupportLines } from "@/components/support-lines";
import { getMessages } from "@/lib/server/language";
import { requireUser, runtime } from "@/lib/server/runtime";
import { grantConsent } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.consent.title };
}

/**
 * Shown when the current consent is not on record (for example after its
 * wording changes). Nothing in the diary opens until it is given.
 */
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const scope = await runtime().repositories.forUser(user.id);
  const latest = await scope.consents.latest("health_data_processing");
  if (latest?.granted && latest.version === HEALTH_DATA_CONSENT_VERSION) redirect("/home");
  const missing = (await searchParams).missing === "1";
  const t = (await getMessages()).auth.consent;

  return (
    <>
      <SiteHeader>
        <SignOutButton />
      </SiteHeader>
      <main id="main" className="wrap grid grid-cols-12 gap-x-6 pb-24 pt-[clamp(32px,8vh,96px)]">
        <div className="col-span-12 md:col-span-7 lg:col-span-6">
          <h1 className="text-title">{t.heading}</h1>
          <p className="mt-4 text-lede text-ink-2">{t.lede}</p>
          <form action={grantConsent} className="mt-10 space-y-6">
            <div className="flex items-start gap-3">
              <Checkbox id="consent" name="consent" required />
              <label htmlFor="consent" className="text-[0.9688rem] leading-[1.55] text-ink-2">
                <ConsentStatement />
              </label>
            </div>
            {missing ? <FieldError>{t.missing}</FieldError> : null}
            <Button type="submit">{t.agree}</Button>
          </form>
        </div>
      </main>
      <footer className="border-t border-rule">
        <div className="wrap py-14">
          <SupportLines />
        </div>
      </footer>
    </>
  );
}
