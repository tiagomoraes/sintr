import {
  PERSON_PLANS,
  isEntitling,
  type PriceView,
  type SeatUse,
  type Subscription,
  type SubscriptionKind,
} from "@sintr/core";
import { Button, Input, linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/empty-state";
import { MeterRow } from "@/components/plan/meter-row";
import { OWN_KEY_HREF } from "@/components/talk/plan-notes";
import { formatDay } from "@/lib/format";
import { MAX_SEATS, allowanceLine, counted, formatNext, priceLine, sourceLine } from "@/lib/plan";
import { assistantState } from "@/lib/server/assistant";
import { requireScope, runtime } from "@/lib/server/runtime";
import { voiceView } from "@/lib/server/voice";
import { t } from "@/messages";
import { manageSubscription, subscribe } from "./actions";

export const metadata: Metadata = { title: "Your plan" };

const NOTICE =
  "mb-10 max-w-[40rem] rounded-file border border-rule bg-wash px-5 py-4 text-[0.9375rem] text-ink-2";
const SECTION = "mt-16 max-w-[40rem] border-t border-rule pt-12";
const HEADING = "font-serif text-title-small font-normal text-ink";

/** A price, if the payment provider says it quickly; the page never waits long for it. */
async function quickly(price: Promise<PriceView | null> | null): Promise<PriceView | null> {
  if (!price) return null;
  const late = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_500));
  return Promise.race([price.catch(() => null), late]);
}

/** Where a paid subscription stands, in one sentence. Null for a grant. */
function subscriptionLine(
  subscription: Subscription | null,
  locale: { language: string; timezone: string },
  after: string,
): string | null {
  if (!subscription || subscription.source !== "stripe") return null;
  const end = subscription.currentPeriodEnd ? formatDay(subscription.currentPeriodEnd, locale) : null;
  switch (subscription.status) {
    case "active":
    case "trialing":
      if (subscription.cancelAtPeriodEnd) {
        return `It ends${end ? ` on ${end}` : " at the end of this period"}. After that you are on ${after}, and your diary stays as it is.`;
      }
      return `Paid through Stripe${end ? `, renewing on ${end}` : ""}.`;
    case "past_due":
      return "The last payment did not go through. The plan stays while Stripe tries again; you can change the card on Stripe's page.";
    default:
      return "Your last subscription has ended.";
  }
}

function ManageButton({ subscription }: { subscription: Subscription | null }) {
  if (!subscription?.hasCustomer || !runtime().payments) return null;
  return (
    <form action={manageSubscription} className="mt-4">
      <Button type="submit" variant="outline" size="sm">
        {isEntitling(subscription.status) ? "Manage the subscription" : "Your payments and receipts"}
      </Button>
    </form>
  );
}

