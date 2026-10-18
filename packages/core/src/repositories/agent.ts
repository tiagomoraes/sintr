import { and, asc, desc, eq } from "drizzle-orm";
import { SEALED } from "../db/sealed";
import { agentSettings, conversations, proposals } from "../db/schema";
import {
  AgentSettingsPatch,
  CheckinInput,
  EntryInput,
  type AgentSettings,
  type Checkin,
  type Entry,
  type Proposal,
  type ProposalInput,
  type ProviderCredentials,
} from "../domain";
import { InvalidStateError, NotFoundError, parseInput } from "../errors";
import { isId, type ScopeContext } from "./context";
import { inTransaction } from "./corrections";
import { checkinsRepository, entriesRepository } from "./ledger";

/** Long keys show their last four characters; short ones show nothing. */
function keyHint(key: string): string | null {
  return key.length >= 16 ? key.slice(-4) : null;
}

export function agentSettingsRepository({ db, userId, cipher }: ScopeContext) {
  const spec = SEALED.agentSettings;
  const read = async () => {
    const [row] = await db.select().from(agentSettings).where(eq(agentSettings.userId, userId));
    return row;
  };
  const decode = (row: typeof agentSettings.$inferSelect | undefined): AgentSettings => {
    const key = row?.apiKey ? cipher.openText(spec.columns.apiKey, row.apiKey) : null;
    return {
      provider: row?.provider ?? null,
      baseUrl: row?.baseUrl ?? null,
      model: row?.model ?? null,
      hasKey: key !== null,
      keyHint: key ? keyHint(key) : null,
      conversationRetentionDays: row?.conversationRetentionDays ?? null,
    };
  };

  return {
    /** What the settings screen may show. The key is reduced to a hint. */
    async get(): Promise<AgentSettings> {
      return decode(await read());
    },

    /** `apiKey`: a string replaces the key, null removes it, absent keeps it. */
    async update(patch: AgentSettingsPatch): Promise<AgentSettings> {
      const { apiKey, ...clear } = parseInput(AgentSettingsPatch, patch);
      const values = {
        ...clear,
        ...(apiKey === undefined
          ? {}
          : { apiKey: apiKey === null ? null : cipher.sealText(spec.columns.apiKey, apiKey) }),
      };
      const [row] = await db
        .insert(agentSettings)
        .values({ userId, ...values })
        .onConflictDoUpdate({ target: agentSettings.userId, set: { ...values, updatedAt: new Date() } })
        .returning();
      return decode(row);
    },

    /**
     * The provider, model and decrypted key, for the server-side call to the
     * provider. Null until a provider and a model are chosen.
     */
    async credentials(): Promise<ProviderCredentials | null> {
      const row = await read();
      if (!row?.provider || !row.model) return null;
      return {
        provider: row.provider,
        baseUrl: row.baseUrl,
        model: row.model,
        apiKey: row.apiKey ? cipher.openText(spec.columns.apiKey, row.apiKey) : null,
      };
    },
  };
}

