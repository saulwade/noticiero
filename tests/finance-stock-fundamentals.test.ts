import { describe, expect, it, vi } from "vitest";
import {
  collectAlphaIncome,
  parseStockIncome,
} from "@/features/finance/stock-fundamentals";
import { researchIssuers } from "@/features/finance/stock-catalog";
import type { Instrument } from "@/features/finance/types";
const now = new Date("2026-11-01T12:00:00Z");
const issuer = researchIssuers.find((i) => i.symbol === "ALAB")!;
const instrument: Instrument = {
  ...issuer,
  id: "synthetic-issuer",
  kind: "stock",
  currency: "USD",
  fractional: false,
  createdAt: now.toISOString(),
};
const row = {
  fiscalDateEnding: "2026-06-30",
  reportedCurrency: "USD",
  totalRevenue: "100",
  operatingIncome: "-5",
  netIncome: "None",
};
const payload = () => ({
  symbol: "ALAB",
  quarterlyReports: [row],
  annualReports: [],
});
describe("resultados alternativos con fechas honestas", () => {
  it("distingue captura de presentación y no fabrica inicio del período ni ceros", () => {
    const result = parseStockIncome(payload(), instrument, now);
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0]).toMatchObject({
      filedKind: "observed",
      filed: "2026-11-01",
      end: "2026-06-30",
    });
    expect(result.facts[0].start).toBeUndefined();
    expect(result.facts[1].value).toBe(-5);
    expect(result.warnings.join(" ")).toContain(
      "no una fecha de publicación SEC",
    );
  });
  it("rechaza identidad, fechas futuras, monedas y constantes inválidas", () => {
    expect(() =>
      parseStockIncome({ ...payload(), symbol: "OTHER" }, instrument, now),
    ).toThrow();
    for (const changes of [
      { fiscalDateEnding: "2027-01-01" },
      { reportedCurrency: "EUR" },
      { totalRevenue: "Infinity", operatingIncome: "None" },
    ]) {
      expect(() =>
        parseStockIncome(
          { ...payload(), quarterlyReports: [{ ...row, ...changes }] },
          instrument,
          now,
        ),
      ).toThrow();
    }
  });
  it("consulta con cuota compartida, sin filtrar clave en fuente o error", async () => {
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "synthetic-secret");
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(payload())),
    );
    const budget = vi.fn(async (call: () => Promise<unknown>) => ({
      ok: true as const,
      value: await call(),
    }));
    const result = await collectAlphaIncome(
      instrument,
      now,
      fetcher,
      budget as never,
    );
    expect(budget).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("synthetic-secret");
    vi.unstubAllEnvs();
  });
});
