import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NewsCard } from "@/components/news-card";
import { summarize, ANALYSIS_VERSION } from "@/features/analysis/summarize";
import { summarizeLocally } from "@/features/analysis/local-summary";
import { generateJson } from "@/features/analysis/provider";
import { makeStory } from "@/features/news/normalize";
import type { Story } from "@/lib/types";

vi.mock("@/features/analysis/provider", () => ({ generateJson: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
function original() {
  return makeStory({
    title: "Acme announces new security service",
    excerpt:
      "Acme announced a new security service for small businesses. The service will cost $15 per month and will not change the terms of existing customer contracts. The company will launch the service next month.",
    sourceId: "test",
    sourceName: "Test Publisher",
    url: "https://example.com/security-service",
  })!;
}
function markup(story: Story) {
  return renderToStaticMarkup(
    createElement(NewsCard, {
      story,
      selected: false,
      saved: false,
      read: false,
      onSelect: () => {},
      onSave: () => {},
    }),
  );
}
describe("provenance al pasar de resumen local a API", () => {
  it("elimina metadatos extractivos y conserva fuente e identidad al generar español por API", async () => {
    const local = summarizeLocally(original());
    expect(local.summaryLanguage).toBe("en");
    vi.mocked(generateJson).mockResolvedValue({
      title: "Acme anuncia un servicio de seguridad",
      summary:
        "Acme anunció un servicio de seguridad para pequeñas empresas con un precio de 15 dólares al mes.",
      why: "Los clientes podrán revisar el producto y sus condiciones en el anuncio original.",
      evidenceIds: [local.id],
    });
    const result = await summarize(local);
    expect(result.analysisHash).toBe(
      `${ANALYSIS_VERSION}:${local.contentHash}`,
    );
    expect(result.analysis).toBe("ready");
    expect(result.excerpt).toBe(local.excerpt);
    expect(result.id).toBe(local.id);
    expect(result.references).toEqual(local.references);
    expect(result).not.toHaveProperty("summaryMethod");
    expect(result).not.toHaveProperty("summaryLanguage");
    expect(result).not.toHaveProperty("summaryVersion");
    expect(markup(result)).toContain("Resumen en español");
    expect(markup(result)).not.toContain('lang="en"');
  });
  it("repara un resultado API cacheado sin volver a llamar al proveedor", async () => {
    const local = summarizeLocally(original());
    const cached: Story = {
      ...local,
      analysis: "ready",
      summary: "Resumen en español ya verificado.",
      analysisHash: `${ANALYSIS_VERSION}:${local.contentHash}`,
    };
    const result = await summarize(cached);
    expect(result.summary).toBe(cached.summary);
    expect(result.analysisHash).toBe(cached.analysisHash);
    expect(result).not.toHaveProperty("summaryMethod");
    expect(result).not.toHaveProperty("summaryLanguage");
    expect(generateJson).not.toHaveBeenCalled();
  });
  it("conserva referencia y semántica de caché para un resultado sin metadatos locales", async () => {
    const input = original();
    const cached: Story = {
      ...input,
      analysis: "ready",
      summary: "Resumen en español ya verificado.",
      analysisHash: `${ANALYSIS_VERSION}:${input.contentHash}`,
    };
    expect(await summarize(cached)).toBe(cached);
    expect(generateJson).not.toHaveBeenCalled();
  });
  it("mantiene el original si el proveedor devuelve evidencia no permitida", async () => {
    const local = summarizeLocally(original());
    const snapshot = structuredClone(local);
    vi.mocked(generateJson).mockResolvedValue({
      title: "Acme anuncia un servicio",
      summary: "Resumen con evidencia que no está disponible en la noticia.",
      why: "Debe ser rechazado por la validación de evidencia.",
      evidenceIds: ["unrelated"],
    });
    await expect(summarize(local)).rejects.toThrow();
    expect(local).toEqual(snapshot);
  });
  it("no deja la tarjeta vacía por un resumen vacío si hay extracto original", () => {
    const input = { ...original(), summary: "   " };
    expect(markup(input)).toContain(input.excerpt);
    expect(markup(input)).not.toContain("Solo titular disponible");
  });
  it("muestra un estado explícito cuando tampoco hay extracto", () => {
    const input = {
      ...original(),
      analysis: "ready" as const,
      excerpt: "",
      summary: "",
    };
    expect(markup(input)).toContain("Solo titular disponible");
    expect(markup(input)).not.toContain("Resumen en español");
  });
});
