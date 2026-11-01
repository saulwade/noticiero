import { describe, expect, it, vi } from "vitest";
import { collectCompanyFacts } from "@/features/finance/sec";
import type { Instrument } from "@/features/finance/types";

const now = new Date("2026-10-31T20:00:00Z");
const stock: Instrument = {
  id: "issuer-test",
  symbol: "EXAMPLE",
  name: "Synthetic issuer",
  kind: "stock",
  currency: "USD",
  exchange: "NASDAQ",
  fractional: false,
  cik: "0000320193",
  createdAt: "2026-10-01T00:00:00Z",
};
const observation = {
  start: "2026-04-01",
  end: "2026-06-30",
  val: 100,
  filed: "2026-08-01",
  form: "10-Q",
  accn: "0000320193-26-000001",
};
function payload(facts: Record<string, unknown> = {}) {
  return {
    cik: 320193,
    entityName: "Synthetic issuer",
    facts: { "us-gaap": facts },
  };
}
function concept(rows: unknown[], unit = "USD") {
  return { units: { [unit]: rows } };
}
function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

describe("investigación SEC con procedencia", () => {
  it("exige CIK explícito y acciones, sin inferir identidad por ticker", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      collectCompanyFacts({ ...stock, cik: undefined }, now, fetcher),
    ).rejects.toThrow(/CIK/);
    await expect(
      collectCompanyFacts({ ...stock, cik: "320193" }, now, fetcher),
    ).rejects.toThrow(/CIK/);
    await expect(
      collectCompanyFacts({ ...stock, kind: "etf" }, now, fetcher),
    ).rejects.toThrow(/acciones/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("una consulta pública sin cookies, credenciales, redirecciones o claves", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      response(payload({ Revenues: concept([observation]) })),
    );
    const result = await collectCompanyFacts(stock, now, fetcher);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
    );
    expect(init).toMatchObject({
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
    });
    expect(JSON.stringify(init?.headers)).not.toMatch(/authorization|apikey/i);
    expect(result.facts[0]).toMatchObject({
      label: "Ingresos · trimestre",
      value: 100,
      unit: "USD",
      start: "2026-04-01",
      end: "2026-06-30",
      filed: "2026-08-01",
      form: "10-Q",
    });
    expect(result.facts[0].url).toBe(
      "https://www.sec.gov/Archives/edgar/data/320193/000032019326000001/0000320193-26-000001-index.html",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("mantiene trimestre y año comparables sin sumar aliases ni YTD", async () => {
    const result = await collectCompanyFacts(stock, now, async () =>
      response(
        payload({
          Revenues: concept([
            observation,
            { ...observation, start: "2026-01-01", val: 300 },
            {
              ...observation,
              start: "2025-01-01",
              end: "2025-12-31",
              val: 900,
              form: "10-K",
            },
          ]),
          RevenueFromContractWithCustomerExcludingAssessedTax: concept([
            { ...observation, val: 100 },
          ]),
        }),
      ),
    );
    expect(result.facts).toHaveLength(2);
    expect(result.facts.map((f) => f.value)).toEqual([100, 900]);
    expect(result.facts.map((f) => f.label)).toEqual([
      "Ingresos · trimestre",
      "Ingresos · año",
    ]);
  });
  it("elige enmienda conocida de ese período y excluye revisiones futuras", async () => {
    const result = await collectCompanyFacts(stock, now, async () =>
      response(
        payload({
          NetIncomeLoss: concept([
            observation,
            {
              ...observation,
              val: 90,
              filed: "2026-09-01",
              form: "10-Q/A",
              accn: "0000320193-26-000002",
            },
            { ...observation, val: 20, filed: "2026-11-01", form: "10-Q/A" },
            {
              ...observation,
              end: "2026-12-31",
              val: 200,
              filed: "2026-10-30",
            },
          ]),
        }),
      ),
    );
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].value).toBe(90);
    expect(result.facts[0].form).toBe("10-Q/A");
  });
  it("no sustituye ausentes por ceros ni interpreta shares como dinero", async () => {
    const result = await collectCompanyFacts(stock, now, async () =>
      response(
        payload({
          Assets: concept([{ ...observation, start: undefined }], "shares"),
          WeightedAverageNumberOfDilutedSharesOutstanding: concept(
            [{ ...observation, val: 12 }],
            "shares",
          ),
        }),
      ),
    );
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].unit).toBe("shares");
    expect(result.warnings.join(" ")).toMatch(/faltan|ausentes/i);
    expect(result.warnings.join(" ")).toMatch(/segmentos/i);
  });
  it("rechaza fechas inválidas, formularios no permitidos y números no finitos", async () => {
    const result = await collectCompanyFacts(stock, now, async () =>
      response(
        payload({
          NetIncomeLoss: concept([
            { ...observation, filed: "2026-02-30" },
            { ...observation, form: "S-1" },
            { ...observation, val: null },
            { ...observation, val: "100" },
            { ...observation, start: "2026-07-01" },
            { ...observation, val: 0 },
          ]),
        }),
      ),
    );
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].value).toBe(0);
  });
  it("no transforma un saldo instantáneo en flujo acumulado", async () => {
    const result = await collectCompanyFacts(stock, now, async () =>
      response(
        payload({
          Assets: concept([
            { ...observation, start: undefined, val: 1000 },
            { ...observation, val: 9999 },
          ]),
          NetCashProvidedByUsedInOperatingActivities: concept([
            { ...observation, start: "2026-01-01", val: 500 },
          ]),
        }),
      ),
    );
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]).toMatchObject({ label: "Activos", value: 1000 });
  });
  it("rechaza identidad distinta y unidades monetarias ambiguas", async () => {
    await expect(
      collectCompanyFacts(stock, now, async () =>
        response({ ...payload(), cik: 1234 }),
      ),
    ).rejects.toThrow(/identidad/);
    const result = await collectCompanyFacts(stock, now, async () =>
      response(
        payload({
          Revenues: {
            units: { USD: [observation], MXN: [{ ...observation, val: 2000 }] },
          },
        }),
      ),
    );
    expect(result.facts).toEqual([]);
    expect(result.warnings.join(" ")).toMatch(/moneda/);
  });
  it("conserva fechas viejas y advierte antigüedad en vez de actualizarlas", async () => {
    const old = {
      ...observation,
      start: "2022-01-01",
      end: "2022-03-31",
      filed: "2022-05-01",
    };
    const result = await collectCompanyFacts(stock, now, async () =>
      response(payload({ Revenues: concept([old]) })),
    );
    expect(result.facts[0].end).toBe("2022-03-31");
    expect(result.warnings.join(" ")).toMatch(/antig/);
  });
  it("ID estable para hechos iguales y distinto al cambiar una cifra", async () => {
    const fetcher = async () =>
      response(payload({ Revenues: concept([observation]) }));
    const a = await collectCompanyFacts(stock, now, fetcher);
    const b = await collectCompanyFacts(
      stock,
      new Date("2026-11-01T20:00:00Z"),
      fetcher,
    );
    const c = await collectCompanyFacts(stock, now, async () =>
      response(payload({ Revenues: concept([{ ...observation, val: 99 }]) })),
    );
    expect(a.id).toBe(b.id);
    expect(c.id).not.toBe(a.id);
  });
  it("expone límites de plantillas sectoriales sin score ni recomendación", async () => {
    const result = await collectCompanyFacts(
      { ...stock, sector: "Banca" },
      now,
      async () => response(payload()),
    );
    expect(result.warnings.join(" ")).toMatch(/EV\/EBITDA/);
    expect(result.warnings.join(" ")).toMatch(/regulatorio/);
    expect(result).not.toHaveProperty("recommendation");
    expect(result).not.toHaveProperty("probability");
  });
  it("acota bytes declarados y reales, sin incluir datos upstream en errores", async () => {
    await expect(
      collectCompanyFacts(
        stock,
        now,
        async () =>
          new Response("secret upstream", {
            headers: { "content-length": "7000000" },
          }),
      ),
    ).rejects.toThrow(/tamaño/);
    await expect(
      collectCompanyFacts(
        stock,
        now,
        async () => new Response("x".repeat(6 * 1024 * 1024 + 1)),
      ),
    ).rejects.toThrow(/tamaño/);
    await expect(
      collectCompanyFacts(
        stock,
        now,
        async () => new Response("secret upstream", { status: 403 }),
      ),
    ).rejects.toThrow(/SEC/);
    try {
      await collectCompanyFacts(stock, now, async () => {
        throw new Error("private connection credential");
      });
    } catch (error) {
      expect(String(error)).not.toMatch(/credential|private connection/);
    }
  });
});
