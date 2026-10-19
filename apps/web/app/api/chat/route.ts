import { randomUUID } from "node:crypto";
import {
  runCaptureTurn,
  scopePorts,
  screenForRisk,
  serializeMessage,
  unavailableModel,
  type Metered,
  type SintrUIMessage,
  type SintrUIMessageChunk,
} from "@sintr/agent";
import { consumeStream, createUIMessageStreamResponse, type LanguageModel } from "ai";
import { z } from "zod";
import { MAX_MESSAGE_LENGTH } from "@/lib/chat";
import { assistantFor, loadMessages, titleFrom } from "@/lib/server/assistant";
import { memoryForTurn } from "@/lib/server/memory";
import { currentLanguage } from "@/lib/server/language";
import { apiError, apiScope, runtime } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

const ChatRequest = z.object({
  conversationId: z.uuid().optional(),
  trigger: z.enum(["submit-message", "regenerate-message"]),
  text: z.string().max(MAX_MESSAGE_LENGTH).optional(),
});

/**
 * One turn of the capture conversation. The server is the record of the
 * conversation: the browser sends only the new words, never the history,
 * and every message is stored sealed before and after the model runs.
 */
export async function POST(request: Request) {
  const guard = await apiScope(request);
  if (guard instanceof Response) return guard;
  const { user, scope } = guard;
  const parsed = ChatRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_request");
  const { conversationId, trigger } = parsed.data;
  const text = parsed.data.text ?? "";
  if (trigger === "submit-message" && text.trim() === "") return apiError(400, "empty_message");
  // A retry continues a stored conversation; there is nothing to retry without one.
  if (trigger === "regenerate-message" && !conversationId) return apiError(409, "nothing_to_retry");

  // Without an assistant the crisis screen still answers a message that
  // signals risk; it runs before any model is called.
  const assistant = await assistantFor(scope);
  let model: LanguageModel;
  let metered: Metered | null = null;
  if (!assistant.ok) {
    if (trigger !== "submit-message" || !screenForRisk(text).risk) return apiError(409, assistant.problem);
    model = unavailableModel();
  } else {
    model = assistant.model;
    metered = assistant.metered;
  }

  const existing = conversationId ? await scope.conversations.get(conversationId) : null;
  if (conversationId && !existing) return apiError(404, "not_found");
  // A conversation that opens on a crisis is not listed under those words.
  const title = screenForRisk(text).risk ? null : titleFrom(text);
  const conversation = existing ?? (await scope.conversations.create({ title }));
  const history = await loadMessages(scope, conversation.id);

  let message: SintrUIMessage | undefined;
  if (trigger === "submit-message") {
    message = { id: randomUUID(), role: "user", parts: [{ type: "text", text }] };
    // Kept even if the provider fails, so the person can try again.
    await scope.conversations.append(conversation.id, serializeMessage(message));
  } else if (history.at(-1)?.role !== "user") {
    return apiError(409, "nothing_to_retry");
  }

  const [profile, language] = await Promise.all([scope.profile.get(), currentLanguage()]);
  // The language the person reads sintr in: the assistant is told it, and still answers in the one they write in.
  const person = { language: language.code, timezone: profile.timezone };
  const prelude: SintrUIMessageChunk[] = existing
    ? []
    : [{ type: "data-conversation", data: { conversationId: conversation.id }, transient: true }];
  const stream = runCaptureTurn({
    model,
    history,
    ...(message ? { message } : {}),
    person,
    ports: scopePorts(scope, conversation.id, person),
    log: runtime().log.child({ userId: user.id }),
    prelude,
    // The house assistant's monthly meter; a person's own key is never counted.
    ...(metered ? { metered } : {}),
    // What sintr remembers, while the person's memory is on; asked only after the crisis screen.
    ...(assistant.ok ? { memory: memoryForTurn(scope, profile.timezone) } : {}),
    onResponse: async (response) => {
      await scope.conversations.append(conversation.id, serializeMessage(response));
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { "Cache-Control": "no-store" },
    // Read the turn to its end even if the browser goes away, so the reply
    // and its drafts are stored and appear when the page is opened again.
    consumeSseStream: ({ stream: copy }) => {
      void consumeStream({ stream: copy });
    },
  });
}
