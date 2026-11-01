import { decimal, formatted } from "./decimal";
import { financeDay } from "./engine";
import { expectedUsClose, isUsTradingDay, validDay } from "./market-calendar";
import type { Instrument } from "./types";
import type { Quote } from "@/lib/types";

export type DailyReference = {
  value: string;
  asOf: string;
  source: string;
  sourceUrl: string;
  quote?: Quote;
};
const MAX_BYTES = 65_536;
const exchanges = new Set([
  "NASDAQ",
  "NYSE",
  "NYSEARCA",
  "AMEX",
  "NYSEAMERICAN",
]);
export function alphaVantageKey(): string | undefined {
  const key = process.env.ALPHA_VANTAGE_API_KEY?.trim();
  return key && key.toLowerCase() !== "demo" ? key : undefined;
}
export function supportsAutomaticPrice(instrument: Instrument): boolean {
  return (
    instrument.currency === "USD" &&
    (instrument.kind === "stock" || instrument.kind === "etf") &&
    exchanges.has(instrument.exchange.toUpperCase().replace(/\s+/g, "")) &&
    /^[A-Z][A-Z0-9.-]{0,14}$/.test(instrument.symbol)
  );
}
async function boundedJson(url: URL, fetcher: typeof fetch): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetcher(url, {
      signal: controller.signal,
      redirect: "error",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "Noticiero/0.1 (personal daily financial references)",
      },
    });
    if (!response.ok) throw new Error("Respuesta no disponible.");
    const declared = response.headers.get("content-length");
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES))
      throw new Error("Respuesta demasiado grande.");
    if (!response.body) throw new Error("Respuesta vacía.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BYTES) throw new Error("Respuesta demasiado grande.");
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    clearTimeout(timer);
  }
}
function record(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Respuesta inválida.");
  return raw as Record<string, unknown>;
}
function priceString(raw: unknown): string {
  if (typeof raw !== "string" || !/^\d{1,12}(?:\.\d{1,8})?$/.test(raw))
    throw new Error("Precio inválido.");
  const n = decimal(raw);
  if (n <= 0n) throw new Error("Precio inválido.");
  return formatted(n);
}
function signedNumber(raw: unknown, percentage = false): number | undefined {
  if (typeof raw !== "string" || (percentage && !raw.endsWith("%")))
    return undefined;
  const text = percentage ? raw.slice(0, -1) : raw;
  if (!/^[+-]?\d{1,12}(?:\.\d{1,8})?$/.test(text)) return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}
export async function fetchDailyPrice(
  instrument: Instrument,
  now = new Date(),
  fetcher: typeof fetch = fetch,
): Promise<DailyReference> {
  if (!supportsAutomaticPrice(instrument))
    throw new Error(
      "Este instrumento requiere una referencia manual de su mercado y moneda.",
    );
  const key = alphaVantageKey();
  if (!key)
    throw new Error(
      "Falta configurar una clave propia gratuita de Alpha Vantage.",
    );
  const session = expectedUsClose(now);
  const url = new URL("https://www.alphavantage.co/query");
  url.search = new URLSearchParams({
    function: "GLOBAL_QUOTE",
    symbol: instrument.symbol,
    apikey: key,
  }).toString();
  try {
    const body = record(
      record(await boundedJson(url, fetcher))["Global Quote"],
    );
    const asOf = body["07. latest trading day"];
    if (
      body["01. symbol"] !== instrument.symbol ||
      typeof asOf !== "string" ||
      !isUsTradingDay(asOf) ||
      asOf !== session
    )
      throw new Error("Sesión no confirmada.");
    const value = priceString(body["05. price"]);
    const change = signedNumber(body["09. change"]);
    const percent = signedNumber(body["10. change percent"], true);
    return {
      value,
      asOf,
      source: "Alpha Vantage · cierre diario",
      sourceUrl: "https://www.alphavantage.co/documentation/#latestprice",
      ...(change !== undefined && percent !== undefined
        ? {
            quote: {
              symbol: instrument.symbol,
              price: Number(value),
              change,
              percent,
              tradingDay: asOf,
              currency: "USD",
              provider: "Alpha Vantage",
              fetchedAt: now.toISOString(),
            },
          }
        : {}),
    };
  } catch {
    // Never forward a remote body, URL, api key or transport exception to storage/UI.
    throw new Error(
      "No se confirmó el cierre diario esperado. Se conserva la referencia anterior.",
    );
  }
}
export async function fetchDailyFx(
  now = new Date(),
  fetcher: typeof fetch = fetch,
): Promise<DailyReference> {
  if (!Number.isFinite(now.getTime()))
    throw new Error("Fecha de consulta inválida.");
  const day = financeDay(now);
  const url = new URL("https://api.frankfurter.dev/v2/rate/USD/MXN");
  url.searchParams.set("date", day);
  try {
    const body = record(await boundedJson(url, fetcher));
    if (
      body.base !== "USD" ||
      body.quote !== "MXN" ||
      typeof body.date !== "string" ||
      !validDay(body.date) ||
      body.date > day ||
      Date.parse(`${day}T12:00:00Z`) - Date.parse(`${body.date}T12:00:00Z`) >
        7 * 86_400_000 ||
      typeof body.rate !== "number" ||
      !Number.isFinite(body.rate) ||
      body.rate < 0.01 ||
      body.rate > 10000
    )
      throw new Error("Referencia inválida.");
    return {
      value: priceString(String(body.rate)),
      asOf: body.date,
      source: "Frankfurter · referencia diaria combinada",
      sourceUrl: url.href,
    };
  } catch {
    throw new Error(
      "No se confirmó la referencia USD/MXN. Se conserva el dato anterior.",
    );
  }
}
