import { simulateReadableStream, streamText, type ToolSet } from "ai";
import { describe, expect, it } from "vitest";
import { smoothDashText, smoothDashes } from "../src/dashes";
import { scriptedModel } from "../src/testing";

const DASH = "\u2014";

async function streamed(deltas: string[]): Promise<string> {
  const model = scriptedModel([{}]);
  model.doStream = async () => ({
    stream: simulateReadableStream({
      chunks: [
        { type: "text-start" as const, id: "t" },
        ...deltas.map((delta) => ({ type: "text-delta" as const, id: "t", delta })),
        { type: "text-end" as const, id: "t" },
        {
          type: "finish" as const,
          finishReason: { unified: "stop" as const, raw: undefined },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
          },
        },
      ],
    }),
  });
  const result = streamText({ model, prompt: "x", experimental_transform: smoothDashes<ToolSet>() });
  return result.text;
}

describe("smoothing dashes in the assistant's text", () => {
  it("turns an em dash into a comma and an en dash into a hyphen", () => {
    expect(smoothDashText(`Entendi ${DASH} obrigado`)).toBe("Entendi, obrigado");
    expect(smoothDashText("de 0\u2013100")).toBe("de 0-100");
  });

  it.each([
    [["Entendi ", `${DASH} `, "obrigado ", "por ", "contar."]],
    [[`Entendi ${DASH}`, " obrigado por contar."]],
    [["Entendi", ` ${DASH} obrigado`, " por contar."]],
  ])("works however the stream splits the text: %j", async (deltas) => {
    expect(await streamed(deltas)).toBe("Entendi, obrigado por contar.");
  });

  it("keeps paragraphs and ordinary spacing", async () => {
    expect(await streamed(["Primeiro.\n", "\nSegundo, ", "e terceiro."])).toBe(
      "Primeiro.\n\nSegundo, e terceiro.",
    );
  });
});
