import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/empty-state";
import { TherapistInvite } from "@/components/sharing/therapist-invite";
import { getMessages } from "@/lib/server/language";
import { requireScope } from "@/lib/server/runtime";
import { inviteTherapist } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).sharing.invite.title };
}

export default async function InviteTherapistPage() {
  const { scope } = await requireScope();
  const [profile, messages] = await Promise.all([scope.profile.get(), getMessages()]);
  const t = messages.sharing;
  return (
    <>
      <p className="mb-6">
        <Link href="/sharing" className={linkStyles}>
          {t.title}
        </Link>
      </p>
      <PageHeading title={t.invite.title} lede={t.invite.lede} />
      <ol className="-mt-2 mb-12 grid max-w-[44rem] list-none gap-6 p-0 sm:grid-cols-3">
        {t.invite.steps.map((step, i) => (
          <li key={step.title} className="border-t border-ink pt-4">
            <span
              aria-hidden="true"
              className="font-serif text-[1.75rem] font-light leading-none text-ink-soft"
            >
              {i + 1}
            </span>
            <p className="mt-2 font-serif text-[1.125rem] text-ink">{step.title}</p>
            <p className="mt-1 text-[0.9375rem] text-ink-3">{step.text}</p>
          </li>
        ))}
      </ol>
      <div className="max-w-[40rem]">
        <TherapistInvite
          invite={inviteTherapist}
          timezone={profile.timezone}
          defaultName={profile.displayName ?? ""}
        />
        <p className="mt-10 max-w-[36em] text-[0.9375rem] text-ink-3">
          {t.scope} {t.never}
        </p>
      </div>
    </>
  );
}
