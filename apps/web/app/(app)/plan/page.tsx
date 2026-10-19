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
import { formatDay } from "@/lib/format";
import { MAX_SEATS, OWN_KEY_HREF, allowanceLine, formatNext, priceLine, sourceLine } from "@/lib/plan";
import { assistantState } from "@/lib/server/assistant";
import { requireScope, runtime } from "@/lib/server/runtime";
import { voiceView } from "@/lib/server/voice";
import { practicePlanName } from "@/lib/sharing";
import { currentLanguage, getMessages } from "@/lib/server/language";
import type { Messages } from "@/messages";
import { manageSubscription, subscribe } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).plan.title };
}

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
  words: Messages["plan"]["subscription"],
): string | null {
  if (!subscription || subscription.source !== "stripe") return null;
  const end = subscription.currentPeriodEnd ? formatDay(subscription.currentPeriodEnd, locale) : null;
  switch (subscription.status) {
    case "active":
    case "trialing":
      if (subscription.cancelAtPeriodEnd) return words.ends(end, after);
      return words.paid(end);
    case "past_due":
      return words.pastDue;
    default:
      return words.ended;
  }
}

function ManageButton({
  subscription,
  words,
}: {
  subscription: Subscription | null;
  words: Messages["plan"]["subscription"];
}) {
  if (!subscription?.hasCustomer || !runtime().payments) return null;
  return (
    <form action={manageSubscription} className="mt-4">
      <Button type="submit" variant="outline" size="sm">
        {isEntitling(subscription.status) ? words.manage : words.receipts}
      </Button>
    </form>
  );
}

