import { and, asc, eq, gte } from "drizzle-orm";
import type { Executor } from "../db/client";
import { therapySeries, therapySeriesChanges, therapySettings } from "../db/schema";
import { SessionMove, SessionRef, SessionSeriesInput } from "../domain";
import { parseInput } from "../errors";
import type { SessionSchedule } from "../report/period";
import {
  isSeriesDay,
  nextSeriesDay,
  normalizeSeries,
  type SessionCalendar,
  type SessionChange,
  type SessionSeries,
} from "../report/sessions";
import { addDays, weekdayOf } from "../report/time";
import { inTransaction } from "./corrections";
import type { ScopeContext } from "./context";

type SeriesRow = typeof therapySeries.$inferSelect;
type ChangeRow = typeof therapySeriesChanges.$inferSelect;

const hhmm = (value: string): string => value.slice(0, 5);

export function decodeSeries(row: SeriesRow): SessionSeries {
  return {
    id: row.id,
    startsOn: row.startsOn,
    time: hhmm(row.sessionTime),
    repeat: row.repeat,
    weekdays: row.weekdays ?? [],
    stopsOn: row.stopsOn,
  };
}

export function decodeChange(row: ChangeRow): SessionChange {
  return {
    seriesId: row.seriesId,
    occursOn: row.occursOn,
    movedTo: row.movedOn && row.movedTime ? { on: row.movedOn, time: hhmm(row.movedTime) } : null,
  };
}

function columnsOf(series: Omit<SessionSeries, "id">) {
  return {
    startsOn: series.startsOn,
    sessionTime: series.time,
    repeat: series.repeat,
    weekdays: series.repeat === "weekdays" ? series.weekdays : null,
    stopsOn: series.stopsOn,
  };
}

/** The input as a series to keep: validated, a `weekdays` rhythm starting on one of its days. */
function seriesFrom(input: SessionSeriesInput): Omit<SessionSeries, "id" | "stopsOn"> {
  const parsed = parseInput(SessionSeriesInput, input);
  return normalizeSeries({
    startsOn: parsed.startsOn,
    time: parsed.time,
    repeat: parsed.repeat,
    weekdays: parsed.weekdays,
  });
}

/**
 * The person's therapy calendar. Every session is named by its series and
 * its own day in it (`SessionRef`): moving or cancelling one keeps a change
 * for that session alone; changing or stopping a rhythm "from this session
 * on" ends the old rhythm there and leaves every earlier session as it was.
 */
