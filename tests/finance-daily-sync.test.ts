import { eq } from "drizzle-orm";
import { alphaSlotName } from "@/features/market/request-budget";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { getFinanceData } from "@/features/finance/service";
import { getDb } from "@/db/client";
import * as t from "@/db/schema";
import {
  syncDailyFinance as runDailySync,
  financeSyncFindings,
} from "@/features/finance/daily-sync";
import type { Instrument, FinanceSyncState } from "@/features/finance/types";
const syncDailyFinance: typeof runDailySync = (at, providers) =>
  runDailySync(at, providers, { clock: () => at!, wait: async () => {} });
const now = new Date("2026-10-31T02:30:00Z");
const at = now.toISOString();
const stock: Instrument = {
  id: "synthetic",
  symbol: "IBM",
  name: "Synthetic test",
  kind: "stock",
  currency: "USD",
  exchange: "NYSE",
  fractional: false,
  createdAt: at,
};
const fx = () =>
  vi.fn().mockResolvedValue({
    value: "20",
    asOf: "2026-10-30",
    source: "Frankfurter · referencia diaria",
    sourceUrl: "https://api.frankfurter.dev/v2/rate/USD/MXN?date=2026-10-30",
  });
const price = () =>
  vi.fn().mockResolvedValue({
    value: "100",
    asOf: "2026-10-30",
    source: "Alpha Vantage · cierre",
    sourceUrl: "https://www.alphavantage.co/documentation/#latestprice",
  });