function seatsText(use: SeatUse, words: Messages["plan"]["practice"]): string {
  const inUse = use.active + use.held;
  if (use.seats === null) return words.unlimited(use.active);
  return words.limited(use.seats, inUse);
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [t, language] = await Promise.all([getMessages(), currentLanguage()]);
  const P = t.plan;
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
  const locale = { language: language.code, timezone: profile.timezone };
  const after = P.subscription.afterPlan(P.names[config.personPlan]);
  const { plan, subscription } = month;
  const mine = subscriptionLine(subscription, locale, after, P.subscription);
  const practiceLine = subscriptionLine(practiceSubscription, locale, P.practice.after, P.subscription);
  const next = formatNext(month.period.next, language.code);
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
      <PageHeading title={P.title} lede={P.lede} />
      {subscribed ? (
        <p role="status" className={NOTICE}>
          {P.subscribed}
        </p>
      ) : null}
      {params.billing === "unavailable" ? (
        <p role="alert" className={NOTICE}>
          {P.unavailable}
        </p>
      ) : null}

      <section aria-labelledby="mine-title" className="max-w-[40rem]">
        {assistant.kind === "house" ? (
          <>
            <h2 id="mine-title" className={HEADING}>
              {P.on(P.names[plan.id])}
            </h2>
            <p className="mt-3 text-ink-2">{allowanceLine(plan.allowance, t)}</p>
            {sourceLine(plan.source, t) ? (
              <p className="mt-2 text-[0.9375rem] text-ink-3">{sourceLine(plan.source, t)}</p>
            ) : null}
            {mine ? <p className="mt-2 text-[0.9375rem] text-ink-3">{mine}</p> : null}
            <ManageButton subscription={subscription} words={P.subscription} />
            <h3 className="mt-10 font-sans text-label font-medium text-ink">{P.month}</h3>
            <dl className="mt-3 border-t border-rule">
              <MeterRow
                label={P.meters.messages}
                used={month.used.assistantMessages}
                limit={plan.allowance.assistantMessages}
              />
              <MeterRow label={P.meters.reports} used={month.used.reports} limit={plan.allowance.reports} />
              {voice.kind !== "unavailable" ? (
                // Speaking is counted only where the house writes it down.
                <MeterRow
                  label={P.speaking}
                  used={month.used.audioMinutes}
                  limit={plan.allowance.audioMinutes}
                />
              ) : null}
            </dl>
            <p className="mt-5 text-[0.9375rem] text-ink-2">
              {plan.allowance.assistantMessages === null ? P.startsAgain(next) : P.runOut(next)}
            </p>
          </>
        ) : assistant.kind === "own" ? (
          <>
            <h2 id="mine-title" className={HEADING}>
              {P.own.title}
            </h2>
            <p className="mt-3 text-ink-2">
              {P.own.body}
              {assistant.house ? (
                <>
                  {" "}
                  {P.own.back}{" "}
                  <Link href="/settings" className={linkStyles}>
                    {P.own.backLink}
                  </Link>{" "}
                  {P.own.backAfter}
                </>
              ) : null}
            </p>
            <ManageButton subscription={subscription} words={P.subscription} />
          </>
        ) : (
          <>
            <h2 id="mine-title" className={HEADING}>
              {P.none.title}
            </h2>
            <p className="mt-3 text-ink-2">
              {P.none.body}{" "}
              <Link href={OWN_KEY_HREF} className={linkStyles}>
                {P.ownKey}
              </Link>
            </p>
          </>
        )}
      </section>

      {assistant.kind === "house" && plan.id === "free" ? (
        <section aria-labelledby="more-title" className={SECTION}>
          <h2 id="more-title" className={HEADING}>
            {P.more.title}
          </h2>
          <p className="mt-3 text-ink-2">
            {P.more.personal(
              P.names.personal,
              allowanceLine(PERSON_PLANS.personal.allowance, t).replace(/^./u, (c) => c.toLowerCase()),
              personalPrice ? priceLine(personalPrice, t, language.code) : null,
            )}
          </p>
          {offerPractice ? <p className="mt-2 text-[0.9375rem] text-ink-3">{P.more.practice}</p> : null}
          {offerPersonal ? (
            <>
              <form action={subscribe.bind(null, "person" satisfies SubscriptionKind)} className="mt-6">
                <Button type="submit">{P.more.subscribe(P.names.personal)}</Button>
              </form>
              <p className="mt-3 text-[0.9375rem] text-ink-3">{P.more.stripe}</p>
            </>
          ) : (
            <p className="mt-3 text-[0.9375rem] text-ink-3">{P.more.closed}</p>
          )}
          <p className="mt-8 text-ink-2">
            {P.more.ownKey}{" "}
            <Link href={OWN_KEY_HREF} className={linkStyles}>
              {P.ownKey}
            </Link>
          </p>
        </section>
      ) : null}

      {practice && seats ? (
        <section id="practice" aria-labelledby="practice-title" className={`${SECTION} scroll-mt-8`}>
          <h2 id="practice-title" className={HEADING}>
            {P.practice.title}
          </h2>
          <p className="mt-3 text-ink-2">
            {P.practice.summary(practicePlanName(seats.plan, t), seatsText(seats, P.practice))}
          </p>
          {practiceLine ? <p className="mt-2 text-[0.9375rem] text-ink-3">{practiceLine}</p> : null}
          {seats.seats !== null ? (
            <dl className="mt-6 border-t border-rule">
              <MeterRow label={P.practice.inUse} used={seats.active + seats.held} limit={seats.seats} />
            </dl>
          ) : null}
          {practicePaid ? (
            <ManageButton subscription={practiceSubscription} words={P.subscription} />
          ) : offerPractice ? (
            <>
              <p className="mt-6 text-ink-2">
                {P.practice.offer(seatPrice ? priceLine(seatPrice, t, language.code) : null)}
              </p>
              <form
                action={subscribe.bind(null, "practice" satisfies SubscriptionKind)}
                className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-3"
              >
                <div>
                  <label htmlFor="plan-seats" className="block text-label font-medium text-ink">
                    {P.practice.seats}
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
                <Button type="submit">{P.practice.subscribe}</Button>
              </form>
              {params.billing === "seats" ? (
                <p role="alert" className="mt-3 text-[0.9375rem] text-ink">
                  {P.practice.range(MAX_SEATS)}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-6 text-[0.9375rem] text-ink-3">
              {practice.seatSource === "grant" ? P.practice.grant : P.practice.config}
            </p>
          )}
          <p className="mt-8 text-[0.9375rem] text-ink-3">{P.practice.patients}</p>
        </section>
      ) : null}
    </>
  );
}
