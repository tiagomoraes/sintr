import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/empty-state";
import { InvitePatient } from "@/components/practice/invite-patient";
import { seatsLine } from "@/lib/sharing";
import { requireScope } from "@/lib/server/runtime";
import { invitePatient } from "../actions";

export const metadata: Metadata = { title: "Invite a patient" };

const STEPS = [
  { title: "Make the invite", text: "One code and one link. It works for seven days, once." },
  { title: "Send it", text: "Read them the code in a session, or send the link the way you usually talk." },
  {
    title: "They accept",
    text: "They see your name and details first, give their consent, and choose how reports reach you.",
  },
];

export default async function InvitePatientPage() {
  const { scope } = await requireScope();
  if (!(await scope.practice.get())) redirect("/practice");
  const [seats, profile] = await Promise.all([scope.practice.seats(), scope.profile.get()]);
  return (
    <>
      <p className="mb-6">
        <Link href="/practice" className={linkStyles}>
          Your practice
        </Link>
      </p>
      <PageHeading
        title="Invite a patient"
        lede="Give a patient a code or a link. Once they accept it, the reports they choose to share with you arrive in your practice."
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
        {seats.seats !== null ? (
          <p role="status" className="mb-6 text-[0.9375rem] text-ink-2">
            {seatsLine(seats)}
          </p>
        ) : null}
        <InvitePatient invite={invitePatient} timezone={profile.timezone} />
        <p className="mt-10 max-w-[36em] text-[0.9375rem] text-ink-3">
          What you will see: the reports they approve and share, as they approved them. Never their entries,
          check-ins, conversations or drafts. Either of you can end the link at any time.
        </p>
      </div>
    </>
  );
}
