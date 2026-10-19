import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { ConnectFlow } from "@/components/connect/connect-flow";
import { KeyList } from "@/components/connect/key-list";
import { TechnicalDetails } from "@/components/connect/technical-details";
import { PageHeading } from "@/components/empty-state";
import { onlyReachableHere } from "@/lib/connect";
import { workingKeys } from "@/lib/server/keys";
import { requireScope, runtime } from "@/lib/server/runtime";
import { getMessages } from "@/lib/server/language";
import { makeKey } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).connect.title };
}

export default async function ConnectPage() {
  const t = await getMessages();
  const { scope } = await requireScope();
  const keys = await workingKeys(scope);
  const appUrl = runtime().config.url.origin;

  return (
    <>
      <PageHeading title={t.connect.title} lede={t.connect.lede} />
      <p className="-mt-4 mb-12 max-w-[36em] text-[0.9688rem] text-ink-2 md:-mt-6">
        {t.connect.instead}{" "}
        <Link href="/home" className={linkStyles}>
          {t.connect.insteadLink}
        </Link>{" "}
        {t.connect.insteadAfter}
      </p>

      <ConnectFlow
        appUrl={appUrl}
        reachableHere={onlyReachableHere(appUrl)}
        keys={keys}
        make={makeKey}
        connected={
          keys.length ? (
            <section aria-labelledby="connected-title" className="mb-16 max-w-[40rem]">
              <h2 id="connected-title" className="font-serif text-title-small font-normal text-ink">
                Your assistants
              </h2>
              <div className="mt-5">
                <KeyList keys={keys} />
              </div>
            </section>
          ) : null
        }
      />
      <TechnicalDetails appUrl={appUrl} />
    </>
  );
}
