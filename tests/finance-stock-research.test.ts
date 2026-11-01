import { describe, expect, it } from "vitest";
import { buildFinanceNewsEvent } from "@/features/finance/news-research";
import { discoverStockCandidates } from "@/features/finance/stock-discovery";
import {
  stockReportSchema,
  validateStockReport,
} from "@/features/finance/stock-validation";
import { canonicalAutomation } from "@/features/finance/automatic-validation";
import type { Story } from "@/lib/types";
import type { AutomationInput } from "@/features/finance/automatic-types";
import type { StockContext } from "@/features/finance/stock-types";
const now = new Date("2026-11-01T12:00:00Z");
function event(
  title: string,
  excerpt = title,
  publishedAt = "2026-10-31T18:00:00Z",
) {
  const story: Story = {
    id: "synthetic-event",
    title,
    excerpt,
    url: "https://example.com/news/synthetic-financial-event",
    sourceId: "synthetic",
    sourceName: "Fuente sintética",
    publishedAt,
    detectedAt: now.toISOString(),
    coverage: "excerpt",
    analysis: "ready",
    category: "Finanzas",
    companies: [],
    references: [],
    score: 1,
    contentHash: title,
    kind: "news",
  };
  return buildFinanceNewsEvent(story, now)!;
}
describe("investigación de emisores relacionados", () => {
  it("un trámite de la Fed no se convierte en política monetaria por el nombre del emisor", () => {
    const notice = event(
      "Federal Reserve Board approves application by a bank",
    );
    expect(notice.eventKind).not.toBe("macro");
  });
  it("una GPU de videojuegos no activa proveedores de centros de datos", () => {
    const result = discoverStockCandidates(
      [event("NVIDIA launches a gaming GPU for desktop PCs")],
      now,
    );
    expect(result.map((c) => c.symbol)).toEqual(["NVDA"]);
  });
  it("una red densa de proveedores no desplaza una noticia reciente de consumo", () => {
    const events = [
      event("NVIDIA announces data center capex"),
      event("Google announces TPU data center capacity"),
      event("Microsoft announces GPU infrastructure expansion"),
      event("Amazon announces data center capex"),
      event("Crocs reports record revenue", undefined, "2026-11-01T11:00:00Z"),
    ];
    const result = discoverStockCandidates(events, now);
    expect(result).toHaveLength(6);
    expect(result.some((candidate) => candidate.symbol === "CROX")).toBe(true);
    expect(
      result.filter((candidate) => candidate.links.length > 0),
    ).toHaveLength(3);
  });
  it("reconoce ticker explícito y evita abreviaturas cortas ambiguas", () => {
    expect(
      event("NASDAQ: ALAB reports earnings").companies.some(
        (c) => c.symbol === "ALAB",
      ),
    ).toBe(true);
    expect(
      event("TT issues new guidance").companies.some((c) => c.symbol === "TT"),
    ).toBe(false);
    expect(
      event("NYSE: TT reports revenue").companies.some(
        (c) => c.symbol === "TT",
      ),
    ).toBe(true);
  });
  it("descubre proveedor documentado sin confundirlo con mención directa", () => {
    const result = discoverStockCandidates(
      [event("Google announces TPU data center investment")],
      now,
    );
    expect(result.find((c) => c.symbol === "CLS")).toMatchObject({
      origin: "related",
      links: [{ fromSymbol: "GOOGL", kind: "supplier" }],
    });
    expect(result.find((c) => c.symbol === "GOOGL")?.origin).toBe("direct");
    expect(result[0].symbol).toBe("CLS");
  });
  it("noticia de consumo no activa proveedores de centros de datos", () => {
    expect(
      discoverStockCandidates(
        [event("Google announces new privacy policy")],
        now,
      ).some((c) => c.symbol === "CLS"),
    ).toBe(false);
  });
  it("no usa una relación divulgada después de la noticia ni hechos futuros", () => {
    const old = event(
      "NVIDIA announces GPU data center project",
      undefined,
      "2026-10-01T12:00:00Z",
    );
    const result = discoverStockCandidates(
      [old],
      new Date("2026-10-02T12:00:00Z"),
    );
    expect(result).toEqual([]); // capture after cutoff is not known yet
    old.capturedAt = "2026-10-01T13:00:00Z";
    expect(
      discoverStockCandidates([old], new Date("2026-10-02T12:00:00Z")).some(
        (c) => c.symbol === "VRT",
      ),
    ).toBe(false);
  });
  it("marca HEYDUDE remite a CROX y conserva la fecha histórica sin ticker inventado", () => {
    const result = discoverStockCandidates(
      [event("HEYDUDE reports lower footwear revenue")],
      now,
    );
    expect(result.map((c) => c.symbol)).toEqual(["CROX"]);
    expect(result[0].links[0]).toMatchObject({
      kind: "brand",
      sourceDate: "2022-02-17",
    });
    expect(result[0].links[0].counterpoint).toMatch(/histórico/);
  });
  it("reconoce emisores fuera del catálogo de grandes empresas sin inventar relaciones", () => {
    const e = event(
      "Crocs acquires a footwear brand; Astera Labs reports revenue",
    );
    expect(e.companies.map((c) => c.symbol)).toEqual(
      expect.arrayContaining(["CROX", "ALAB"]),
    );
    const result = discoverStockCandidates([e], now);
    expect(result.every((c) => c.links.length === 0)).toBe(true);
  });
  it("no deduce relaciones nuevas de negaciones, rumores o dos nombres juntos", () => {
    const result = discoverStockCandidates(
      [event("Crocs denies acquisition of Intel supplier")],
      now,
    );
    expect(result.every((c) => c.links.length === 0)).toBe(true);
  });
  it("valida la fuente congelada y rechaza métricas inventadas o cambiadas", () => {
    const candidate = discoverStockCandidates(
      [event("Astera Labs reports revenue")],
      now,
    )[0];
    const common = {
      unit: "USD",
      start: "2026-04-01",
      end: "2026-06-30",
      filed: "2026-08-01",
      accession: "0001736297-26-000001",
      form: "10-Q",
      url: "https://www.sec.gov/example",
    };
    candidate.facts = {
      id: "synthetic-facts",
      instrumentId: "synthetic-issuer",
      capturedAt: now.toISOString(),
      source: "SEC sintética",
      warnings: [],
      facts: [
        { ...common, label: "Ingresos · trimestre", value: 100 },
        { ...common, label: "Resultado operativo · trimestre", value: 20 },
      ],
    };
    const context: StockContext = {
      version: 1,
      asOf: now.toISOString(),
      candidates: [candidate],
      warnings: [],
    };
    const input = {
      stockResearch: context,
      asOf: now.toISOString(),
    } as AutomationInput;
    const raw = {
      context,
      caveat: "Hipótesis",
      analyses: [
        {
          symbol: candidate.symbol,
          status: "partial",
          factId: "synthetic-facts",
          findings: [],
          questions: [],
          metrics: [
            {
              key: "operating-margin · trimestre",
              label: "Margen operativo",
              value: 0.2,
              unit: "ratio",
              period: "2026-04-01 / 2026-06-30",
              factIndexes: [0, 1],
            },
          ],
        },
      ],
    };
    const parsed = stockReportSchema.parse(raw),
      fail = () => {
        throw new Error("invalid");
      };
    expect(() =>
      validateStockReport(parsed, input, canonicalAutomation, fail),
    ).not.toThrow();
    const changed = structuredClone(parsed);
    changed.analyses[0].metrics[0].value = 100;
    expect(() =>
      validateStockReport(changed, input, canonicalAutomation, fail),
    ).toThrow();
    const forged = structuredClone(parsed);
    forged.context.candidates[0].links = [{ id: "invented" } as never];
    expect(() =>
      validateStockReport(forged, input, canonicalAutomation, fail),
    ).toThrow();
  });
});
