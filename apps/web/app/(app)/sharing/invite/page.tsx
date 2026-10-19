import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/empty-state";
import { TherapistInvite } from "@/components/sharing/therapist-invite";
import { NEVER_SHARED, SCOPE_SENTENCE } from "@/lib/sharing";
import { requireScope } from "@/lib/server/runtime";
import { inviteTherapist } from "../actions";

export const metadata: Metadata = { title: "Invite your therapist" };

const STEPS = [
  { title: "Send them the link", text: "Or read them the code. It works for seven days, once." },
  {
    title: "They accept it",
    text: "From their practice on sintr. If they have none yet, the link helps them open one.",
  },
  { title: "You confirm", text: "You see their name and details, and say yes. Only then can you share." },
];

export default async function InviteTherapistPage() {
  const { scope } = await requireScope();
  const profile = await scope.profile.get();
  return (
    <>
      <p className="mb-6">
        <Link href="/sharing" className={linkStyles}>
          Sharing
        </Link>
      </p>
      <PageHeading
        title="Invite your therapist"
        lede="Give your therapist a way to read the reports you approve, in sintr, instead of or as well as the PDF by email."
      />
      <ol className="-mt-2 mb-12 grid max-w-[44rem] list-none gap-6 p-0 sm:grid-cols-3">
        {STEPS.map((step, i) => (
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
          {SCOPE_SENTENCE} {NEVER_SHARED}
        </p>
      </div>
    </>
  );
}
