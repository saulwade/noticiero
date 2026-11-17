import { expect, it } from "vitest";
import { classifySignal, extractSignals } from "@/features/research/signals";
import { problemContext } from "@/features/evidence/engine";
import { makeStory } from "@/features/news/normalize";
import { isSelfPromotion } from "@/features/research/content-quality";
it("una reflexión literaria con accounting no es un problema de contabilidad", () => {
  expect(
    classifySignal(
      "By fully accurate accounting, all covenants that I declared. I cannot think of a more fitting name except the speaker of these lines.",
    ),
  ).toBeUndefined();
});
it("una publicación de lanzamiento no produce clientes independientes al separar sus frases", () => {
  const quote =
    "I struggle with token billing because manually matching invoices takes hours. I built my tool to fix this. Try it at https://example.com";
  const story = makeStory({
    title: "My billing tool",
    excerpt: quote,
    sourceId: "ask-hn",
    sourceName: "Ask HN",
    url: "https://news.ycombinator.com/item?id=123",
    publishedAt: "2026-11-15T00:00:00Z",
  })!;
  expect(
    extractSignals({ ...story, kind: "comment", author: "creator" }),
  ).toEqual([]);
  expect(
    problemContext({
      id: "a",
      externalId: "a",
      source: "hn",
      sourceName: "HN",
      url: story.url,
      title: "My billing tool",
      quote,
      kind: "community",
      language: "en",
      occurredAt: story.publishedAt,
      capturedAt: story.detectedAt,
    }).accepted,
  ).toBe(false);
});
it("un workaround interno sin promoción sigue siendo una señal útil", () => {
  expect(
    classifySignal(
      "We need a tool for invoice reconciliation because manually matching invoices takes 3 hours every week.",
    ),
  ).toBe("request");
});
it("full disclosure sobre usar un producto no convierte al cliente en vendedor", () => {
  expect(
    classifySignal(
      "I cannot finish my work because the token quota was exhausted. Full disclosure, I love what Anthropic has built in Claude and use the product daily.",
    ),
  ).toBe("pain");
});
it("enlazar una reproducción o datos no es autopromoción", () => {
  for (const quote of [
    "We built an n8n workflow for our customers, but the token billing fails every day and we lose 3 hours checking invoices. Reproduction: https://github.com/n8n-io/n8n/issues/43273",
    "I created a spreadsheet workaround because manually reconciling invoices takes 3 hours every day. The source data comes from https://example.com/export",
  ]) {
    expect(isSelfPromotion(quote)).toBe(false);
    expect(classifySignal(quote)).toBeDefined();
  }
});
