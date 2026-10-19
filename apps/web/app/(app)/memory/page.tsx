import { recipientRecord } from "@sintr/agent";
import type { Memory } from "@sintr/core";
import { linkStyles } from "@sintr/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { MemoryItem, PendingButton } from "@/components/memory/memory-item";
import { formatDay, intlOf } from "@/lib/format";
import { currentLanguage, getMessages } from "@/lib/server/language";
import { memoryStateFor } from "@/lib/server/memory";
import { requireScope } from "@/lib/server/runtime";
import { correctMemory, forgetEverything, forgetMemory, readMemoryNow, turnOnMemory } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).memory.title };
}

type Words = Awaited<ReturnType<typeof getMessages>>["memory"];

/** What turning the memory on means, then the yes: the same words the consent records. */
function Offer({
  words: M,
  recipients,
  names,
  source,
  agree,
}: {
  words: Words;
  recipients: string[];
  names: string;
  source: "house" | "own" | null;
  agree: string;
}) {
  const rows = [
    { term: M.offer.what.term, body: M.offer.what.body },
    { term: M.offer.who.term, body: source === "own" ? M.offer.who.own(names) : M.offer.who.house(names) },
    { term: M.offer.kept.term, body: M.offer.kept.body },
    { term: M.offer.yours.term, body: M.offer.yours.body },
    { term: M.offer.never.term, body: M.offer.never.body },
  ];
  return (
    <section aria-label={M.offer.agree} className="max-w-[40rem]">
      <dl className="m-0 border-t border-ink">
        {rows.map((row) => (
          <div key={row.term} className="border-b border-rule py-5">
            <dt className="font-serif text-title-small font-normal text-ink">{row.term}</dt>
            <dd className="m-0 mt-2 text-ink-2">{row.body}</dd>
          </div>
        ))}
      </dl>
      <form action={turnOnMemory} className="mt-8">
        <input type="hidden" name="recipients" value={recipientRecord(recipients)} />
        <PendingButton label={agree} pending={M.offer.agreeing} />
        <p className="mt-3 text-[0.9375rem] text-ink-3">{M.offer.note}</p>
      </form>
    </section>
  );
}

