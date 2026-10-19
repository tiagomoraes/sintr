import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/empty-state";
import { PracticeForm } from "@/components/practice/practice-form";
import { getMessages } from "@/lib/server/language";
import { requireScope, runtime } from "@/lib/server/runtime";
import { practicePlanName } from "@/lib/sharing";
import { savePractice } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).practice.details.title };
}

export default async function PracticeDetailsPage() {
  const { scope } = await requireScope();
  const practice = await scope.practice.get();
  if (!practice) redirect("/practice");
  const [account, messages] = await Promise.all([scope.profile.account(), getMessages()]);
  const t = messages.practice;
  const plan = t.details.plan;
  const emailOn = runtime().email.available;
  const hint = !emailOn
    ? t.details.emailOff
    : account.emailVerified
      ? t.details.emailTo(account.email)
      : t.details.emailVerify;
  return (
    <>
      <p className="mb-6">
        <Link href="/practice" className={linkStyles}>
          {t.title}
        </Link>
      </p>
      <PageHeading title={t.details.title} lede={t.details.lede} />
      <div className="max-w-[40rem]">
        <PracticeForm
          save={savePractice}
          submitLabel={t.details.save}
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
          {plan.title}
        </h2>
        <p className="mt-3 text-ink-2">
          {practicePlanName(practice.plan, messages)}.{" "}
          {practice.seats === null ? plan.unlimited : plan.seats(practice.seats)}
        </p>
        <p className="mt-2 text-[0.9375rem] text-ink-3">
          {practice.seatSource === "subscription"
            ? plan.subscription
            : practice.seatSource === "grant"
              ? plan.grant
              : plan.config}
          {runtime().payments ? (
            <>
              {" "}
              <Link href="/plan#practice" className={linkStyles}>
                {practice.seatSource === "subscription" ? plan.change : plan.more}
              </Link>
            </>
          ) : null}
        </p>
      </section>
    </>
  );
}
