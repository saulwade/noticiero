import { afterEach, describe, expect, it, vi } from "vitest";
import {
  expectedUsClose,
  isUsTradingDay,
  usSessionCloseHour,
} from "@/features/finance/market-calendar";
import {
  fetchDailyFx,
  fetchDailyPrice,
  supportsAutomaticPrice,
} from "@/features/finance/daily-providers";
import type { Instrument } from "@/features/finance/types";

const fund: Instrument = {
  id: "synthetic-fund",
  symbol: "TEST",
  name: "Fondo de prueba",
  kind: "etf",
  currency: "USD",
  exchange: "NYSE ARCA",
  fractional: false,
  createdAt: "2026-10-30T00:00:00Z",
};
const friday = new Date("2026-10-31T02:00:00Z");
const quote = (overrides: Record<string, unknown> = {}) => ({
  "Global Quote": {
    "01. symbol": "TEST",
    "05. price": "125.4500",
    "07. latest trading day": "2026-10-30",
    ...overrides,
  },
});
const answer = (data: unknown, status = 200) =>
  vi.fn<typeof fetch>().mockResolvedValue(Response.json(data, { status }));
afterEach(() => vi.unstubAllEnvs());

describe("calendario de cierres estadounidenses", () => {
  it("espera las20h Nueva York, incluidos cambio de DST y fines de semana", () => {
    expect(expectedUsClose(new Date("2026-10-31T00:00:00Z"))).toBe(
      "2026-10-30",
    );
    expect(expectedUsClose(new Date("2026-10-30T23:59:59Z"))).toBe(
      "2026-10-29",
    );
    expect(expectedUsClose(new Date("2026-11-03T00:59:59Z"))).toBe(
      "2026-10-30",
    );
    expect(expectedUsClose(new Date("2026-11-03T01:00:00Z"))).toBe(
      "2026-11-02",
    );
    expect(expectedUsClose(new Date("2026-11-01T16:00:00Z"))).toBe(
      "2026-10-30",
    );
  });
  it("respeta festivos NYSE, cierre extraordinario y excepción de Año Nuevo sábado", () => {
    for (const day of [
      "2026-01-01",
      "2026-01-19",
      "2026-02-16",
      "2026-04-03",
      "2026-05-25",
      "2026-06-19",
      "2026-07-03",
      "2026-09-07",
      "2026-11-26",
      "2026-12-25",
      "2027-06-18",
      "2027-07-05",
      "2027-12-24",
      "2025-01-09",
    ])
      expect(isUsTradingDay(day), day).toBe(false);
    expect(isUsTradingDay("2021-12-31")).toBe(true);
    expect(isUsTradingDay("2021-06-18")).toBe(true);
    expect(expectedUsClose(new Date("2026-04-04T02:00:00Z"))).toBe(
      "2026-04-02",
    );
  });
  it("declara cierres tempranos sin adelantarlos a la disponibilidad EOD", () => {
    expect(usSessionCloseHour("2026-11-27")).toBe(13);
    expect(usSessionCloseHour("2026-12-24")).toBe(13);
    expect(usSessionCloseHour("2025-07-03")).toBe(13);
    expect(usSessionCloseHour("2026-07-02")).toBe(16);
    expect(usSessionCloseHour("2026-07-03")).toBeUndefined();
    expect(expectedUsClose(new Date("2026-11-27T19:00:00Z"))).toBe(
      "2026-11-25",
    );
  });
  it("rechaza días inexistentes y entradas inválidas", () => {
    for (const day of ["2026-02-30", "2026-13-01", "", "2026-1-1"])
      expect(isUsTradingDay(day)).toBe(false);
    expect(() => expectedUsClose(new Date("invalid"))).toThrow();
  });
});

