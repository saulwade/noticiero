import { assertFinanceCapacity } from "./capacity";
import { withAlphaRequest } from "@/features/market/request-budget";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb, resultRows } from "@/db/client";
import {
  financeInstruments,
  financeMarks,
  financeSync,
  quotes,
  quoteHistory,
} from "@/db/schema";
import { hash } from "@/features/news/normalize";
import { decimal, formatted } from "./decimal";
import { financeDay } from "./engine";
import { expectedUsClose } from "./market-calendar";
import {
  alphaVantageKey,
  fetchDailyFx,
  fetchDailyPrice,
  supportsAutomaticPrice,
  type DailyReference,
} from "./daily-providers";
import type { FinanceMark, FinanceSyncState, Instrument } from "./types";

type Providers = { fx: typeof fetchDailyFx; price: typeof fetchDailyPrice };
const defaults: Providers = { fx: fetchDailyFx, price: fetchDailyPrice };
const cooldown = 6 * 3600000;
const lock = sql`SELECT pg_advisory_xact_lock(7202633)`;
type Target = {
  id: string;
  label: string;
  provider: string;
  session: string;
  instrument?: Instrument;
};
async function reserve(target: Target, now: Date) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.execute(lock);
    const previous = (
      await tx.select().from(financeSync).where(eq(financeSync.id, target.id))
    )[0]?.data;
    if (
      previous?.status === "running" &&
      Date.parse(previous.leaseUntil ?? "") > now.getTime()
    )
      return;
    if (
      previous?.status === "ok" &&
      previous.session === target.session &&
      (previous.asOf === target.session ||
        now.getTime() - Date.parse(previous.lastAttempt ?? "") < cooldown)
    )
      return;
    if (
      previous?.status === "error" &&
      now.getTime() - Date.parse(previous.lastAttempt ?? "") < cooldown
    )
      return;
    const state: FinanceSyncState = {
      ...previous,
      id: target.id,
      label: target.label,
      provider: target.provider,
      instrumentId: target.instrument?.id,
      status: "running",
      message: "Consultando referencia diaria.",
      session: target.session,
      lastAttempt: now.toISOString(),
      leaseToken: randomUUID(),
      leaseUntil: new Date(now.getTime() + 10 * 60000).toISOString(),
    };
    await tx
      .insert(financeSync)
      .values({ id: state.id, data: state })
      .onConflictDoUpdate({ target: financeSync.id, set: { data: state } });
    return state;
  });
}
async function finish(
  state: FinanceSyncState,
  status: FinanceSyncState["status"],
  message: string,
  now: Date,
  reference?: DailyReference,
) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.execute(lock);
    const current = (
      await tx.select().from(financeSync).where(eq(financeSync.id, state.id))
    )[0]?.data;
    if (current?.leaseToken !== state.leaseToken) return;
    if (reference) {
      const id = hash(
        `daily:${state.provider}:${state.id}:${reference.asOf}:${reference.value}`,
      );
      const duplicate = (
        await tx
          .select({ id: financeMarks.id })
          .from(financeMarks)
          .where(eq(financeMarks.id, id))
      ).length;
      if (!duplicate) {
        const count = resultRows(
          await tx.execute(sql`SELECT count(*)::int AS n FROM finance_marks`),
        ) as { n: number }[];
        if (count[0].n >= 20000) throw new Error("storage");
        const { quote: _quote, ...observation } = reference; // eslint-disable-line @typescript-eslint/no-unused-vars
        const mark: FinanceMark = {
          id,
          kind: state.instrumentId ? "price" : "fx",
          instrumentId: state.instrumentId,
          ...observation,
          capturedAt: now.toISOString(),
          automatic: true,
          provider: state.instrumentId ? "alpha-vantage" : "frankfurter",
        };
        await tx
          .insert(financeMarks)
          .values({ id, data: mark })
          .onConflictDoNothing();
      }
    }
    if (reference?.quote) {
      const quote = reference.quote;
      await tx
        .insert(quotes)
        .values({ symbol: quote.symbol, data: quote })
        .onConflictDoUpdate({
          target: quotes.symbol,
          set: { data: quote },
          setWhere: sql`${quotes.data}->>'tradingDay' <= ${quote.tradingDay}`,
        });
      await tx
        .insert(quoteHistory)
        .values({ id: `${quote.symbol}:${quote.tradingDay}`, data: quote })
        .onConflictDoUpdate({ target: quoteHistory.id, set: { data: quote } });
    }
    const next: FinanceSyncState = {
      ...current,
      status,
      message,
      leaseToken: undefined,
      leaseUntil: undefined,
      ...(reference
        ? {
            asOf: reference.asOf,
            value: reference.value,
            lastSuccess: now.toISOString(),
          }
        : {}),
    };
    await tx
      .insert(financeSync)
      .values({ id: state.id, data: next })
      .onConflictDoUpdate({ target: financeSync.id, set: { data: next } });
    await assertFinanceCapacity(tx);
  });
}
async function cachedPrice(
  instrument: Instrument,
  session: string,
): Promise<DailyReference | undefined> {
  const row = (
    await (
      await getDb()
    )
      .select()
      .from(quotes)
      .where(eq(quotes.symbol, instrument.symbol))
  )[0]?.data;
  if (
    !row ||
    row.currency !== "USD" ||
    row.provider !== "Alpha Vantage" ||
    row.tradingDay !== session ||
    !Number.isFinite(row.price) ||
    row.price <= 0 ||
    row.price >= 1e12
  )
    return;
  const value = String(row.price);
  if (!/^\d{1,12}(?:\.\d{1,8})?$/.test(value)) return;
  return {
    value: formatted(decimal(value)),
    asOf: session,
    source: "Alpha Vantage · cierre diario (caché compartida)",
    sourceUrl: "https://www.alphavantage.co/documentation/#latestprice",
  };
}
export async function syncDailyFinance(
  now = new Date(),
  providers: Providers = defaults,
  timing: Parameters<typeof withAlphaRequest>[1] = {},
) {
  const db = await getDb();
  const instruments = (await db.select().from(financeInstruments))
    .map((r) => r.data)
    .slice(0, 8);
  const targets: Target[] = [
    {
      id: "fx:USD/MXN",
      label: "USD/MXN",
      provider: "Frankfurter",
      session: financeDay(now),
    },
    ...instruments.map((i) => ({
      id: `price:${i.id}`,
      label: `${i.symbol} · ${i.exchange} · ${i.currency}`,
      provider: "Alpha Vantage",
      session: expectedUsClose(now),
      instrument: i,
    })),
  ];
  const result = { updated: 0, skipped: 0, failed: 0 };
  for (const target of targets) {
    const state = await reserve(target, now);
    if (!state) {
      result.skipped++;
      continue;
    }
    if (target.instrument && !supportsAutomaticPrice(target.instrument)) {
      await finish(
        state,
        "manual",
        "Este listado o instrumento requiere referencia manual; no se sustituye por otra moneda o mercado.",
        now,
      );
      result.skipped++;
      continue;
    }
    try {
      let reference: DailyReference;
      if (target.instrument) {
        const cached = await cachedPrice(target.instrument, target.session);
        if (cached) reference = cached;
        else {
          if (!alphaVantageKey()) {
            await finish(
              state,
              "configuration",
              "Falta configurar una clave gratuita propia de Alpha Vantage en Vercel.",
              now,
            );
            result.skipped++;
            continue;
          }
          const request = await withAlphaRequest(
            () => providers.price(target.instrument!, now),
            timing,
          );
          if (!request.ok) {
            await finish(
              state,
              "error",
              "La cuota o el turno compartido de cotizaciones están ocupados; se conserva el último dato y se reintentará en otro ciclo.",
              now,
            );
            result.failed++;
            continue;
          }
          reference = request.value;
        }
      } else reference = await providers.fx(now);
      await finish(
        state,
        "ok",
        "Referencia diaria guardada; no es precio de ejecución ni una orden.",
        now,
        reference,
      );
      result.updated++;
    } catch {
      // Do not persist provider bodies, URLs with keys, account details or database errors.
      await finish(
        state,
        "error",
        "No se pudo actualizar la referencia diaria. Se conserva el último dato; revisa conexión, cuota o capacidad del archivo.",
        now,
      );
      result.failed++;
    }
  }
  return result;
}
export function financeSyncFindings(
  states: FinanceSyncState[],
  instruments: Instrument[],
  now = new Date(),
): { id: string; message: string }[] {
  const targets = [
    { id: "fx:USD/MXN", instrument: undefined as Instrument | undefined },
    ...instruments.map((instrument) => ({
      id: `price:${instrument.id}`,
      instrument,
    })),
  ];
  const result: { id: string; message: string }[] = [];
  if (
    states.some(
      (state) =>
        state.id.startsWith("stock-") &&
        (state.status === "error" ||
          (state.status === "running" &&
            now.getTime() - Date.parse(state.lastAttempt ?? "") > 15 * 60000)),
    )
  )
    result.push({
      id: "finance-stock-evidence",
      message:
        "Finanzas: parte de la investigación automática de empresas tiene fuentes pendientes. Se conserva la evidencia anterior; consulta la cobertura en la app.",
    });
  const research = states.find((s) => s.id === "news-research");
  if (
    !research ||
    research.status === "error" ||
    !research.lastSuccess ||
    now.getTime() - Date.parse(research.lastSuccess) > 36 * 3600000
  )
    result.push({
      id: "finance-news-research",
      message:
        "Finanzas: falta confirmar el informe automático de investigación. Se conservan las fichas anteriores.",
    });

  for (const target of targets) {
    if (target.instrument && !supportsAutomaticPrice(target.instrument))
      continue;
    const state = states.find((s) => s.id === target.id);
    const id = target.instrument
      ? `finance-price-${target.instrument.id}`
      : "finance-fx-missing";
    const name = target.instrument
      ? "un instrumento del portafolio"
      : "USD/MXN"; // Never put private holdings or account values in external alerts.
    if (!state) {
      result.push({
        id,
        message: `Finanzas: falta confirmar la actualización automática de ${name}.`,
      });
      continue;
    }
    if (state.status === "manual") continue;
    const stopped =
      state.status === "running" &&
      now.getTime() - Date.parse(state.lastAttempt ?? "") > 15 * 60000;
    // Two hours of scheduler grace after expected publication; FX blended dates can include weekends.
    const checkDate = new Date(now.getTime() - 2 * 3600000);
    const priceStale = Boolean(
      target.instrument &&
      state.asOf &&
      state.asOf < expectedUsClose(checkDate),
    );
    const fxStale =
      !target.instrument &&
      (!state.lastSuccess ||
        now.getTime() - Date.parse(state.lastSuccess) > 36 * 3600000 ||
        !state.asOf ||
        state.asOf < financeDay(new Date(now.getTime() - 4 * 86400000)));
    if (
      state.status === "error" ||
      state.status === "configuration" ||
      stopped ||
      (state.status === "ok" && (priceStale || fxStale))
    )
      result.push({
        id,
        message: `Finanzas: ${name} tiene una referencia pendiente de actualización. Se conserva el historial anterior.`,
      });
  }
  return result;
}