export function proposalsRepository({ db, userId, cipher }: ScopeContext) {
  const spec = SEALED.proposals;
  const own = (id: string) => and(eq(proposals.id, id), eq(proposals.userId, userId));
  const decode = (row: typeof proposals.$inferSelect): Proposal => {
    const base = {
      id: row.id,
      conversationId: row.conversationId,
      status: row.status,
      edited: row.edited,
      recordId: row.recordId,
      decidedAt: row.decidedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    const payload = cipher.openJson(spec.columns.payload, row.payload);
    return row.kind === "entry"
      ? { ...base, kind: "entry", payload: payload as EntryInput }
      : { ...base, kind: "checkin", payload: payload as CheckinInput };
  };
  /** Validated with the same rules as a saved record, stored as JSON. */
  const validPayload = (kind: Proposal["kind"], payload: unknown) =>
    kind === "entry" ? parseInput(EntryInput, payload) : parseInput(CheckinInput, payload);

  return {
    async create(input: ProposalInput): Promise<Proposal> {
      const payload = validPayload(input.kind, input.payload);
      if (!isId(input.conversationId)) throw new NotFoundError("conversation");
      const [conversation] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.id, input.conversationId), eq(conversations.userId, userId)));
      if (!conversation) throw new NotFoundError("conversation");
      const [row] = await db
        .insert(proposals)
        .values({
          userId,
          conversationId: input.conversationId,
          kind: input.kind,
          payload: cipher.sealJson(spec.columns.payload, payload),
        })
        .returning();
      return decode(row!);
    },

    async get(id: string): Promise<Proposal | null> {
      if (!isId(id)) return null;
      const [row] = await db.select().from(proposals).where(own(id));
      return row ? decode(row) : null;
    },

    /** Every proposal of one conversation, oldest first. */
    async list(conversationId: string): Promise<Proposal[]> {
      if (!isId(conversationId)) return [];
      const rows = await db
        .select()
        .from(proposals)
        .where(and(eq(proposals.userId, userId), eq(proposals.conversationId, conversationId)))
        .orderBy(asc(proposals.createdAt))
        .limit(500);
      return rows.map(decode);
    },

    /** The most recent proposal still waiting for the person, if any. */
    async latestPending(conversationId: string): Promise<Proposal | null> {
      if (!isId(conversationId)) return null;
      const [row] = await db
        .select()
        .from(proposals)
        .where(
          and(
            eq(proposals.userId, userId),
            eq(proposals.conversationId, conversationId),
            eq(proposals.status, "proposed"),
          ),
        )
        .orderBy(desc(proposals.createdAt))
        .limit(1);
      return row ? decode(row) : null;
    },

    /**
     * The person's explicit yes. Creates the entry or check-in from the
     * draft (or from the person's edited version of it) and marks the
     * proposal saved, atomically. A proposal is decided once.
     */
    async confirm(
      id: string,
      edits?: EntryInput | CheckinInput,
    ): Promise<{ proposal: Proposal; record: Entry | Checkin }> {
      if (!isId(id)) throw new NotFoundError("proposal");
      return inTransaction(db, async (tx) => {
        const [row] = await tx.select().from(proposals).where(own(id)).for("update");
        if (!row) throw new NotFoundError("proposal");
        if (row.status !== "proposed") throw new InvalidStateError("this proposal was already decided");
        const stored = decode(row);
        const payload = edits === undefined ? stored.payload : validPayload(stored.kind, edits);
        const edited =
          edits !== undefined &&
          JSON.stringify(payload) !== JSON.stringify(validPayload(stored.kind, stored.payload));
        const scoped = { db: tx, userId, cipher };
        const record =
          stored.kind === "entry"
            ? await entriesRepository(scoped).create(payload)
            : await checkinsRepository(scoped).create(payload);
        const now = new Date();
        const [updated] = await tx
          .update(proposals)
          .set({
            status: "saved",
            recordId: record.id,
            decidedAt: now,
            edited,
            ...(edited ? { payload: cipher.sealJson(spec.columns.payload, payload) } : {}),
            updatedAt: now,
          })
          .where(own(id))
          .returning();
        return { proposal: decode(updated!), record };
      });
    },

    /** The person's no. Nothing is written to the ledger. */
    async discard(id: string): Promise<Proposal> {
      if (!isId(id)) throw new NotFoundError("proposal");
      return inTransaction(db, async (tx) => {
        const [row] = await tx.select().from(proposals).where(own(id)).for("update");
        if (!row) throw new NotFoundError("proposal");
        if (row.status !== "proposed") throw new InvalidStateError("this proposal was already decided");
        const now = new Date();
        const [updated] = await tx
          .update(proposals)
          .set({ status: "discarded", decidedAt: now, updatedAt: now })
          .where(own(id))
          .returning();
        return decode(updated!);
      });
    },
  };
}
