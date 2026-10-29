import { describe, it, expect } from "vitest";
import { parseQuote, quoteAfterStory } from "@/features/market/alpha-vantage";
const payload = {
  "Global Quote": {
    "01. symbol": "MSFT",
    "05. price": "100.25",
    "07. latest trading day": "2026-10-27",
    "09. change": "-2.50",
    "10. change percent": "-2.4390%",
  },
};
describe("cotizaciones", () => {
  it("interpreta precios del proveedor y conserva sesión y moneda", () => {
    const quote = parseQuote(payload, "MSFT");
    expect(quote.price).toBe(100.25);
    expect(quote.percent).toBe(-2.439);
    expect(quote.tradingDay).toBe("2026-10-27");
    expect(quote.currency).toBe("USD");
  });
  it("rechaza un ticker distinto al solicitado", () => {
    expect(() => parseQuote(payload, "NVDA")).toThrow();
  });
  it("rechaza mensajes de cuota sin inventar números", () => {
    expect(() =>
      parseQuote({ Information: "API limit reached" }, "MSFT"),
    ).toThrow();
  });
  it("rechaza cifras no finitas", () => {
    expect(() =>
      parseQuote(
        { "Global Quote": { ...payload["Global Quote"], "05. price": "NaN" } },
        "MSFT",
      ),
    ).toThrow();
  });
  it("marca un cierre anterior a la noticia", () => {
    expect(
      quoteAfterStory(parseQuote(payload, "MSFT"), "2026-10-28T08:00:00Z"),
    ).toBe(false);
  });
  it("no trata el cierre de la tarde como posterior a un anuncio nocturno", () => {
    expect(
      quoteAfterStory(parseQuote(payload, "MSFT"), "2026-10-27T23:00:00Z"),
    ).toBe(false);
  });
});
