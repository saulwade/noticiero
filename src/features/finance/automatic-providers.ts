import { withAlphaRequest } from "@/features/market/request-budget";
import { hash } from "@/features/news/normalize";
import { alphaVantageKey, fetchDailyPrice } from "./daily-providers";
import { decimal, formatted } from "./decimal";
import { expectedUsClose, isUsTradingDay, validDay } from "./market-calendar";
import type {
  AutomationAsset,
  AutomationHistory,
  AutomationReference,
} from "./automatic-types";

export const AUTOMATION_ASSETS: AutomationAsset[] = [
  {
    symbol: "VT",
    name: "Vanguard Total World Stock ETF",
    role: "global-equity",
    currency: "USD",
    sourceUrl:
      "https://investor.vanguard.com/investment-products/etfs/profile/vt",
  },
  {
    symbol: "SGOV",
    name: "iShares 0-3 Month Treasury Bond ETF",
    role: "short-usd-treasury",
    currency: "USD",
    sourceUrl:
      "https://www.ishares.com/us/products/314116/ishares-0-3-month-treasury-bond-etf",
  },
  {
    symbol: "MXN-CASH",
    name: "Efectivo MXN sin rendimiento supuesto",
    role: "mxn-cash",
    currency: "MXN",
    sourceUrl: "https://www.banxico.org.mx/",
  },
];
export const AUTOMATION_MAX_PROVIDER_BYTES = 8_000_000;
const DAY = 86_400_000;
type Options = {
  fetcher?: typeof fetch;
  alphaRequest?: typeof withAlphaRequest;
};
const obj = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Respuesta inválida.");
  return value as Record<string, unknown>;
};
function positive(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{1,12}(?:\.\d{1,8})?$/.test(value) ||
    decimal(value) <= 0n
  )
    throw new Error("Referencia inválida.");
  return formatted(decimal(value));
}
async function boundedJson(url: URL, fetcher: typeof fetch): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetcher(url, {
      signal: controller.signal,
      redirect: "error",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "Noticiero/0.1 (bounded portfolio references)",
      },
    });
    const length = response.headers.get("content-length");
    if (
      !response.ok ||
      !response.body ||
      (length !== null &&
        (!/^\d+$/.test(length) ||
          Number(length) > AUTOMATION_MAX_PROVIDER_BYTES))
    )
      throw new Error("Respuesta no disponible.");
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > AUTOMATION_MAX_PROVIDER_BYTES)
          throw new Error("Respuesta demasiado grande.");
        chunks.push(part.value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    clearTimeout(timeout);
  }
}
export function parseWeeklyAdjusted(
  raw: unknown,
  symbol: string,
  now = new Date(),
) {
  const root = obj(raw),
    metadata = obj(root["Meta Data"]);
  if (metadata["2. Symbol"] !== symbol)
    throw new Error("Símbolo histórico no confirmado.");
  const end = expectedUsClose(now),
    cutoff = new Date(Date.parse(`${end}T12:00:00Z`) - 5 * 366 * DAY)
      .toISOString()
      .slice(0, 10);
  const entries = Object.entries(obj(root["Weekly Adjusted Time Series"]));
  if (!entries.length || entries.length > 4000)
    throw new Error("Serie histórica inválida.");
  return entries
    .map(([date, value]) => {
      if (!validDay(date) || !isUsTradingDay(date) || date > end)
        throw new Error("Fecha histórica inválida.");
      const row = obj(value);
      return {
        date,
        close: positive(row["4. close"]),
        adjustedClose: positive(row["5. adjusted close"]),
      };
    })
    .filter((p) => p.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-260);
}
export function parseHistoricalFx(raw: unknown, from: string, to: string) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 2500)
    throw new Error("Serie de divisas inválida.");
  const seen = new Set<string>();
  return raw
    .map((value) => {
      const row = obj(value);
      if (
        row.base !== "USD" ||
        row.quote !== "MXN" ||
        typeof row.date !== "string" ||
        !validDay(row.date) ||
        row.date < from ||
        row.date > to ||
        seen.has(row.date) ||
        typeof row.rate !== "number" ||
        !Number.isFinite(row.rate) ||
        row.rate < 0.01 ||
        row.rate > 10000
      )
        throw new Error("Observación de divisas inválida.");
      seen.add(row.date);
      return { date: row.date, value: positive(String(row.rate)) };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function joinHistoricalFx(
  points: ReturnType<typeof parseWeeklyAdjusted>,
  rates: ReturnType<typeof parseHistoricalFx>,
) {
  const joined: AutomationHistory["points"] = [];
  let index = -1;
  for (const point of points) {
    while (index + 1 < rates.length && rates[index + 1].date <= point.date)
      index++;
    if (
      index < 0 ||
      Date.parse(point.date) - Date.parse(rates[index].date) > 7 * DAY
    )
      continue;
    joined.push({
      ...point,
      fxMxn: rates[index].value,
      fxDate: rates[index].date,
    });
  }
  return joined;
}
export async function fetchWeeklyHistory(
  asset: AutomationAsset,
  now = new Date(),
  options: Options = {},
): Promise<AutomationHistory> {
  if (
    !AUTOMATION_ASSETS.some(
      (a) => a.symbol === asset.symbol && a.currency === "USD",
    ) ||
    !Number.isFinite(now.getTime())
  )
    throw new Error("Histórico no admitido.");
  const key = alphaVantageKey();
  if (!key)
    throw new Error("Falta configurar Alpha Vantage para obtener históricos.");
  try {
    const url = new URL("https://www.alphavantage.co/query");
    url.search = new URLSearchParams({
      function: "TIME_SERIES_WEEKLY_ADJUSTED",
      symbol: asset.symbol,
      apikey: key,
    }).toString();
    const response = await (options.alphaRequest ?? withAlphaRequest)(() =>
      boundedJson(url, options.fetcher ?? fetch),
    );
    if (!response.ok) throw new Error("Cuota compartida ocupada.");
    const prices = parseWeeklyAdjusted(response.value, asset.symbol, now);
    if (!prices.length) throw new Error("Histórico sin observaciones.");
    const from = new Date(Date.parse(prices[0].date) - 7 * DAY)
        .toISOString()
        .slice(0, 10),
      to = prices.at(-1)!.date;
    const fxUrl = new URL("https://api.frankfurter.dev/v2/rates");
    fxUrl.search = new URLSearchParams({
      base: "USD",
      quotes: "MXN",
      from,
      to,
    }).toString();
    const rates = parseHistoricalFx(
      await boundedJson(fxUrl, options.fetcher ?? fetch),
      from,
      to,
    );
    const points = joinHistoricalFx(prices, rates),
      warnings: string[] = [];
    if (points.length !== prices.length)
      warnings.push(
        "Se omitieron semanas sin USD/MXN histórico coincidente o anterior hasta siete días.",
      );
    if (points.length < 52)
      warnings.push(
        "Menos de 52 observaciones semanales: muestra insuficiente para estimar riesgo.",
      );
    if (points.length < 250)
      warnings.push(
        "La muestra no cubre cinco años completos; conserva la limitación al interpretar métricas.",
      );
    if (asset.symbol === "SGOV")
      warnings.push(
        "SGOV mantiene deuda de EE. UU. en USD; incorpora riesgo cambiario en MXN y no equivale a CETES.",
      );
    return {
      id: hash(`automatic-history:${asset.symbol}`),
      symbol: asset.symbol,
      provider: "Alpha Vantage + Frankfurter",
      currency: "USD",
      adjusted: true,
      capturedAt: now.toISOString(),
      sourceUrl: "https://www.alphavantage.co/documentation/#weeklyadj",
      fxSourceUrl: fxUrl.href,
      points,
      warnings,
    };
  } catch {
    throw new Error(
      `No se confirmó el histórico ajustado y USD/MXN de ${asset.symbol}. Se conserva la referencia anterior; revisa conexión, cobertura y cuota compartida.`,
    );
  }
}
export async function fetchAutomationReference(
  asset: AutomationAsset,
  fxMxn: string,
  now = new Date(),
  options: Options = {},
): Promise<AutomationReference> {
  if (
    !AUTOMATION_ASSETS.some(
      (a) => a.symbol === asset.symbol && a.currency === "USD",
    )
  )
    throw new Error("Referencia no admitida.");
  try {
    positive(fxMxn);
    const response = await (options.alphaRequest ?? withAlphaRequest)(() =>
      fetchDailyPrice(
        {
          id: asset.symbol,
          symbol: asset.symbol,
          name: asset.name,
          kind: "etf",
          currency: "USD",
          exchange: "NYSEARCA",
          fractional: false,
          createdAt: now.toISOString(),
        },
        now,
        options.fetcher ?? fetch,
      ),
    );
    if (!response.ok) throw new Error("Cuota compartida ocupada.");
    return {
      symbol: asset.symbol,
      price: response.value.value,
      currency: "USD",
      fxMxn,
      session: response.value.asOf,
      capturedAt: now.toISOString(),
      sourceUrl: response.value.sourceUrl,
    };
  } catch {
    throw new Error(
      `No se confirmó el cierre de ${asset.symbol}. Se conserva la referencia anterior; revisa cuota y sesión.`,
    );
  }
}
