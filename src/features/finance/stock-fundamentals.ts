import { hash } from "@/features/news/normalize";
import { withAlphaRequest } from "@/features/market/request-budget";
import { alphaVantageKey } from "./daily-providers";
import { validDay } from "./market-calendar";
import { collectCompanyFacts } from "./sec";
import { researchIssuers } from "./stock-catalog";
import type { CompanyResearch, FinancialFact, Instrument } from "./types";
const sourceUrl = "https://www.alphavantage.co/documentation/#income-statement";
const record = (x: unknown): Record<string, unknown> => {
  if (!x || typeof x !== "object" || Array.isArray(x))
    throw new Error("invalid");
  return x as Record<string, unknown>;
};
export function parseStockIncome(
  raw: unknown,
  instrument: Instrument,
  now = new Date(),
): CompanyResearch {
  const root = record(raw),
    facts: FinancialFact[] = [];
  if (root.symbol !== instrument.symbol || !Number.isFinite(now.getTime()))
    throw new Error("identity");
  for (const [key, suffix] of [
    ["quarterlyReports", " · trimestre"],
    ["annualReports", " · año"],
  ]) {
    if (!Array.isArray(root[key])) throw new Error("missing");
    const rows = root[key]
      .map(record)
      .filter(
        (row) =>
          typeof row.fiscalDateEnding === "string" &&
          validDay(row.fiscalDateEnding) &&
          row.fiscalDateEnding <= now.toISOString().slice(0, 10),
      )
      .sort((a, b) =>
        String(b.fiscalDateEnding).localeCompare(String(a.fiscalDateEnding)),
      );
    const latest = rows[0];
    if (!latest || latest.reportedCurrency !== "USD") continue;
    for (const [tag, label] of [
      ["totalRevenue", "Ingresos"],
      ["operatingIncome", "Resultado operativo"],
      ["netIncome", "Resultado neto"],
    ]) {
      const rawValue = latest[tag];
      if (
        typeof rawValue !== "string" ||
        !/^-?\d{1,16}(?:\.\d{1,8})?$/.test(rawValue)
      )
        continue;
      const value = Number(rawValue);
      if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
        continue;
      facts.push({
        label: label + suffix,
        value,
        unit: "USD",
        end: latest.fiscalDateEnding as string,
        // The API does not supply an acceptance/filing timestamp or period start.
        // Retain retrieval day explicitly as observation, never claim SEC filed.
        filed: now.toISOString().slice(0, 10),
        filedKind: "observed",
        form: key === "quarterlyReports" ? "provider-quarter" : "provider-year",
        accession: `alpha:${instrument.symbol}:${key}:${latest.fiscalDateEnding}`,
        url: sourceUrl,
      });
    }
  }
  if (!facts.length) throw new Error("empty");
  const warnings = [
    "SEC no estuvo disponible; datos de resultados normalizados de Alpha Vantage, pendientes de contrastar con el documento oficial.",
    "No se conoce la hora de presentación ni el inicio exacto del período. La fecha marcada como observada es la captura, no una fecha de publicación SEC. No se usa para backtest de noticias ni comparación interanual.",
    "Cobertura limitada a resultados: faltan balance, flujos, segmentos, deuda completa y valoración; no se fabrica flujo libre ni precio objetivo.",
  ];
  return {
    id: hash(
      `alpha-income-v1:${instrument.id}:${JSON.stringify({ facts, warnings })}`,
    ),
    instrumentId: instrument.id,
    source: "Alpha Vantage · resultados normalizados",
    capturedAt: now.toISOString(),
    facts,
    warnings,
  };
}
export async function collectAlphaIncome(
  instrument: Instrument,
  now = new Date(),
  fetcher: typeof fetch = fetch,
  alphaRequest: typeof withAlphaRequest = withAlphaRequest,
): Promise<CompanyResearch> {
  if (
    !researchIssuers.some(
      (i) => i.symbol === instrument.symbol && i.cik === instrument.cik,
    )
  )
    throw new Error("identity");
  const key = alphaVantageKey();
  if (!key) throw new Error("configuration");
  try {
    const url = new URL("https://www.alphavantage.co/query");
    url.search = new URLSearchParams({
      function: "INCOME_STATEMENT",
      symbol: instrument.symbol,
      apikey: key,
    }).toString();
    const result = await alphaRequest(async () => {
      const response = await fetcher(url, {
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (
        !response.ok ||
        !response.body ||
        Number(response.headers.get("content-length")) > 2_000_000
      )
        throw new Error("provider");
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let bytes = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 2_000_000) {
          await reader.cancel();
          throw new Error("size");
        }
        chunks.push(part.value);
      }
      return parseStockIncome(
        JSON.parse(Buffer.concat(chunks).toString("utf8")),
        instrument,
        now,
      );
    });
    if (!result.ok) throw new Error("quota");
    return result.value;
  } catch {
    throw new Error(
      "No se confirmó el estado de resultados. Se conserva la evidencia anterior.",
    );
  }
}
export async function collectStockFacts(
  instrument: Instrument,
  now = new Date(),
) {
  try {
    const result = await collectCompanyFacts(instrument, now);
    if (result.facts.some((fact) => fact.label.startsWith("Ingresos")))
      return result;
    try {
      return await collectAlphaIncome(instrument, now);
    } catch {
      return result;
    }
  } catch {
    return collectAlphaIncome(instrument, now);
  }
}
