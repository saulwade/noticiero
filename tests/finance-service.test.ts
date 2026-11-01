import { beforeEach, describe, it, expect } from "vitest";
import { getDb } from "@/db/client";
import * as t from "@/db/schema";
import {
  financeAction,
  getFinanceData,
  boundedFinanceView,
  exportFinance,
} from "@/features/finance/service";
import { backupColumns, validateSnapshot } from "@/features/backups/format";
const today = "2026-10-30";
beforeEach(async () => {
  const db = await getDb();
  for (const table of [
    t.financeSync,
    t.financeInstruments,
    t.financeMovements,
    t.financeMarks,
    t.financePolicies,
    t.financeTheses,
    t.financeDecisions,
    t.financeResearch,
  ])
    await db.delete(table);
});
async function instrument() {
  const result = await financeAction({
    action: "instrument",
    symbol: "TEST",
    name: "Fondo sintético",
    kind: "etf",
    currency: "USD",
    exchange: "TEST",
    fractional: true,
  });
  return (result as { instrumentId: string }).instrumentId;
}
const deposit = (reference: string) =>
  financeAction({
    action: "movement",
    kind: "deposit",
    date: today,
    currency: "MXN",
    amount: "1000",
    reference,
  });
describe("archivo financiero independiente y auditable", () => {
  it("reintentos idempotentes y referencias conflictivas no alteran efectivo", async () => {
    await deposit("same");
    await deposit("same");
    expect((await getFinanceData()).summary.valueMxn).toBe("1000");
    await expect(
      financeAction({
        action: "movement",
        kind: "deposit",
        date: today,
        currency: "MXN",
        amount: "2000",
        reference: "same",
      }),
    ).rejects.toThrow("datos diferentes");
  });
  it("importa lote en orden, conserva importación y rechaza entero un lote insolvente", async () => {
    const id = await instrument();
    const header =
      "date,kind,symbol,exchange,currency,quantity,price,amount,fee,fxRate,note,reference";
    const csv = [
      header,
      `${today},deposit,,,MXN,,,1000,0,,,z`,
      `${today},exchange,,,MXN,,,400,0,20,,b`,
      `${today},buy,TEST,TEST,USD,2,10,0,0,,,a`,
    ].join("\n");
    await financeAction({ action: "import", csv });
    await financeAction({ action: "import", csv });
    let data = await getFinanceData(true);
    expect(data.movements).toHaveLength(3);
    expect(data.summary.cash).toEqual({ MXN: "600", USD: "0" });
    expect(data.summary.positions[0].instrumentId).toBe(id);
    await expect(
      financeAction({
        action: "import",
        csv: [
          header,
          `${today},deposit,,,MXN,,,100,0,,,extra`,
          `${today},withdrawal,,,MXN,,,999999,0,,,bad`,
        ].join("\n"),
      }),
    ).rejects.toThrow("efectivo negativo");
    data = await getFinanceData(true);
    expect(data.movements).toHaveLength(3);
  });
  it("no permite revertir una aportación gastada y conserva la original", async () => {
    await deposit("one");
    await financeAction({
      action: "movement",
      kind: "fee",
      date: today,
      currency: "MXN",
      amount: "10",
      reference: "fee",
    });
    const original = (await getFinanceData(true)).movements.find(
      (m) => m.kind === "deposit",
    )!;
    await expect(
      financeAction({
        action: "reverse",
        movementId: original.id,
        note: "Corregir comprobante",
      }),
    ).rejects.toThrow("efectivo negativo");
    expect((await getFinanceData(true)).movements).toHaveLength(2);
  });
  it("aprueba solo pesos100 sin duplicados, y conserva borradores", async () => {
    await expect(
      financeAction({
        action: "policy",
        monthlyContributionMxn: "100",
        targets: [{ instrumentId: "CASH_MXN", weight: 90 }],
        approved: true,
      }),
    ).rejects.toThrow("100%");
    await financeAction({
      action: "policy",
      monthlyContributionMxn: "100",
      targets: [{ instrumentId: "CASH_MXN", weight: 100 }],
      approved: true,
    });
    expect((await getFinanceData()).policy?.approved).toBe(true);
  });
  it("el diario es una captura inmutable y el archivo completo se exporta", async () => {
    await deposit("one");
    await financeAction({
      action: "decision",
      date: today,
      decision: "Sin cambios",
      reason: "Confirmar la política antes de operar",
      alternatives: "Esperar",
      revisitWhen: "Revisión mensual",
    });
    await deposit("two");
    const data = await getFinanceData(true);
    expect(data.summary.valueMxn).toBe("2000");
    expect(data.decisions[0].snapshot.summary.valueMxn).toBe("1000");
    expect(await exportFinance()).toContain("Sin cambios");
  });
  it("limita el historial de políticas y lo cuenta en el archivo", async () => {
    const db = await getDb();
    await db.insert(t.financePolicies).values(
      Array.from({ length: 200 }, (_, i) => ({
        id: String(i),
        data: {
          monthlyContributionMxn: "100",
          targets: [],
          approved: false,
          updatedAt: new Date().toISOString(),
        },
      })),
    );
    expect((await getFinanceData()).counts?.policyVersions).toBe(200);
    await expect(
      financeAction({
        action: "policy",
        monthlyContributionMxn: "100",
        targets: [],
        approved: false,
      }),
    ).rejects.toThrow("200 versiones");
  });
  it("versiona precios A→B→A y tesis en lugar de perder reversiones", async () => {
    const id = await instrument();
    for (const value of ["10", "20", "10"])
      await financeAction({
        action: "mark",
        kind: "price",
        instrumentId: id,
        value,
        asOf: today,
        source: "Comprobante público",
      });
    const raw = await getFinanceData(true);
    expect(raw.marks).toHaveLength(3);
    for (const statement of [
      "Primera hipótesis a comprobar",
      "Hipótesis revisada por riesgo",
    ])
      await financeAction({
        action: "thesis",
        instrumentId: id,
        statement,
        risks: "Riesgo bursátil",
        invalidators: "Menor demanda sostenida",
        horizon: "Largo plazo",
        sources: [{ title: "Documento", url: "https://example.com/report" }],
      });
    expect((await getFinanceData(true)).theses).toHaveLength(2);
  });
  it("vista acotada mide UTF8 y no recorta el archivo usado para calcular", async () => {
    await deposit("base");
    const data = await getFinanceData(true);
    const expanded = {
      ...data,
      movements: Array.from({ length: 2000 }, (_, i) => ({
        ...data.movements[0],
        id: String(i),
        note: "界".repeat(2000),
      })),
    };
    const view = boundedFinanceView(expanded);
    expect(Buffer.byteLength(JSON.stringify(view))).toBeLessThanOrEqual(
      1_500_000,
    );
    expect(expanded.movements).toHaveLength(2000);
    expect(view.viewLimited).toBe(true);
    expect(view.summary.valueMxn).toBe("1000");
  });
  it("acepta respaldos anteriores completos22/26 33/34, nunca parciales", () => {
    const tables = Object.keys(backupColumns).map((name) => ({
      name,
      rows: [],
    }));
    for (const set of [
      tables,
      tables.filter((t) => t.name !== "finance_sync"),
      tables.filter((t) => !t.name.startsWith("finance_")),
      tables.filter(
        (t) =>
          !t.name.startsWith("finance_") && !t.name.startsWith("evidence_"),
      ),
    ])
      expect(
        validateSnapshot({
          version: 1,
          createdAt: new Date().toISOString(),
          tables: set,
        }).tables,
      ).toHaveLength(set.length);
    expect(() =>
      validateSnapshot({
        version: 1,
        createdAt: new Date().toISOString(),
        tables: tables.slice(0, 26),
      }),
    ).toThrow();
  });
});
