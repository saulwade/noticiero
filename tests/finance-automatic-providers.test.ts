import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTOMATION_ASSETS,
  AUTOMATION_MAX_PROVIDER_BYTES,
  fetchAutomationReference,
  fetchWeeklyHistory,
  joinHistoricalFx,
  parseHistoricalFx,
  parseWeeklyAdjusted,
} from "@/features/finance/automatic-providers";
import type { withAlphaRequest } from "@/features/market/request-budget";

const now = new Date("2026-11-01T12:00:00Z");
const weekly = (changes: Record<string, unknown> = {}) => ({
  "Meta Data": { "2. Symbol": "VT" },
  "Weekly Adjusted Time Series": {
    "2026-10-23": { "4. close": "100", "5. adjusted close": "98" },
    "2026-10-30": { "4. close": "102", "5. adjusted close": "100" },
    ...changes,
  },
});
const grant: typeof withAlphaRequest = async (request) => ({
  ok: true,
  value: await request(),
});
afterEach(() => vi.unstubAllEnvs());

describe("históricos automáticos con FX fechado", () => {
  it("conserva cierre y cierre ajustado separados, nunca precios futuros", () => {
    expect(parseWeeklyAdjusted(weekly(), "VT", now)).toEqual([
      { date: "2026-10-23", close: "100", adjustedClose: "98" },
      { date: "2026-10-30", close: "102", adjustedClose: "100" },
    ]);
    for (const extra of [
      { "2026-11-02": { "4. close": "1", "5. adjusted close": "1" } },
      { "2026-02-30": { "4. close": "1", "5. adjusted close": "1" } },
      { "2026-10-30": { "4. close": "1", "5. adjusted close": "NaN" } },
    ])
      expect(() => parseWeeklyAdjusted(weekly(extra), "VT", now)).toThrow();
    expect(() => parseWeeklyAdjusted(weekly(), "SGOV", now)).toThrow();
  });
  it("solo empareja FX anterior a cada semana y dentro de siete días", () => {
    const prices = parseWeeklyAdjusted(weekly(), "VT", now);
    expect(
      joinHistoricalFx(prices, [
        { date: "2026-10-16", value: "18" },
        { date: "2026-10-31", value: "99" },
      ]),
    ).toEqual([{ ...prices[0], fxMxn: "18", fxDate: "2026-10-16" }]);
    expect(
      joinHistoricalFx(prices, [{ date: "2026-10-24", value: "19" }]),
    ).toEqual([{ ...prices[1], fxMxn: "19", fxDate: "2026-10-24" }]);
  });
  it("rechaza FX con moneda cambiada, duplicados, futuro, no finitos y precisión excesiva", () => {
    const row = {
      date: "2026-10-23",
      base: "USD",
      quote: "MXN",
      rate: 18.1234,
    };
    expect(parseHistoricalFx([row], "2026-10-16", "2026-10-30")).toEqual([
      { date: row.date, value: "18.1234" },
    ]);
    for (const value of [
      [row, row],
      [{ ...row, base: "MXN" }],
      [{ ...row, date: "2026-11-02" }],
      [{ ...row, rate: Infinity }],
      [{ ...row, rate: 18.123456789 }],
      [{ ...row, rate: "18" }],
    ])
      expect(() =>
        parseHistoricalFx(value, "2026-10-16", "2026-10-30"),
      ).toThrow();
  });
  it("reserva una solicitud Alpha compartida y obtiene FX histórico sin gastar otra", async () => {
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "synthetic-private-key");
    const alpha = vi.fn(grant),
      fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json(weekly()))
        .mockResolvedValueOnce(
          Response.json([
            { date: "2026-10-23", base: "USD", quote: "MXN", rate: 18 },
            { date: "2026-10-30", base: "USD", quote: "MXN", rate: 19 },
          ]),
        );
    const result = await fetchWeeklyHistory(AUTOMATION_ASSETS[0], now, {
      fetcher,
      alphaRequest: alpha as typeof withAlphaRequest,
    });
    expect(alpha).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0][0])).toContain(
      "function=TIME_SERIES_WEEKLY_ADJUSTED",
    );
    expect(String(fetcher.mock.calls[1][0])).toContain(
      "base=USD&quotes=MXN&from=2026-10-16&to=2026-10-30",
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      redirect: "error",
      cache: "no-store",
    });
    expect(result.points[1]).toMatchObject({
      close: "102",
      adjustedClose: "100",
      fxMxn: "19",
    });
    expect(result.warnings.join(" ")).toContain("52 observaciones");
    expect(JSON.stringify(result)).not.toContain("synthetic-private-key");
  });
  it("también pasa el cierre diario por la cuota compartida", async () => {
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "synthetic-private-key");
    const alpha = vi.fn(grant),
      fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          "Global Quote": {
            "01. symbol": "VT",
            "05. price": "102",
            "07. latest trading day": "2026-10-30",
          },
        }),
      );
    expect(
      await fetchAutomationReference(AUTOMATION_ASSETS[0], "19", now, {
        fetcher,
        alphaRequest: alpha as typeof withAlphaRequest,
      }),
    ).toMatchObject({
      symbol: "VT",
      price: "102",
      session: "2026-10-30",
      fxMxn: "19",
    });
    expect(alpha).toHaveBeenCalledTimes(1);
  });
  it("no hace red si se agotó la cuota ni filtra errores con claves", async () => {
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "synthetic-private-key");
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      fetchWeeklyHistory(AUTOMATION_ASSETS[0], now, {
        fetcher,
        alphaRequest: async () => ({ ok: false }),
      }),
    ).rejects.toThrow("Se conserva");
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockRejectedValue(
      new Error("https://provider.test?apikey=synthetic-private-key"),
    );
    const error = await fetchWeeklyHistory(AUTOMATION_ASSETS[0], now, {
      fetcher,
      alphaRequest: grant,
    }).catch((e: Error) => e.message);
    expect(error).not.toContain("synthetic-private-key");
    expect(error).not.toContain("https:");
  });
  it("acota tanto content-length como el cuerpo transmitido", async () => {
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "synthetic-private-key");
    for (const response of [
      new Response("{}", {
        headers: {
          "content-length": String(AUTOMATION_MAX_PROVIDER_BYTES + 1),
        },
      }),
      new Response(" ".repeat(AUTOMATION_MAX_PROVIDER_BYTES + 1)),
    ]) {
      await expect(
        fetchWeeklyHistory(AUTOMATION_ASSETS[0], now, {
          fetcher: vi.fn<typeof fetch>().mockResolvedValue(response),
          alphaRequest: grant,
        }),
      ).rejects.toThrow();
    }
  });
});
