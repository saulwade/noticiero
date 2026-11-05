import { describe, it, expect, vi } from "vitest";
import { freeFxJson } from "@/features/finance/free-fx";
import { fetchDailyFx } from "@/features/finance/daily-providers";
const url = new URL(
  "https://api.frankfurter.dev/v2/rate/USD/MXN?date=2026-11-04",
);
const quote = { date: "2026-11-04", base: "USD", quote: "MXN", rate: 18.5 };
describe("recuperación acotada del proveedor gratuito", () => {
  it("reintenta una falla de servidor o red y confirma un dato real", async () => {
    for (const first of [
      new Response("", { status: 503 }),
      new TypeError("private transport detail"),
    ]) {
      const f = vi.fn<typeof fetch>();
      if (first instanceof Response) f.mockResolvedValueOnce(first);
      else f.mockRejectedValueOnce(first);
      f.mockResolvedValueOnce(Response.json(quote));
      expect(await freeFxJson(url, f)).toEqual(quote);
      expect(f).toHaveBeenCalledTimes(2);
    }
  });
  it("no reintenta cuota, autorización, contenido inválido ni tamaño excesivo", async () => {
    for (const r of [
      new Response("", { status: 429 }),
      new Response("", { status: 403 }),
      new Response("not JSON"),
      new Response("x".repeat(65537)),
    ]) {
      const f = vi.fn<typeof fetch>().mockResolvedValue(r);
      await expect(freeFxJson(url, f)).rejects.toThrow();
      expect(f).toHaveBeenCalledTimes(1);
    }
  });
  it("no puede repetir peticiones de Alpha ni revelar errores externos", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("PRIVATE-KEY-TRANSPORT"));
    await expect(
      freeFxJson(new URL("https://www.alphavantage.co/query"), f),
    ).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
    const error = await freeFxJson(url, f).catch((e) => e);
    expect(f).toHaveBeenCalledTimes(2);
    expect(String(error)).not.toContain("PRIVATE");
  });
  it("si hoy no está publicado usa la fecha anterior real, nunca la fecha de hoy inventada", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(Response.json({ ...quote, date: "2026-11-03" }));
    const result = await fetchDailyFx(new Date("2026-11-04T13:00:00Z"), f);
    expect(result.asOf).toBe("2026-11-03");
    expect(new URL(String(f.mock.calls[1][0])).searchParams.has("date")).toBe(
      false,
    );
  });
  it("el fallback rechaza moneda o fecha futura y no oculta validación fallida", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(Response.json({ ...quote, date: "2026-11-05" }));
    await expect(
      fetchDailyFx(new Date("2026-11-04T13:00:00Z"), f),
    ).rejects.toThrow();
    const bad = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ...quote, rate: -1 }));
    await expect(
      fetchDailyFx(new Date("2026-11-04T13:00:00Z"), bad),
    ).rejects.toThrow();
    expect(bad).toHaveBeenCalledTimes(1);
  });
});
