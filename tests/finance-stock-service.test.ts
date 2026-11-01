import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import * as t from "@/db/schema";
import {
  prepareStockContext,
  type StockProviders,
} from "@/features/finance/stock-service";
import { assertFinanceCapacity } from "@/features/finance/capacity";
import { buildFinanceNewsEvent } from "@/features/finance/news-research";
import { automationInputHash } from "@/features/finance/automatic-validation";
import type { AutomationInput } from "@/features/finance/automatic-types";
import type { Story } from "@/lib/types";
vi.mock("@/features/finance/capacity", () => ({
  assertFinanceCapacity: vi.fn(async () => {}),
}));
const now = new Date("2026-11-01T12:00:00Z");
function event(title: string) {
  return buildFinanceNewsEvent(
    {
      id: title,
      title,
      excerpt: title,
      url: "https://example.com/news/synthetic-finance",
      sourceId: "synthetic",
      sourceName: "Fuente sintética",
      publishedAt: "2026-10-31T12:00:00Z",
      detectedAt: now.toISOString(),
      coverage: "excerpt",
      category: "Finanzas",
      analysis: "ready",
      companies: [],
      references: [],
      score: 1,
      contentHash: title,
      kind: "news",
    } as Story,
    now,
  )!;
}
function providers(): StockProviders {
  return {
    facts: vi.fn(async (instrument) => ({
      id: `facts:${instrument.symbol}`,
      instrumentId: instrument.id,
      capturedAt: now.toISOString(),
      source: "Fixture SEC",
      facts: [],
      warnings: [],
    })),
    history: vi.fn<StockProviders["history"]>(async (asset) => ({
      id: `history:${asset.symbol}`,
      symbol: asset.symbol,
      currency: "USD",
      adjusted: true,
      provider: "Fixture",
      capturedAt: now.toISOString(),
      sourceUrl: "https://example.com/history",
      points: [],
      warnings: [],
    })),
  };
}
beforeEach(async () => {
  const db = await getDb();
  await db.delete(t.usage);
  for (const table of [t.financeResearch, t.financeHistories, t.financeSync])
    await db.delete(table);
  vi.mocked(assertFinanceCapacity).mockReset().mockResolvedValue(undefined);
});
describe("preparación automática acotada de acciones", () => {
  it("cuota agotada deja datos pendientes hasta el siguiente día UTC sin falsa avería", async () => {
    const db = await getDb(),
      source = providers();
    await db.insert(t.usage).values({ key: "quote:2026-11-01", amount: 20 });
    vi.mocked(source.facts).mockRejectedValue(new Error("quota"));
    vi.mocked(source.history).mockRejectedValue(new Error("quota"));
    const events = [event("Astera Labs reports revenue")];
    const first = await prepareStockContext(events, now, source);
    expect(first.warnings.join(" ")).toContain(
      "Cuota gratuita compartida en pausa",
    );
    expect(
      (await db.select().from(t.financeSync)).every(
        (row) => row.data.status === "configuration",
      ),
    ).toBe(true);
    const later = new Date(now.getTime() + 60000),
      retry = await prepareStockContext(events, later, source);
    expect(source.facts).toHaveBeenCalledTimes(1);
    expect(source.history).toHaveBeenCalledTimes(1);
    expect(
      automationInputHash({
        asOf: now.toISOString(),
        stockResearch: first,
      } as AutomationInput),
    ).toBe(
      automationInputHash({
        asOf: later.toISOString(),
        stockResearch: retry,
      } as AutomationInput),
    );
    await prepareStockContext(
      events,
      new Date(now.getTime() + 86400000),
      source,
    );
    expect(source.facts).toHaveBeenCalledTimes(2);
  });
  it("consulta por lotes, conserva evidencia y no crea instrumentos ni operaciones", async () => {
    const db = await getDb(),
      beforeInstruments = await db.select().from(t.financeInstruments),
      beforeMovements = await db.select().from(t.financeMovements);
    const source = providers(),
      events = [
        event("NVIDIA announces GPU data center infrastructure expansion"),
      ];
    const first = await prepareStockContext(events, now, source);
    expect(source.facts).toHaveBeenCalledTimes(3);
    expect(source.history).toHaveBeenCalledTimes(1);
    expect(first.candidates).toHaveLength(4);
    await prepareStockContext(events, new Date(now.getTime() + 60000), source);
    expect(source.facts).toHaveBeenCalledTimes(4);
    expect(source.history).toHaveBeenCalledTimes(2);
    expect(await db.select().from(t.financeResearch)).toHaveLength(4);
    expect(await db.select().from(t.financeInstruments)).toEqual(
      beforeInstruments,
    );
    expect(await db.select().from(t.financeMovements)).toEqual(beforeMovements);
  });
  it("un fallo de fuente conserva caché y respeta enfriamiento sin reintentar en cada lectura", async () => {
    const source = providers();
    vi.mocked(source.facts).mockRejectedValue(
      new Error("remote credential must never leak"),
    );
    const events = [event("Astera Labs reports revenue")];
    const first = await prepareStockContext(events, now, source);
    expect(JSON.stringify(first)).not.toContain("credential");
    expect(first.candidates[0].facts).toBeUndefined();
    await prepareStockContext(events, new Date(now.getTime() + 60000), source);
    expect(source.facts).toHaveBeenCalledTimes(1);
  });
  it("un refresh SEC idéntico usa exactamente la observación persistida y conserva hash", async () => {
    const db = await getDb(),
      source = providers(),
      old = "2026-10-01T00:00:00Z";
    await db.insert(t.financeResearch).values({
      id: "facts:ALAB",
      data: {
        id: "facts:ALAB",
        instrumentId: "research-issuer:0001736297",
        capturedAt: old,
        source: "Fixture SEC",
        facts: [],
        warnings: [],
      },
    });
    const events = [event("Astera Labs reports revenue")];
    const first = await prepareStockContext(events, now, source),
      later = new Date(now.getTime() + 60000);
    const second = await prepareStockContext(events, later, source);
    expect(first.candidates[0].facts?.capturedAt).toBe(old);
    expect(second.candidates[0].facts).toEqual(first.candidates[0].facts);
    expect(
      automationInputHash({
        asOf: now.toISOString(),
        stockResearch: first,
      } as AutomationInput),
    ).toBe(
      automationInputHash({
        asOf: later.toISOString(),
        stockResearch: second,
      } as AutomationInput),
    );
    expect(source.facts).toHaveBeenCalledTimes(1);
  });
  it("rollback de capacidad no filtra la observación nueva al contexto devuelto", async () => {
    const source = providers();
    vi.mocked(assertFinanceCapacity).mockRejectedValue(new Error("capacity"));
    const result = await prepareStockContext(
      [event("Astera Labs reports revenue")],
      now,
      source,
    );
    expect(result.candidates[0].facts).toBeUndefined();
    expect(result.candidates[0].history).toBeUndefined();
    const db = await getDb();
    expect(await db.select().from(t.financeResearch)).toEqual([]);
    expect(await db.select().from(t.financeHistories)).toEqual([]);
  });
});
