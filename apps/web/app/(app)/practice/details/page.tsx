import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/empty-state";
import { PracticeForm } from "@/components/practice/practice-form";
import { requireScope, runtime } from "@/lib/server/runtime";
import { savePractice } from "../actions";

export const metadata: Metadata = { title: "Practice details" };

export default async function PracticeDetailsPage() {
  const { scope } = await requireScope();
  const practice = await scope.practice.get();
  if (!practice) redirect("/practice");
  const account = await scope.profile.account();
  const emailOn = runtime().email.available;
  const hint = !emailOn
    ? "Email is not set up on this sintr. New reports show in your practice."
    : account.emailVerified
      ? `To ${account.email}: a link and a count, never who shared it or what it says.`
      : "A link and a count, never who or what. Confirm your email in Settings first.";
  return (
    <>
      <p className="mb-6">
        <Link href="/practice" className={linkStyles}>
          Your practice
        </Link>
      </p>
      <PageHeading
        title="Practice details"
        lede="What the people you invite see, and how you hear about new reports."
      />
      <div className="max-w-[40rem]">
        <PracticeForm
          save={savePractice}
          submitLabel="Save"
          defaults={{
            professionalName: practice.professionalName,
            practiceName: practice.practiceName ?? "",
            registration: practice.registration ?? "",
          }}
          notify={{ checked: practice.notifyEmail, available: emailOn && account.emailVerified, hint }}
        />
      </div>
      <section aria-labelledby="plan-title" className="mt-16 max-w-[40rem] border-t border-rule pt-12">
        <h2 id="plan-title" className="font-serif text-title-small font-normal text-ink">
          Plan and seats
        </h2>
        <p className="mt-3 text-ink-2">
          {practice.plan}.{" "}
          {practice.seats === null
            ? "Unlimited seats."
            : `${practice.seats} ${practice.seats === 1 ? "seat" : "seats"}: each patient linked, or invite waiting, uses one.`}
        </p>
        <p className="mt-2 text-[0.9375rem] text-ink-3">
          {practice.seatSource === "subscription"
            ? "Paid through Stripe."
            : practice.seatSource === "grant"
              ? "Granted for your practice by whoever runs this sintr."
              : "Set by this sintr's configuration; whoever runs it can change them."}
          {runtime().payments ? (
            <>
              {" "}
              <Link href="/plan#practice" className={linkStyles}>
                {practice.seatSource === "subscription" ? "Change the seats" : "More seats"}
              </Link>
            </>
          ) : null}
        </p>
      </section>
    </>
  );
}
