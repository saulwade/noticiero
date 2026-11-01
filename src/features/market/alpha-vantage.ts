import { withAlphaRequest } from "./request-budget";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { quotes, quoteHistory } from "@/db/schema";
import { fetchExternal } from "@/lib/http";
import { getCompany } from "./company-catalog";
import type { Quote } from "@/lib/types";
const number = z
  .string()
  .transform((value) => Number(value.replace("%", "")))
  .pipe(z.number().finite());
const quoteSchema = z.object({
  "01. symbol": z.string(),
  "05. price": number.pipe(z.number().positive()),
  "07. latest trading day": z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  "09. change": number,
  "10. change percent": number,
});
export function parseQuote(raw: unknown, expected: string): Quote {
  const body = z.object({ "Global Quote": quoteSchema }).parse(raw)[
    "Global Quote"
  ];
  if (
    body["01. symbol"] !== expected ||
    !getCompany(expected) ||
    getCompany(expected)?.private
  )
    throw new Error("La cotización no corresponde al símbolo solicitado.");
  return {
    symbol: expected,
    price: body["05. price"],
    change: body["09. change"],
    percent: body["10. change percent"],
    tradingDay: body["07. latest trading day"],
    currency: "USD",
    fetchedAt: new Date().toISOString(),
    provider: "Alpha Vantage",
  };
}
export async function updateQuote(symbol: string): Promise<void> {
  if (
    !process.env.ALPHA_VANTAGE_API_KEY ||
    !getCompany(symbol) ||
    getCompany(symbol)?.private
  )
    return;
  const db = await getDb();
  const cached = (
    await db.select().from(quotes).where(eq(quotes.symbol, symbol))
  )[0]?.data;
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < 10 * 3600000)
    return;
  const url = new URL("https://www.alphavantage.co/query");
  url.search = new URLSearchParams({
    function: "GLOBAL_QUOTE",
    symbol,
    apikey: process.env.ALPHA_VANTAGE_API_KEY,
  }).toString();
  const result = await withAlphaRequest(async () => {
    const response = await fetchExternal(url.href, ["www.alphavantage.co"], 1);
    return parseQuote(await response.json(), symbol);
  });
  if (!result.ok) return;
  const data = result.value;
  await db
    .insert(quotes)
    .values({ symbol, data })
    .onConflictDoUpdate({ target: quotes.symbol, set: { data } });
  await db
    .insert(quoteHistory)
    .values({ id: `${symbol}:${data.tradingDay}`, data })
    .onConflictDoUpdate({ target: quoteHistory.id, set: { data } });
}
export { quoteAfterStory } from "./presentation";