function seatsText(use: SeatUse): string {
  const inUse = use.active + use.held;
  if (use.seats === null) return `unlimited seats, ${counted(use.active, "patient", "patients")} linked`;
  return `${counted(use.seats, "seat", "seats")}, ${inUse} in use`;
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { scope } = await requireScope();
  const { config, payments } = runtime();
  const [assistant, month, profile, practice, practiceSubscription, params, voice] = await Promise.all([
    assistantState(scope),
    scope.plans.current(),
    scope.profile.get(),
    scope.practice.get(),
    scope.plans.subscription("practice"),
    searchParams,
    voiceView(scope),
  ]);
  const seats = practice ? await scope.practice.seats() : null;
  const locale = { language: "en", timezone: profile.timezone };
  const after = PERSON_PLANS[config.personPlan].label;
  const { plan, subscription } = month;
  const offerPersonal =
    assistant.kind === "house" && plan.id === "free" && payments !== null && payments.offers.personal;
  const practicePaid = practiceSubscription?.source === "stripe" && isEntitling(practiceSubscription.status);
  const offerPractice = practice !== null && !practicePaid && payments !== null && payments.offers.practice;
  const [personalPrice, seatPrice] = await Promise.all([
    quickly(offerPersonal ? payments.price("person") : null),
    quickly(offerPractice ? payments.price("practice") : null),
  ]);
  const subscribed = params.subscribed === "person" || params.subscribed === "practice";

  return (
    <>
      <PageHeading
        title="Your plan"
        lede="Your diary is the same on every plan: your entries, check-ins and reports never depend on it. A plan is only about how much of the assistant you can use."
      />
      {subscribed ? (
        <p role="status" className={NOTICE}>
          Thank you. Your plan changes as soon as Stripe confirms the payment, usually within a minute; this
          page shows it once it has.
        </p>
      ) : null}
      {params.billing === "unavailable" ? (
        <p role="alert" className={NOTICE}>
          The payment page could not be opened just now. Nothing was charged; try again in a moment.
        </p>
      ) : null}

      <section aria-labelledby="mine-title" className="max-w-[40rem]">
        {assistant.kind === "house" ? (
          <>
            <h2 id="mine-title" className={HEADING}>
              You are on {plan.label}.
            </h2>
            <p className="mt-3 text-ink-2">{allowanceLine(plan.allowance)}</p>
            {sourceLine(plan.source) ? (
              <p className="mt-2 text-[0.9375rem] text-ink-3">{sourceLine(plan.source)}</p>
            ) : null}
            {subscriptionLine(subscription, locale, after) ? (
              <p className="mt-2 text-[0.9375rem] text-ink-3">
                {subscriptionLine(subscription, locale, after)}
              </p>
            ) : null}
            <ManageButton subscription={subscription} />
            <h3 className="mt-10 font-sans text-label font-medium text-ink">This month</h3>
            <dl className="mt-3 border-t border-rule">
              <MeterRow
                label="Messages with the assistant"
                used={month.used.assistantMessages}
                limit={plan.allowance.assistantMessages}
              />
              <MeterRow
                label="Reports written by the assistant"
                used={month.used.reports}
                limit={plan.allowance.reports}
              />
              {voice.kind !== "unavailable" ? (
                // Speaking is counted only where the house writes it down.
                <MeterRow
                  label={t.plan.speaking}
                  used={month.used.audioMinutes}
                  limit={plan.allowance.audioMinutes}
                />
              ) : null}
            </dl>
            <p className="mt-5 text-[0.9375rem] text-ink-2">
              {plan.allowance.assistantMessages === null
                ? `The count starts again on ${formatNext(month.period.next)}.`
                : t.plan.runOut(formatNext(month.period.next))}
            </p>
          </>
        ) : assistant.kind === "own" ? (
          <>
            <h2 id="mine-title" className={HEADING}>
              You use your own key.
            </h2>
            <p className="mt-3 text-ink-2">
              Nothing is counted here, and your provider bills you directly.
              {assistant.house ? (
                <>
                  {" "}
                  You can go back to the included assistant in{" "}
                  <Link href="/settings" className={linkStyles}>
                    Settings
                  </Link>{" "}
                  whenever you want.
                </>
              ) : null}
            </p>
            <ManageButton subscription={subscription} />
          </>
        ) : (
          <>
            <h2 id="mine-title" className={HEADING}>
              There is no plan to choose here.
            </h2>
            <p className="mt-3 text-ink-2">
              This sintr has no assistant of its own, so nothing is counted: you bring your own key, and your
              provider bills you directly.{" "}
              <Link href={OWN_KEY_HREF} className={linkStyles}>
                Use your own key
              </Link>
            </p>
          </>
        )}
      </section>

      {assistant.kind === "house" && plan.id === "free" ? (
        <section aria-labelledby="more-title" className={SECTION}>
          <h2 id="more-title" className={HEADING}>
            More of the assistant
          </h2>
          <p className="mt-3 text-ink-2">
            Personal: {allowanceLine(PERSON_PLANS.personal.allowance).replace(/^./u, (c) => c.toLowerCase())}
            {personalPrice ? ` It costs ${priceLine(personalPrice)}.` : ""}
          </p>
          {offerPractice ? (
            <p className="mt-2 text-[0.9375rem] text-ink-3">
              As a therapist, the Practice plan below includes it for your own diary.
            </p>
          ) : null}
          {offerPersonal ? (
            <>
              <form action={subscribe.bind(null, "person" satisfies SubscriptionKind)} className="mt-6">
                <Button type="submit">Subscribe to Personal</Button>
              </form>
              <p className="mt-3 text-[0.9375rem] text-ink-3">
                You pay on Stripe&apos;s page and can cancel there at any time. Your diary stays as it is
                either way.
              </p>
            </>
          ) : (
            <p className="mt-3 text-[0.9375rem] text-ink-3">
              Subscriptions are not open on this sintr. Whoever runs it can give you a plan.
            </p>
          )}
          <p className="mt-8 text-ink-2">
            Or use your own key: free here, and your provider bills you.{" "}
            <Link href={OWN_KEY_HREF} className={linkStyles}>
              Use your own key
            </Link>
          </p>
        </section>
      ) : null}

      {practice && seats ? (
        <section id="practice" aria-labelledby="practice-title" className={`${SECTION} scroll-mt-8`}>
          <h2 id="practice-title" className={HEADING}>
            Your practice
          </h2>
          <p className="mt-3 text-ink-2">
            {seats.plan}: {seatsText(seats)}. Each seat is one patient linked to your practice, or an invite
            waiting for an answer.
          </p>
          {subscriptionLine(practiceSubscription, locale, "the defaults of this sintr") ? (
            <p className="mt-2 text-[0.9375rem] text-ink-3">
              {subscriptionLine(practiceSubscription, locale, "the defaults of this sintr")}
            </p>
          ) : null}
          {seats.seats !== null ? (
            <dl className="mt-6 border-t border-rule">
              <MeterRow label="Seats in use" used={seats.active + seats.held} limit={seats.seats} />
            </dl>
          ) : null}
          {practicePaid ? (
            <ManageButton subscription={practiceSubscription} />
          ) : offerPractice ? (
            <>
              <p className="mt-6 text-ink-2">
                The Practice plan: the seats you choose
                {seatPrice ? `, at ${priceLine(seatPrice)} each` : ""}, and the assistant included for your
                own diary, as on Personal.
              </p>
              <form
                action={subscribe.bind(null, "practice" satisfies SubscriptionKind)}
                className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-3"
              >
                <div>
                  <label htmlFor="plan-seats" className="block text-label font-medium text-ink">
                    Seats
                  </label>
                  <Input
                    id="plan-seats"
                    name="seats"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_SEATS}
                    defaultValue={Math.max(1, seats.active + seats.held)}
                    className="mt-2 w-28"
                  />
                </div>
                <Button type="submit">Subscribe</Button>
              </form>
              {params.billing === "seats" ? (
                <p role="alert" className="mt-3 text-[0.9375rem] text-ink">
                  Choose between 1 and {MAX_SEATS} seats.
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-6 text-[0.9375rem] text-ink-3">
              {practice.seatSource === "grant"
                ? "Granted for your practice by whoever runs this sintr."
                : "Set by this sintr's configuration; whoever runs it can change them."}
            </p>
          )}
          <p className="mt-8 text-[0.9375rem] text-ink-3">
            Your patients&apos; plans are their own. Sharing with you never changes them, so stopping costs
            them nothing.
          </p>
        </section>
      ) : null}
    </>
  );
}