beforeEach(async () => {
  vi.stubEnv("ALPHA_VANTAGE_API_KEY", "test-secret-not-real");
  const db = await getDb();
  await db.delete(t.leases).where(eq(t.leases.name, alphaSlotName));
  for (const table of [
    t.financeSync,
    t.financeMarks,
    t.financeInstruments,
    t.financeMovements,
    t.financePolicies,
    t.financeTheses,
    t.financeDecisions,
    t.financeResearch,
    t.usage,
    t.quotes,
  ])
    await db.delete(table);
});
afterEach(() => vi.unstubAllEnvs());
async function register(instrument = stock) {
  await (
    await getDb()
  )
    .insert(t.financeInstruments)
    .values({ id: instrument.id, data: instrument });
}
describe("sincronización diaria privada y acotada", () => {
  it("actualiza FX sin posiciones, no crea aportaciones ni instrumentos y repite sin duplicar", async () => {
    const providers = { fx: fx(), price: price() };
    await syncDailyFinance(now, providers);
    await syncDailyFinance(now, providers);
    const db = await getDb();
    expect(providers.fx).toHaveBeenCalledTimes(1);
    expect(providers.price).not.toHaveBeenCalled();
    expect(await db.select().from(t.financeMarks)).toHaveLength(1);
    expect(await db.select().from(t.financeInstruments)).toHaveLength(0);
  });
  it("recupera la referencia del día por la noche aunque la mañana devolviera la fecha anterior", async () => {
    const providers = { fx: fx(), price: price() };
    providers.fx.mockResolvedValueOnce({
      value: "19.9",
      asOf: "2026-10-29",
      source: "FX",
      sourceUrl: "https://api.frankfurter.dev/",
    });
    await syncDailyFinance(new Date("2026-10-30T13:30:00Z"), providers);
    await syncDailyFinance(new Date("2026-10-30T14:30:00Z"), providers);
    expect(providers.fx).toHaveBeenCalledTimes(1);
    await syncDailyFinance(now, providers);
    expect(providers.fx).toHaveBeenCalledTimes(2);
    expect(await (await getDb()).select().from(t.financeMarks)).toHaveLength(2);
  });
  it("comparte la respuesta completa de precio con el panel sin inventar variaciones", async () => {
    await register();
    const providers = { fx: fx(), price: price() };
    providers.price.mockResolvedValue({
      value: "100",
      asOf: "2026-10-30",
      source: "Alpha Vantage",
      sourceUrl: "https://www.alphavantage.co/",
      quote: {
        symbol: "IBM",
        price: 100,
        change: -2,
        percent: -1.96,
        tradingDay: "2026-10-30",
        currency: "USD",
        fetchedAt: at,
        provider: "Alpha Vantage",
      },
    });
    await syncDailyFinance(now, providers);
    const db = await getDb();
    expect((await db.select().from(t.quotes))[0].data.percent).toBe(-1.96);
    expect(
      (await db.select().from(t.financeMarks)).every(
        (r) => !("quote" in r.data),
      ),
    ).toBe(true);
  });
  it("espera el slot compartido antes de consultar dos instrumentos", async () => {
    await register();
    await register({ ...stock, id: "second", symbol: "MSFT" });
    const providers = { fx: fx(), price: price() };
    let clock = now.getTime();
    const wait = vi.fn().mockImplementation(async (ms: number) => {
      clock += ms;
    });
    await runDailySync(now, providers, { clock: () => new Date(clock), wait });
    expect(wait.mock.calls.map((c) => c[0])).toEqual([1500]);
    expect(providers.price).toHaveBeenCalledTimes(2);
  });
  it("separa fallo de precio y éxito FX; conserva referencia previa sin mensajes externos", async () => {
    await register();
    const p = price().mockRejectedValue(
      new Error("https://secret.invalid/?apikey=token"),
    );
    await syncDailyFinance(now, { fx: fx(), price: p });
    const db = await getDb();
    const states = (await db.select().from(t.financeSync)).map((r) => r.data);
    expect(states.find((s) => s.instrumentId)?.status).toBe("error");
    expect(states.find((s) => !s.instrumentId)?.status).toBe("ok");
    expect(JSON.stringify(states)).not.toMatch(/secret.invalid|apikey|token/);
    expect(await db.select().from(t.financeMarks)).toHaveLength(1);
  });
  it("no consulta precios sin clave, mantiene modo manual y no gasta cuota", async () => {
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", " DEMO ");
    await register();
    const providers = { fx: fx(), price: price() };
    await syncDailyFinance(now, providers);
    expect(providers.price).not.toHaveBeenCalled();
    expect((await getFinanceData()).market?.alphaVantageConfigured).toBe(false);
    const states = (await (await getDb()).select().from(t.financeSync)).map(
      (r) => r.data,
    );
    expect(states.find((s) => s.instrumentId)?.status).toBe("configuration");
    expect(await (await getDb()).select().from(t.usage)).toHaveLength(0);
  });
  it("omite listado MXN/SIC y bonos en vez de asignar un cierre USD ajeno", async () => {
    await register({ ...stock, currency: "MXN", exchange: "BMV" });
    const providers = { fx: fx(), price: price() };
    await syncDailyFinance(now, providers);
    expect(providers.price).not.toHaveBeenCalled();
    expect(
      (await (await getDb()).select().from(t.financeSync)).find(
        (r) => r.data.instrumentId,
      )?.data.status,
    ).toBe("manual");
  });
  it("reutiliza cierre validado del panel y comparte contador de veinte solicitudes", async () => {
    await register();
    const db = await getDb();
    await db.insert(t.quotes).values({
      symbol: "IBM",
      data: {
        symbol: "IBM",
        price: 100,
        change: 1,
        percent: 1,
        tradingDay: "2026-10-30",
        currency: "USD",
        fetchedAt: at,
        provider: "Alpha Vantage",
      },
    });
    const providers = { fx: fx(), price: price() };
    await syncDailyFinance(now, providers);
    expect(providers.price).not.toHaveBeenCalled();
    expect(await db.select().from(t.usage)).toHaveLength(0);
    expect(
      (await db.select().from(t.financeMarks)).filter(
        (r) => r.data.kind === "price",
      ),
    ).toHaveLength(1);
  });
  it("agotada la cuota compartida conserva datos y no llama al proveedor", async () => {
    await register();
    const db = await getDb();
    await db.insert(t.usage).values({ key: "quote:2026-10-31", amount: 20 });
    const providers = { fx: fx(), price: price() };
    await syncDailyFinance(now, providers);
    expect(providers.price).not.toHaveBeenCalled();
    expect((await db.select().from(t.usage))[0].amount).toBe(20);
  });
  it("reserva intentos concurrentes y respeta enfriamiento de errores", async () => {
    await register();
    const providers = {
      fx: fx(),
      price: price().mockRejectedValue(new Error("failure")),
    };
    await Promise.all([
      syncDailyFinance(now, providers),
      syncDailyFinance(now, providers),
    ]);
    await syncDailyFinance(new Date(now.getTime() + 3600000), providers);
    expect(providers.fx).toHaveBeenCalledTimes(1);
    expect(providers.price).toHaveBeenCalledTimes(1);
    await syncDailyFinance(new Date(now.getTime() + 7 * 3600000), providers);
    expect(providers.price).toHaveBeenCalledTimes(2);
  });
  it("deja configurar una clave después de un estado pendiente sin esperar seis horas", async () => {
    await register();
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "");
    const providers = { fx: fx(), price: price() };
    await syncDailyFinance(now, providers);
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "new-test-key");
    await syncDailyFinance(new Date(now.getTime() + 1000), providers);
    expect(providers.price).toHaveBeenCalledTimes(1);
  });
  it("una nueva sesión guarda una observación nueva conservando la anterior", async () => {
    await register();
    const providers = { fx: fx(), price: price() };
    await syncDailyFinance(now, providers);
    providers.fx.mockResolvedValue({
      value: "20.1",
      asOf: "2026-11-02",
      source: "FX reference",
      sourceUrl: "https://api.frankfurter.dev/",
    });
    providers.price.mockResolvedValue({
      value: "101",
      asOf: "2026-11-02",
      source: "Stock close",
      sourceUrl: "https://www.alphavantage.co/",
    });
    await syncDailyFinance(new Date("2026-11-03T02:30:00Z"), providers);
    expect(await (await getDb()).select().from(t.financeMarks)).toHaveLength(4);
  });
});
describe("alertas de finanzas sin falsas alarmas por fin de semana", () => {
  it("advierte fallos o leases detenidos, no cobertura manual ni configuración sin posiciones", () => {
    const base: FinanceSyncState = {
      id: "fx:USD/MXN",
      label: "USD/MXN",
      provider: "Frankfurter",
      status: "ok",
      message: "ok",
      lastSuccess: at,
      asOf: "2026-10-30",
    };
    expect(financeSyncFindings([base], [], now)).toEqual([]);
    expect(
      financeSyncFindings([{ ...base, status: "error" }], [], now),
    ).toHaveLength(1);
    expect(
      financeSyncFindings(
        [{ ...base, status: "running", lastAttempt: "2026-10-30T00:00:00Z" }],
        [],
        now,
      ),
    ).toHaveLength(1);
    expect(
      financeSyncFindings([{ ...base, status: "manual" }], [], now),
    ).toEqual([]);
  });
  it("avisa cuando no se ha ejecutado un ciclo y cuando un precio quedó atrasado tras el margen", () => {
    expect(financeSyncFindings([], [], now).map((f) => f.id)).toContain(
      "finance-fx-missing",
    );
    const s: FinanceSyncState = {
      id: `price:${stock.id}`,
      instrumentId: stock.id,
      label: "IBM",
      provider: "Alpha Vantage",
      status: "ok",
      message: "ok",
      lastSuccess: at,
      asOf: "2026-10-30",
    };
    const monday = new Date("2026-11-03T04:30:00Z");
    expect(
      financeSyncFindings([s], [stock], monday).map((f) => f.id),
    ).toContain(`finance-price-${stock.id}`);
  });
});