describe("referencias diarias de fuentes acotadas", () => {
  it("solo admite USD stock/ETF de mercados explícitos", () => {
    expect(supportsAutomaticPrice(fund)).toBe(true);
    for (const i of [
      { ...fund, currency: "MXN" as const },
      { ...fund, exchange: "SIC" },
      { ...fund, exchange: "BMV" },
      { ...fund, kind: "bond" as const },
      { ...fund, symbol: "X?apikey=secret" },
    ])
      expect(supportsAutomaticPrice(i)).toBe(false);
  });
  it("valida cierre y conserva referencia sin filtrar la clave", async () => {
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "private-test-key");
    const fetcher = answer(quote());
    const result = await fetchDailyPrice(fund, friday, fetcher);
    expect(result).toMatchObject({
      value: "125.45",
      asOf: "2026-10-30",
      source: "Alpha Vantage · cierre diario",
    });
    expect(JSON.stringify(result)).not.toContain("private-test-key");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toContain("function=GLOBAL_QUOTE");
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      redirect: "error",
      cache: "no-store",
    });
  });
  it("devuelve cotización reutilizable solo con cambios reales del proveedor", async () => {
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "private-test-key");
    const result = await fetchDailyPrice(
      fund,
      friday,
      answer(
        quote({
          "09. change": "-1.2500",
          "10. change percent": "-0.9866%",
        }),
      ),
    );
    expect(result.quote).toEqual({
      symbol: "TEST",
      price: 125.45,
      change: -1.25,
      percent: -0.9866,
      tradingDay: "2026-10-30",
      currency: "USD",
      provider: "Alpha Vantage",
      fetchedAt: friday.toISOString(),
    });
    const zero = await fetchDailyPrice(
      fund,
      friday,
      answer(
        quote({
          "09. change": "0",
          "10. change percent": "0%",
        }),
      ),
    );
    expect(zero.quote?.change).toBe(0);
    expect(zero.quote?.percent).toBe(0);
  });
  it.each([
    {},
    { "09. change": "1" },
    { "10. change percent": "1%" },
    { "09. change": "Infinity", "10. change percent": "1%" },
    { "09. change": "1", "10. change percent": "NaN%" },
    { "09. change": "1", "10. change percent": "1" },
    { "09. change": "1e100", "10. change percent": "1%" },
  ])(
    "omite la cotización incompleta o inválida sin inventar cambios: %j",
    async (fields) => {
      vi.stubEnv("ALPHA_VANTAGE_API_KEY", "private-test-key");
      const result = await fetchDailyPrice(fund, friday, answer(quote(fields)));
      expect(result.value).toBe("125.45");
      expect(result.quote).toBeUndefined();
    },
  );
  it("no llama red sin clave o para listado no admitido", async () => {
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "");
    const fetcher = answer(quote());
    await expect(fetchDailyPrice(fund, friday, fetcher)).rejects.toThrow();
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "private-test-key");
    await expect(
      fetchDailyPrice({ ...fund, exchange: "SIC" }, friday, fetcher),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    { "01. symbol": "OTHER" },
    { "05. price": "0" },
    { "05. price": "Infinity" },
    { "05. price": "1e3" },
    { "05. price": "0.123456789" },
    { "05. price": "1000000000000" },
    { "07. latest trading day": "2026-02-30" },
    { "07. latest trading day": "2026-11-02" },
    { "07. latest trading day": "2026-10-29" },
    { "07. latest trading day": "2026-07-03" },
  ])(
    "rechaza cotización inválida sin sustituir el último dato: %j",
    async (change) => {
      vi.stubEnv("ALPHA_VANTAGE_API_KEY", "private-test-key");
      await expect(
        fetchDailyPrice(fund, friday, answer(quote(change))),
      ).rejects.toThrow();
    },
  );
  it("consulta USD/MXN para la fecha local y distingue referencia de ejecución", async () => {
    const fetcher = answer({
      date: "2026-10-30",
      base: "USD",
      quote: "MXN",
      rate: 18.8396,
    });
    const result = await fetchDailyFx(friday, fetcher);
    expect(result).toMatchObject({
      value: "18.8396",
      asOf: "2026-10-30",
      source: "Frankfurter · referencia diaria combinada",
    });
    expect(String(fetcher.mock.calls[0][0])).toContain("date=2026-10-30");
  });
  it("acepta observación de fin de semana sin inventar fecha de sesión", async () => {
    const now = new Date("2026-11-01T03:00:00Z");
    const fetcher = answer({
      date: "2026-10-31",
      base: "USD",
      quote: "MXN",
      rate: 18.8396,
    });
    expect(await fetchDailyFx(now, fetcher)).toMatchObject({
      value: "18.8396",
      asOf: "2026-10-31",
    });
    expect(String(fetcher.mock.calls[0][0])).toContain("date=2026-10-31");
  });
  it.each([
    { date: "2026-11-01", base: "USD", quote: "MXN", rate: 18 },
    { date: "2026-02-30", base: "USD", quote: "MXN", rate: 18 },
    { date: "2026-10-30", base: "MXN", quote: "USD", rate: 18 },
    { date: "2026-10-30", base: "USD", quote: "MXN", rate: 0 },
    { date: "2026-10-30", base: "USD", quote: "MXN", rate: "18" },
    { date: "2026-10-30", base: "USD", quote: "MXN", rate: 18.123456789 },
    { date: "2026-10-30", base: "USD", quote: "MXN", rate: 10001 },
  ])("rechaza FX inválido: %j", async (data) => {
    await expect(fetchDailyFx(friday, answer(data))).rejects.toThrow();
  });
  it("no acepta referencias FX anteriores a siete días", async () => {
    await expect(
      fetchDailyFx(
        friday,
        answer({ date: "2026-10-22", base: "USD", quote: "MXN", rate: 18 }),
      ),
    ).rejects.toThrow();
    const boundary = await fetchDailyFx(
      friday,
      answer({ date: "2026-10-23", base: "USD", quote: "MXN", rate: 18 }),
    );
    expect(boundary.asOf).toBe("2026-10-23");
    expect(boundary.quote).toBeUndefined();
  });
  it("acota cuerpos declarados y transmitidos sin cabecera", async () => {
    const over = " ".repeat(65537);
    for (const response of [
      new Response(over),
      new Response("{}", { headers: { "content-length": "65537" } }),
    ]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
      await expect(fetchDailyFx(friday, fetcher)).rejects.toThrow();
    }
  });
  it("no reintenta cuotas/fallos y nunca expone cuerpo remoto ni URL privada", async () => {
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "private-test-key");
    for (const fetcher of [
      answer({ Information: "private-test-key quota" }),
      answer({}, 429),
      vi
        .fn<typeof fetch>()
        .mockRejectedValue(
          new Error("https://example.test?apikey=private-test-key"),
        ),
    ]) {
      let message = "";
      try {
        await fetchDailyPrice(fund, friday, fetcher);
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).not.toContain("private-test-key");
      expect(message).not.toContain("https:");
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
});