export function sessionsRepository({ db, userId }: ScopeContext) {
  const own = (id: string) => and(eq(therapySeries.id, id), eq(therapySeries.userId, userId));

  async function find(executor: Executor, seriesId: string): Promise<SessionSeries | null> {
    const [row] = await executor.select().from(therapySeries).where(own(seriesId));
    return row ? decodeSeries(row) : null;
  }

  /** The series that names `ref`, when `ref` is one of its own days. */
  async function resolve(executor: Executor, ref: SessionRef): Promise<SessionSeries | null> {
    const { seriesId, occursOn } = parseInput(SessionRef, ref);
    const series = await find(executor, seriesId);
    return series && isSeriesDay(series, occursOn) ? series : null;
  }

  async function dropChangesFrom(executor: Executor, seriesId: string, from: string | null): Promise<void> {
    await executor
      .delete(therapySeriesChanges)
      .where(
        and(
          eq(therapySeriesChanges.userId, userId),
          eq(therapySeriesChanges.seriesId, seriesId),
          from === null ? undefined : gte(therapySeriesChanges.occursOn, from),
        ),
      );
  }

  async function dropChange(executor: Executor, seriesId: string, occursOn: string): Promise<boolean> {
    const removed = await executor
      .delete(therapySeriesChanges)
      .where(
        and(
          eq(therapySeriesChanges.userId, userId),
          eq(therapySeriesChanges.seriesId, seriesId),
          eq(therapySeriesChanges.occursOn, occursOn),
        ),
      )
      .returning({ id: therapySeriesChanges.id });
    return removed.length > 0;
  }

  async function keepChange(
    executor: Executor,
    ref: { seriesId: string; occursOn: string },
    movedTo: { on: string; time: string } | null,
  ): Promise<void> {
    const values = { movedOn: movedTo?.on ?? null, movedTime: movedTo?.time ?? null };
    await executor
      .insert(therapySeriesChanges)
      .values({ userId, seriesId: ref.seriesId, occursOn: ref.occursOn, ...values })
      .onConflictDoUpdate({
        target: [therapySeriesChanges.seriesId, therapySeriesChanges.occursOn],
        set: { ...values, updatedAt: new Date() },
      });
  }

  async function remove(executor: Executor, seriesId: string): Promise<void> {
    await executor.delete(therapySeries).where(own(seriesId));
  }

  async function insert(executor: Executor, series: Omit<SessionSeries, "id">): Promise<SessionSeries> {
    const [row] = await executor
      .insert(therapySeries)
      .values({ userId, ...columnsOf(series) })
      .returning();
    return decodeSeries(row!);
  }

  async function calendar(executor: Executor = db): Promise<SessionCalendar> {
    const [series, changes] = await Promise.all([
      executor
        .select()
        .from(therapySeries)
        .where(eq(therapySeries.userId, userId))
        .orderBy(asc(therapySeries.startsOn), asc(therapySeries.createdAt)),
      executor.select().from(therapySeriesChanges).where(eq(therapySeriesChanges.userId, userId)),
    ]);
    return { series: series.map(decodeSeries), changes: changes.map(decodeChange) };
  }

  /**
   * Change the rhythm from the session `ref` on. Earlier sessions keep the
   * old rhythm, which stops where the new one begins (or at `ref`, if that
   * comes first); the sessions moved or cancelled from there take the new
   * rhythm. From the first session, it is the whole series that changes.
   */
  async function changeFrom(
    executor: Executor,
    ref: SessionRef,
    input: SessionSeriesInput,
  ): Promise<SessionSeries | null> {
    const next = seriesFrom(input);
    return inTransaction(executor, async (tx) => {
      const series = await resolve(tx, ref);
      if (!series) return null;
      const stop = ref.occursOn < next.startsOn ? ref.occursOn : next.startsOn;
      const stopsOn = series.stopsOn && series.stopsOn > next.startsOn ? series.stopsOn : null;
      if (stop <= series.startsOn) {
        const [row] = await tx
          .update(therapySeries)
          .set({ ...columnsOf({ ...next, stopsOn }), updatedAt: new Date() })
          .where(own(series.id))
          .returning();
        await dropChangesFrom(tx, series.id, null);
        return decodeSeries(row!);
      }
      await tx.update(therapySeries).set({ stopsOn: stop, updatedAt: new Date() }).where(own(series.id));
      await dropChangesFrom(tx, series.id, stop);
      return insert(tx, { ...next, stopsOn });
    });
  }

  return {
    calendar: () => calendar(),

    /** The calendar with the report's lead: what the report planner reads. */
    async schedule(): Promise<SessionSchedule> {
      const [held, [settings]] = await Promise.all([
        calendar(),
        db
          .select({ lead: therapySettings.reportLeadMinutes })
          .from(therapySettings)
          .where(eq(therapySettings.userId, userId)),
      ]);
      return { ...held, reportLeadMinutes: settings?.lead ?? 60 };
    },

    /** Add a session: one date, or the first of a rhythm. */
    async add(input: SessionSeriesInput): Promise<SessionSeries> {
      return insert(db, { ...seriesFrom(input), stopsOn: null });
    },

    /**
     * Move one session to another day or time. In a rhythm, a change is kept
     * for that session alone; moved back to its own day and time, it is just
     * the rhythm's session again. A session that does not repeat simply moves.
     */
    async move(ref: SessionRef, to: SessionMove): Promise<boolean> {
      const target = parseInput(SessionMove, to);
      return inTransaction(db, async (tx) => {
        const series = await resolve(tx, ref);
        if (!series) return false;
        if (series.repeat === "once") {
          await tx
            .update(therapySeries)
            .set({ startsOn: target.on, sessionTime: target.time, updatedAt: new Date() })
            .where(own(series.id));
        } else if (target.on === ref.occursOn && target.time === series.time) {
          await dropChange(tx, series.id, ref.occursOn);
        } else {
          await keepChange(tx, ref, target);
        }
        return true;
      });
    },

    /** Cancel one session: the rest of its rhythm is untouched. A session that does not repeat is removed. */
    async cancel(ref: SessionRef): Promise<boolean> {
      return inTransaction(db, async (tx) => {
        const series = await resolve(tx, ref);
        if (!series) return false;
        if (series.repeat === "once") await remove(tx, series.id);
        else await keepChange(tx, ref, null);
        return true;
      });
    },

    /** Put one session back where its rhythm has it. */
    async restore(ref: SessionRef): Promise<boolean> {
      const { seriesId, occursOn } = parseInput(SessionRef, ref);
      return dropChange(db, seriesId, occursOn);
    },

    changeFrom: (ref: SessionRef, input: SessionSeriesInput) => changeFrom(db, ref, input),

    /** Stop the rhythm from the session `ref` on; from its first session, the series is removed. */
    async stopFrom(ref: SessionRef): Promise<boolean> {
      return inTransaction(db, async (tx) => {
        const series = await resolve(tx, ref);
        if (!series) return false;
        if (series.repeat === "once" || ref.occursOn <= series.startsOn) {
          await remove(tx, series.id);
          return true;
        }
        await tx
          .update(therapySeries)
          .set({ stopsOn: ref.occursOn, updatedAt: new Date() })
          .where(own(series.id));
        await dropChangesFrom(tx, series.id, ref.occursOn);
        return true;
      });
    },

    /**
     * "Every Tuesday at 18:00", in one move (the welcome): the one weekly
     * rhythm that goes on changes from its next session to this; without
     * any rhythm going on, it is added; next to several, it is added too,
     * and nothing already in the calendar is erased.
     */
    async setWeekly(day: number, time: string, today: string): Promise<void> {
      const first = addDays(today, (day - weekdayOf(today) + 7) % 7);
      const input = { startsOn: first, time, repeat: "weekly" as const };
      const held = await calendar();
      const going = held.series.filter((series) =>
        series.repeat === "once"
          ? series.startsOn >= today
          : series.stopsOn === null || series.stopsOn > today,
      );
      const only = going.length === 1 ? going[0]! : null;
      const from = only && only.repeat === "weekly" ? nextSeriesDay(only, today) : null;
      if (only && from) {
        if (weekdayOf(only.startsOn) === day && only.time === time) return;
        await changeFrom(db, { seriesId: only.id, occursOn: from }, input);
        return;
      }
      await insert(db, { ...seriesFrom(input), stopsOn: null });
    },
  };
}
