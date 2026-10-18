import type { StreamTextTransform, TextStreamPart, ToolSet } from "ai";

/**
 * sintr's copy has no em dashes or en dashes, and models are fond of them.
 * This rewrites them in the assistant's streamed text only: an em dash
 * becomes a comma, an en dash (a range) a hyphen. Tool inputs, and so the
 * person's words in a draft, pass through untouched.
 */
export function smoothDashText(text: string): string {
  return text.replace(/\s*\u2014\s*/gu, ", ").replace(/\u2013/gu, "-");
}

export function smoothDashes<TOOLS extends ToolSet>(): StreamTextTransform<TOOLS> {
  return () => {
    // Trailing whitespace is held back one delta, so a dash that arrives at
    // the start of the next delta still loses the space before it.
    let pending = "";
    let lastId: string | undefined;
    const flush = (controller: TransformStreamDefaultController<TextStreamPart<TOOLS>>) => {
      if (pending && lastId !== undefined)
        controller.enqueue({ type: "text-delta", id: lastId, text: pending });
      pending = "";
    };
    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(part, controller) {
        if (part.type !== "text-delta") {
          flush(controller);
          controller.enqueue(part);
          return;
        }
        lastId = part.id;
        const lead = /^ /u.test(part.text) && /^ +$/u.test(pending) ? "" : pending;
        const text = smoothDashText(lead + part.text);
        pending = /\s+$/u.exec(text)?.[0] ?? "";
        const kept = text.slice(0, text.length - pending.length);
        if (kept.length > 0) controller.enqueue({ ...part, text: kept });
      },
      flush(controller) {
        flush(controller);
      },
    });
  };
}