export default async function MemoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { scope } = await requireScope();
  const [state, memories, progress, profile, settings, params] = await Promise.all([
    memoryStateFor(scope),
    scope.memories.list(),
    scope.memories.progress(),
    scope.profile.get(),
    scope.agentSettings.get(),
    searchParams,
  ]);
  const [t, language] = await Promise.all([getMessages(), currentLanguage()]);
  const M = t.memory;
  const locale = { language: language.code, timezone: profile.timezone };
  const list = new Intl.ListFormat(intlOf(language.code), { type: "conjunction" });
  const names = (recipients: readonly string[]) => list.format(recipients);
  const kept = state.kind === "on" || state.kind === "paused";
  // Whose key the words go with: the person's own provider, or the house's.
  const offerSource = settings.provider ? "own" : "house";

  const item = (memory: Memory) => {
    if (memory.kind === "name") {
      return (
        <MemoryItem
          key={memory.id}
          text={M.name.line(memory.text)}
          quote={null}
          source={{
            label: M.name.source,
            href: null,
            corrected: false,
            extra: (
              <Link href="/welcome?again=1" className={linkStyles}>
                {M.name.change}
              </Link>
            ),
          }}
          forget={forgetMemory.bind(null, memory.id)}
        />
      );
    }
    const day = formatDay(memory.occurredAt, locale);
    const source =
      memory.source.kind === "entry"
        ? { label: M.source.entry(day), href: `/entries/${memory.source.id}` }
        : memory.source.kind === "checkin"
          ? { label: M.source.checkin(day), href: `/checkins/${memory.source.id}` }
          : { label: day, href: null };
    return (
      <MemoryItem
        key={memory.id}
        text={memory.text}
        quote={memory.quote}
        source={{ ...source, corrected: memory.editedAt !== null }}
        correct={{ text: memory.text, action: correctMemory.bind(null, memory.id) }}
        forget={forgetMemory.bind(null, memory.id)}
      />
    );
  };

  const about = memories.filter((memory) => memory.kind !== "moment");
  const moments = memories.filter((memory) => memory.kind === "moment");

  return (
    <>
      <PageHeading title={M.heading} lede={kept ? M.lede.on : M.lede.off} />

      {params.forgot === "all" && !kept ? (
        <p role="status" className="-mt-4 mb-10 max-w-[36em] text-ink md:-mt-6">
          {M.forgetAll.done}
        </p>
      ) : null}

      {state.kind === "unavailable" ? (
        <div className="max-w-[40rem] border-t border-rule pt-6">
          <p className="text-ink-2">
            {state.reason === "not_configured" || state.reason === "off"
              ? M.unavailable[state.reason]
              : M.unavailable[state.reason](state.provider)}
          </p>
          {state.reason === "off" ? null : (
            <p className="mt-4">
              <Link href="/settings" className={linkStyles}>
                {M.unavailable.settings}
              </Link>
            </p>
          )}
        </div>
      ) : null}

      {params.changed === "1" && (state.kind === "off" || state.kind === "paused") ? (
        <p role="alert" className="mb-8 max-w-[36em] text-ink">
          {M.offer.changed}
        </p>
      ) : null}

      {state.kind === "off" ? (
        <Offer
          words={M}
          recipients={state.recipients}
          names={names(state.recipients)}
          source={offerSource}
          agree={M.offer.agree}
        />
      ) : null}

      {state.kind === "paused" ? (
        <div className="mb-14">
          <p className="mb-8 max-w-[36em] text-ink">
            {state.why === "route"
              ? M.paused.route(names(state.agreed), names(state.recipients))
              : state.why === "wording"
                ? M.paused.wording
                : `${M.paused.unavailable} ${
                    state.why === "not_configured" || state.why === "off"
                      ? M.unavailable[state.why]
                      : M.unavailable[state.why](null)
                  }`}
          </p>
          {state.why === "route" || state.why === "wording" ? (
            <Offer
              words={M}
              recipients={state.recipients}
              names={names(state.recipients)}
              source={offerSource}
              agree={M.paused.again(names(state.recipients))}
            />
          ) : null}
        </div>
      ) : null}

      {state.kind === "on" ? (
        <div className="-mt-4 mb-12 max-w-[36em] space-y-3 text-[0.9688rem] text-ink-2 md:-mt-6">
          <p>{M.status.goesTo(names(state.recipients))}</p>
          <p role="status">
            {params.read === "daily"
              ? M.status.daily
              : params.read === "failed"
                ? M.status.failed
                : progress.unread === 0
                  ? M.status.all
                  : M.status.waiting(progress.unread)}
          </p>
          {progress.unread > 0 && params.read !== "daily" ? (
            <form action={readMemoryNow}>
              <PendingButton label={M.status.readNow} pending={M.status.reading} variant="outline" />
            </form>
          ) : null}
        </div>
      ) : null}

      {kept ? (
        <>
          {memories.length === 0 ? (
            <EmptyState title={M.empty.title}>
              <p>{M.empty.body}</p>
            </EmptyState>
          ) : (
            <>
              {about.length > 0 ? (
                <section aria-labelledby="memory-about" className="mb-12">
                  <h2 id="memory-about" className="font-serif text-title-small font-normal text-ink">
                    {M.sections.about}
                  </h2>
                  <ul className="mt-4 list-none border-t border-rule p-0">{about.map(item)}</ul>
                </section>
              ) : null}
              {moments.length > 0 ? (
                <section aria-labelledby="memory-moments">
                  <h2 id="memory-moments" className="font-serif text-title-small font-normal text-ink">
                    {M.sections.moments}
                  </h2>
                  <ul className="mt-4 list-none border-t border-rule p-0">{moments.map(item)}</ul>
                </section>
              ) : null}
            </>
          )}

          <section
            aria-labelledby="memory-download"
            className="mt-16 max-w-[40rem] border-t border-rule pt-12"
          >
            <h2 id="memory-download" className="font-serif text-title-small font-normal text-ink">
              {M.download.title}
            </h2>
            <p className="mt-3 text-ink-2">
              {M.download.body}{" "}
              <a href="/api/memory" download className={linkStyles}>
                {M.download.link}
              </a>
            </p>
          </section>

          <section aria-labelledby="memory-forget" className="mt-16 max-w-[40rem] border-t border-rule pt-12">
            <h2 id="memory-forget" className="font-serif text-title-small font-normal text-ink">
              {M.forgetAll.title}
            </h2>
            <p className="mb-6 mt-3 text-ink-2">{M.forgetAll.body}</p>
            <ConfirmButton
              label={M.forgetAll.label}
              confirmLabel={M.forgetAll.confirm}
              pendingLabel={M.forgetAll.pending}
              explanation={M.forgetAll.explanation}
              action={forgetEverything}
            />
          </section>
        </>
      ) : null}
    </>
  );
}
