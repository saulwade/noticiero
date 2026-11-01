import { describe, it, expect } from "vitest";
import {
  calculatePortfolio,
  replay,
  xirr,
  financeDay,
} from "@/features/finance/engine";
import {
  decimal as d,
  formatted as f,
  multiply,
  divide,
} from "@/features/finance/decimal";
import { financeActionSchema } from "@/features/finance/validation";
import { parseFinanceCsv } from "@/features/finance/csv";
import type {
  Instrument,
  Movement,
  FinanceMark,
  FinancePolicy,
} from "@/features/finance/types";
const now = new Date("2026-10-31T22:00:00Z");
const instrument: Instrument = {
  id: "fund",
  symbol: "FUND",
  name: "Fondo sintético",
  kind: "etf",
  currency: "USD",
  exchange: "TEST",
  fractional: true,
  createdAt: "2026-10-01T12:00:00Z",
};
const mxn: Instrument = {
  ...instrument,
  id: "mx",
  symbol: "MX",
  currency: "MXN",
};
function movement(
  id: string,
  kind: Movement["kind"],
  extra: Partial<Movement> = {},
): Movement {
  return {
    id,
    kind,
    date: "2026-10-30",
    currency: "MXN",
    amount: "0",
    fee: "0",
    note: "",
    createdAt: `2026-10-30T12:00:0${id}Z`,
    sequence: Number(id),
    ...extra,
  };
}
const base = [
  movement("1", "deposit", { amount: "10000" }),
  movement("2", "exchange", { amount: "8000", fxRate: "20" }),
  movement("3", "buy", {
    currency: "USD",
    instrumentId: "fund",
    quantity: "20",
    price: "20",
  }),
];
const marks: FinanceMark[] = [
  {
    id: "p",
    kind: "price",
    instrumentId: "fund",
    value: "21",
    asOf: "2026-10-30",
    capturedAt: "2026-10-30T21:00:00Z",
    source: "Fixture",
  },
  {
    id: "fx",
    kind: "fx",
    value: "19.5",
    asOf: "2026-10-30",
    capturedAt: "2026-10-30T21:00:00Z",
    source: "Fixture",
  },
];
describe("contabilidad financiera decimal y riesgos", () => {
  it("no pierde centavos ni acepta exponentes o precisión silenciosamente", () => {
    expect(f(d("0.1") + d("0.2"))).toBe("0.3");
    expect(f(multiply(d("0.12345678"), d("1000000")))).toBe("123456.78");
    expect(f(divide(d("1"), d("3")))).toBe("0.33333333");
    expect(() => d("1e4")).toThrow();
    expect(() => d("0.123456789")).toThrow();
  });
  it("un depósito no genera ganancia ni rendimiento", () => {
    const s = calculatePortfolio(
      [],
      [movement("1", "deposit", { amount: "5000" })],
      [],
      undefined,
      now,
    );
    expect(s.valueMxn).toBe("5000");
    expect(s.pnlMxn).toBe("0");
    expect(s.performance.twr).toBe(0);
  });
  it("concilia la variación del activo y FX con comisiones registradas", () => {
    const m = [...base, movement("4", "fee", { amount: "20" })];
    const s = calculatePortfolio([instrument], m, marks, undefined, now);
    expect(s.cash).toEqual({ MXN: "1980", USD: "0" });
    expect(s.positions[0].valueMxn).toBe("8190");
    expect(s.valueMxn).toBe("10170");
    expect(s.pnlMxn).toBe("170");
    expect(s.contributionsMxn).toBe("10000");
  });
  it("faltantes de precio o FX no se convierten en ceros ni en resultado seguro", () => {
    for (const data of [
      [],
      marks.filter((m) => m.kind === "fx"),
      marks.filter((m) => m.kind === "price"),
    ]) {
      const s = calculatePortfolio([instrument], base, data, undefined, now);
      expect(s.complete).toBe(false);
      expect(s.valueMxn).toBeUndefined();
      expect(s.pnlMxn).toBeUndefined();
      expect(s.proposal.status).toBe("blocked");
    }
  });
  it("rechaza efectivo y títulos negativos, moneda equivocada y fracciones no confirmadas", () => {
    expect(() =>
      replay(
        [instrument],
        [
          movement("1", "buy", {
            instrumentId: "fund",
            currency: "USD",
            quantity: "1",
            price: "10",
          }),
        ],
        "2026-10-31",
      ),
    ).toThrow("efectivo negativo");
    expect(() =>
      replay(
        [instrument],
        [
          ...base,
          movement("4", "sell", {
            instrumentId: "fund",
            currency: "USD",
            quantity: "21",
            price: "10",
          }),
        ],
        "2026-10-31",
      ),
    ).toThrow("títulos suficientes");
    expect(() =>
      replay(
        [instrument],
        [
          movement("1", "buy", {
            instrumentId: "fund",
            quantity: "1",
            price: "10",
          }),
        ],
        "2026-10-31",
      ),
    ).toThrow("moneda");
    expect(() =>
      replay(
        [{ ...instrument, fractional: false }],
        [
          ...base.slice(0, 2),
          movement("3", "buy", {
            currency: "USD",
            instrumentId: "fund",
            quantity: "0.5",
            price: "10",
          }),
        ],
        "2026-10-31",
      ),
    ).toThrow("títulos completos");
  });
  it("dividendos, interés, venta, impuesto y retiro mantienen su naturaleza", () => {
    const s = calculatePortfolio(
      [instrument],
      [
        ...base,
        movement("4", "dividend", {
          instrumentId: "fund",
          currency: "USD",
          amount: "5",
        }),
        movement("5", "tax", { currency: "USD", amount: "1" }),
        movement("6", "sell", {
          instrumentId: "fund",
          currency: "USD",
          quantity: "20",
          price: "20",
        }),
        movement("7", "withdrawal", {
          currency: "USD",
          amount: "400",
          fxRate: "20",
        }),
      ],
      marks,
      undefined,
      now,
    );
    expect(s.cash.USD).toBe("4");
    expect(s.withdrawalsMxn).toBe("8000");
    expect(s.pnlMxn).toBe("78");
  });
  it("split2:1 exige precio confirmado después del evento y no crea riqueza", () => {
    const m = [
      ...base,
      movement("4", "split", {
        instrumentId: "fund",
        currency: "USD",
        quantity: "2",
        date: "2026-10-31",
        createdAt: "2026-10-31T15:00:00Z",
      }),
    ];
    const before = calculatePortfolio(
      [instrument],
      base,
      marks,
      undefined,
      now,
    );
    const unconfirmed = calculatePortfolio(
      [instrument],
      m,
      marks,
      undefined,
      now,
    );
    expect(unconfirmed.complete).toBe(false);
    const sameDayOld = [
      ...marks,
      {
        ...marks[0],
        id: "old",
        asOf: "2026-10-31",
        value: "21",
        capturedAt: "2026-10-31T14:00:00Z",
      },
    ];
    expect(
      calculatePortfolio([instrument], m, sameDayOld, undefined, now).complete,
    ).toBe(false);
    const after = calculatePortfolio(
      [instrument],
      m,
      [
        ...marks,
        {
          ...marks[0],
          id: "new",
          value: "10.5",
          asOf: "2026-10-31",
          capturedAt: "2026-10-31T16:00:00Z",
        },
      ],
      undefined,
      now,
    );
    expect(after.valueMxn).toBe(before.valueMxn);
    expect(after.positions[0].quantity).toBe("40");
  });
  it("correcciones conservan originales y no aplican dos veces el reverso", () => {
    const original = movement("1", "deposit", { amount: "100" });
    const s = calculatePortfolio(
      [],
      [original, { ...original, id: "r", reversesId: original.id }],
      [],
      undefined,
      now,
    );
    expect(s.valueMxn).toBe("0");
    expect(s.contributionsMxn).toBe("0");
  });
  it("las fechas y el orden secuencial preservan ejecución de un lote", () => {
    expect(financeDay(new Date("2026-11-01T02:00:00Z"))).toBe("2026-10-31");
    const batch = base.map((m, i) => ({
      ...m,
      createdAt: "2026-10-31T12:00:00Z",
      id: ["z", "b", "a"][i],
    }));
    expect(
      replay([instrument], batch, "2026-10-31").quantities.get("fund"),
    ).toBe(d("20"));
  });
  it("impide simular un objetivo USD con FX antiguo aunque todavía no tenga USD", () => {
    const policy: FinancePolicy = {
      monthlyContributionMxn: "100",
      targets: [{ instrumentId: "fund", weight: 100 }],
      approved: true,
      updatedAt: now.toISOString(),
    };
    const oldFx = { ...marks[1], asOf: "2026-10-01" };
    const s = calculatePortfolio(
      [instrument],
      [movement("1", "deposit", { amount: "100" })],
      [marks[0], oldFx],
      policy,
      now,
    );
    expect(s.proposal.status).toBe("blocked");
    expect(s.proposal.items).toEqual([]);
  });
  it("distribuye solo dinero nuevo, respeta títulos enteros y conserva remanente", () => {
    const policy: FinancePolicy = {
      monthlyContributionMxn: "100",
      targets: [
        { instrumentId: "mx", weight: 73.33 },
        { instrumentId: "CASH_MXN", weight: 26.67 },
      ],
      approved: true,
      updatedAt: now.toISOString(),
    };
    const s = calculatePortfolio(
      [{ ...mxn, fractional: false }],
      [],
      [{ ...marks[0], instrumentId: "mx", value: "60" }],
      policy,
      now,
    );
    expect(s.proposal.status).toBe("review");
    expect(
      s.proposal.items.find((i) => i.instrumentId === "mx")?.amountMxn,
    ).toBe("60");
    expect(s.proposal.items.reduce((n, i) => n + d(i.amountMxn), 0n)).toBe(
      d("100"),
    );
  });
  it("no usa precio anterior a split para volver a comprar una posición cerrada", () => {
    const m = [
      movement("1", "deposit", { amount: "100", date: "2026-10-29" }),
      movement("2", "buy", {
        instrumentId: "mx",
        quantity: "1",
        price: "100",
        date: "2026-10-29",
      }),
      movement("3", "split", {
        instrumentId: "mx",
        quantity: "2",
        createdAt: "2026-10-30T15:00:00Z",
      }),
      movement("4", "sell", { instrumentId: "mx", quantity: "2", price: "50" }),
    ];
    const policy: FinancePolicy = {
      monthlyContributionMxn: "100",
      targets: [{ instrumentId: "mx", weight: 100 }],
      approved: true,
      updatedAt: now.toISOString(),
    };
    const s = calculatePortfolio(
      [mxn],
      m,
      [
        {
          ...marks[0],
          instrumentId: "mx",
          value: "100",
          capturedAt: "2026-10-30T14:00:00Z",
        },
      ],
      policy,
      now,
    );
    expect(s.complete).toBe(true);
    expect(s.positions).toHaveLength(0);
    expect(s.proposal.status).toBe("blocked");
    expect(s.proposal.items).toEqual([]);
  });
  it("no trata una liquidación completa con flujo intradía ambiguo como rentabilidad0", () => {
    const m = [
      movement("1", "deposit", { amount: "100", date: "2026-10-29" }),
      movement("2", "buy", {
        instrumentId: "mx",
        quantity: "1",
        price: "100",
        date: "2026-10-29",
      }),
      movement("3", "sell", {
        instrumentId: "mx",
        quantity: "1",
        price: "200",
      }),
      movement("4", "withdrawal", { amount: "200" }),
    ];
    const s = calculatePortfolio(
      [mxn],
      m,
      [
        { ...marks[0], instrumentId: "mx", value: "100", asOf: "2026-10-29" },
        { ...marks[0], id: "new", instrumentId: "mx", value: "200" },
      ],
      undefined,
      now,
    );
    expect(s.pnlMxn).toBe("100");
    expect(s.performance.twr).toBeUndefined();
  });
  it("XIRR mide flujos anuales conocidos y se abstiene ante múltiples signos", () => {
    expect(
      xirr([
        { date: "2025-01-01", amount: -100 },
        { date: "2026-01-01", amount: 110 },
      ]),
    ).toBeCloseTo(10, 5);
    expect(
      xirr([
        { date: "2024-01-01", amount: -100 },
        { date: "2025-01-01", amount: 300 },
        { date: "2026-01-01", amount: -200 },
      ]),
    ).toBeUndefined();
    expect(
      xirr([
        { date: "2025-01-01", amount: -0.00000001 },
        { date: "2026-01-01", amount: 0.00000002 },
      ]),
    ).toBeCloseTo(100, 5);
  });
  it("valores calculados grandes no bloquean el archivo ni pierden precisión", () => {
    const s = calculatePortfolio(
      [mxn],
      [
        movement("1", "deposit", { amount: "100" }),
        movement("2", "buy", {
          instrumentId: "mx",
          quantity: "100",
          price: "1",
        }),
      ],
      [{ ...marks[0], instrumentId: "mx", value: "999999999999" }],
      undefined,
      now,
    );
    expect(s.valueMxn).toBe("99999999999900");
    expect(s.pnlMxn).toBe("99999999999800");
  });
});
describe("validación e importación explícita", () => {
  it("rechaza fecha imposible/futura, exponentes, USD sin tipo ejecutado y comisiones en split", () => {
    const base = {
      action: "movement",
      kind: "deposit",
      date: "2026-10-30",
      currency: "MXN",
      amount: "100",
    };
    for (const extra of [
      { date: "2026-02-30" },
      { date: "2099-01-01" },
      { amount: "1e6" },
      { currency: "USD" },
      { amount: "-10" },
    ])
      expect(financeActionSchema.safeParse({ ...base, ...extra }).success).toBe(
        false,
      );
    expect(
      financeActionSchema.safeParse({
        ...base,
        kind: "split",
        instrumentId: "a",
        quantity: "2",
        amount: "0",
        fee: "1",
      }).success,
    ).toBe(false);
  });
  it("CSV conserva comillas, saltos y referencias, y rechaza filas ambiguas", () => {
    const header =
      "date,kind,symbol,exchange,currency,quantity,price,amount,fee,fxRate,note,reference";
    const rows = parseFinanceCsv(
      `${header}\n2026-10-30,deposit,,,MXN,,,100,0,,"Nota, con\nsalto",ref-1`,
      [],
    );
    expect(rows[0].note).toBe("Nota, con\nsalto");
    expect(rows[0].reference).toBe("ref-1");
    expect(() =>
      parseFinanceCsv(`${header}\n2026-10-30,buy,FUND,OTHER,USD,1,10,,0,,,a`, [
        instrument,
      ]),
    ).toThrow("registra primero");
    expect(() => parseFinanceCsv(`${header}\n"sin cerrar`, [])).toThrow(
      "cerrar",
    );
  });
});
