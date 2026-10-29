import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analysisSchema,
  ideaSchema,
  verifyEvidence,
} from "@/features/analysis/schemas";
import { aiConfig } from "@/features/analysis/config";
import { summarize } from "@/features/analysis/summarize";
import { makeStory } from "@/features/news/normalize";
afterEach(() => {
  vi.unstubAllEnvs();
});
describe("análisis con evidencia", () => {
  it("no convierte un titular en un resumen de un artículo no leído", async () => {
    const story = makeStory({
      title: "A technology announcement",
      url: "https://example.com/news",
      sourceName: "Test",
      sourceId: "test",
    })!;
    expect(await summarize(story)).toEqual(story);
  });
  it("rechaza ids que no aparecen en la evidencia", () => {
    expect(() => verifyEvidence(["made-up"], ["real"])).toThrow();
    expect(() => verifyEvidence(["real"], ["real"])).not.toThrow();
  });
  it("rechaza resultados sin resumen o sin referencias", () => {
    expect(
      analysisSchema.safeParse({
        title: "A valid title",
        summary: "",
        why: "context",
      }).success,
    ).toBe(false);
  });
  it("acepta que una edición no genere ninguna oportunidad", () => {
    expect(ideaSchema.parse({ ideas: [] }).ideas).toEqual([]);
  });
  it("no habilita IA con tarifas desconocidas", () => {
    vi.stubEnv("LLM_BASE_URL", "https://example.com/v1");
    vi.stubEnv("LLM_MODEL", "test");
    vi.stubEnv("LLM_API_KEY", "test");
    vi.stubEnv("AI_INPUT_USD_PER_MILLION", "");
    vi.stubEnv("AI_OUTPUT_USD_PER_MILLION", "");
    expect(aiConfig().configured).toBe(false);
  });
  it("permite un modelo local gratuito con tarifas explícitas de cero", () => {
    vi.stubEnv("LLM_BASE_URL", "http://localhost:11434/v1");
    vi.stubEnv("LLM_MODEL", "test");
    vi.stubEnv("AI_INPUT_USD_PER_MILLION", "0");
    vi.stubEnv("AI_OUTPUT_USD_PER_MILLION", "0");
    expect(aiConfig().configured).toBe(true);
  });
});
