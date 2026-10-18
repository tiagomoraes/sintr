import { and, asc, desc, eq } from "drizzle-orm";
import { SEALED } from "../db/sealed";
import { conversations, messages } from "../db/schema";
import { MessageInput, type Conversation, type Message } from "../domain";
import { NotFoundError, parseInput } from "../errors";
import { isId, type ScopeContext } from "./context";

export function conversationsRepository({ db, userId, cipher }: ScopeContext) {
  const spec = SEALED.conversations;
  const messageSpec = SEALED.messages;
  const own = (id: string) => and(eq(conversations.id, id), eq(conversations.userId, userId));
  const decode = (row: typeof conversations.$inferSelect): Conversation => ({
    id: row.id,
    title: row.title ? cipher.openText(spec.columns.title, row.title) : null,
    lastMessageAt: row.lastMessageAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
  const decodeMessage = (row: typeof messages.$inferSelect): Message => ({
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: cipher.openText(messageSpec.columns.content, row.content),
    createdAt: row.createdAt,
  });
  const exists = async (id: string) => {
    if (!isId(id)) return false;
    const [row] = await db.select({ id: conversations.id }).from(conversations).where(own(id));
    return Boolean(row);
  };

  return {
    async create(input: { title?: string | null } = {}): Promise<Conversation> {
      const [row] = await db
        .insert(conversations)
        .values({
          userId,
          title: input.title ? cipher.sealText(spec.columns.title, input.title) : null,
        })
        .returning();
      return decode(row!);
    },

    async get(id: string): Promise<Conversation | null> {
      if (!isId(id)) return null;
      const [row] = await db.select().from(conversations).where(own(id));
      return row ? decode(row) : null;
    },

    async list(): Promise<Conversation[]> {
      const rows = await db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, userId))
        .orderBy(desc(conversations.updatedAt))
        .limit(200);
      return rows.map(decode);
    },

    async append(conversationId: string, input: MessageInput): Promise<Message> {
      const value = parseInput(MessageInput, input);
      if (!(await exists(conversationId))) throw new NotFoundError("conversation");
      const now = new Date();
      const [row] = await db
        .insert(messages)
        .values({
          userId,
          conversationId,
          role: value.role,
          content: cipher.sealText(messageSpec.columns.content, value.content),
        })
        .returning();
      await db.update(conversations).set({ lastMessageAt: now, updatedAt: now }).where(own(conversationId));
      return decodeMessage(row!);
    },

    async messages(conversationId: string): Promise<Message[]> {
      if (!isId(conversationId)) return [];
      const rows = await db
        .select()
        .from(messages)
        .where(and(eq(messages.userId, userId), eq(messages.conversationId, conversationId)))
        .orderBy(asc(messages.createdAt));
      return rows.map(decodeMessage);
    },

    async remove(id: string): Promise<boolean> {
      if (!isId(id)) return false;
      const rows = await db.delete(conversations).where(own(id)).returning({ id: conversations.id });
      return rows.length > 0;
    },
  };
}
