import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import * as t from "@/db/schema";
import modelConfig from "@/features/finance/automatic-engine-version.json";
import { AUTOMATION_ASSETS } from "@/features/finance/automatic-providers";
import {
  getAutomationWorkspace,
  prepareAutomationInput,
  publishAutomationReport,
  recordAutomationFailure,
  selectAutomationNews,
  type AutomationProviders,
} from "@/features/finance/automatic-service";
import {
  automationInputHash,
  validateAutomationReport,
} from "@/features/finance/automatic-validation";
import type {
  AutomationInput,
  AutomationProfile,
  AutomationReport,
} from "@/features/finance/automatic-types";
import type { FinanceNewsEvent } from "@/features/finance/research-types";
const now = new Date("2026-11-01T12:00:00Z");
// Entirely synthetic profile; these values do not represent an account.
const profile: AutomationProfile = {
  id: "synthetic-profile",
  version: 1,
  initialCapitalMxn: "10000",
  monthlyContributionMxn: "1000",
  horizonYears: 10,
  riskPreference: "unconfirmed",
  reserveExcluded: true,
  broker: { name: "Intermediario sintético", verified: false },
  updatedAt: "2026-10-31T12:00:00Z",
};
function providers(): AutomationProviders {
  return {
    fx: vi.fn(async () => ({
      value: "19",
      asOf: "2026-10-30",
      source: "FX sintético",
      sourceUrl: "https://api.frankfurter.dev/v2/rate/USD/MXN?date=2026-10-30",
    })),
    history: vi.fn<AutomationProviders["history"]>(async (asset) => ({
      id: `history-${asset.symbol}`,
      symbol: asset.symbol,
      provider: "Fixture offline",
      currency: "USD",
      adjusted: true,
      capturedAt: now.toISOString(),
      sourceUrl: "https://www.alphavantage.co/documentation/#weeklyadj",
      points: Array.from({ length: 60 }, (_, i) => ({
        date: new Date(Date.parse("2026-10-30") - (59 - i) * 7 * 86400000)
          .toISOString()
          .slice(0, 10),
        close: "100",
        adjustedClose: "98",
        fxMxn: "19",
      })),
      warnings: [],
    })),
    reference: vi.fn<AutomationProviders["reference"]>(async (asset) => ({
      symbol: asset.symbol,
      price: "100",
      currency: "USD",
      fxMxn: "19",
      session: "2026-10-30",
      capturedAt: now.toISOString(),
      sourceUrl: "https://www.alphavantage.co/documentation/#latestprice",
    })),
  };
}
function cashReport(input: AutomationInput): AutomationReport {
  const cash = AUTOMATION_ASSETS[2];
  const allocation = (amount: string) => ({
    budgetMxn: amount,
    items: [
      {
        symbol: cash.symbol,
        name: cash.name,
        weight: 1,
        amountMxn: amount,
        reason: "Esperar confirmación del riesgo y costos.",
        sourceUrl: cash.sourceUrl,
      },
    ],
    cashRemainderMxn: "0",
  });
  return {
    version: 1,
    id: `report-${input.inputHash}`,
    inputHash: input.inputHash,
    asOf: input.asOf,
    engineVersion: input.engineVersion ?? "synthetic-1",
    status: "provisional",
    headline: "Propuesta provisional sintética",
    conclusion: "Revisar riesgo antes de operar.",
    action: "review-risk",
    reasons: ["Riesgo no confirmado."],
    initial: allocation(input.profile.initialCapitalMxn),
    contribution: {
      ...allocation(input.profile.monthlyContributionMxn),
      reason: "Aportación futura condicionada a fondos reales.",
    },
    risk: {
      observations: 0,
      frequency: "weekly",
      concentration: 1,
      covarianceMethod: "Sin estimación en este caso de prueba.",
      riskContributions: [],
      correlations: [],
      caveats: ["No representa rendimiento futuro."],
    },
    scenarios: [],
    projections: [],
    alternatives: [],
    news: [],
    warnings: [],
    nextReview: {
      daily: "2026-11-02",
      contribution: "2026-12-01",
      strategy: "2027-02-01",
      triggers: ["Confirmar riesgo."],
    },
    methodology: ["Caso sintético para persistencia."],
  };
}
beforeEach(async () => {
  const db = await getDb();
  for (const table of [
    t.financeAnalyses,
    t.financeAutomationInputs,
    t.financeHistories,
    t.financeProfiles,
    t.financeSync,
    t.financeMovements,
    t.financeMarks,
    t.financeInstruments,
    t.financeNewsEvents,
    t.financeNewsReviews,
    t.financeNewsBriefs,
    t.quotes,
  ])
    await db.delete(table);
});
async function seed() {
  const db = await getDb();
  await db.insert(t.financeProfiles).values({ id: profile.id, data: profile });
}
function newsFixture(
  id: string,
  changes: Partial<FinanceNewsEvent> = {},
): FinanceNewsEvent {
  return {
    id,
    storyId: id,
    contentHash: id,
    engineVersion: "synthetic-news",
    title: "Billboard software security bug",
    url: `https://example.com/${id}`,
    sourceId: "synthetic",
    sourceName: "Fuente sintética",
    publishedAt: "2026-11-01T11:00:00Z",
    capturedAt: "2026-11-01T11:30:00Z",
    category: "Finanzas",
    coverage: "excerpt",
    excerpt: "Documento sintético para probar selección de contexto.",
    summary: "Contexto sintético.",
    summaryLanguage: "es",
    companies: [],
    eventKind: "security",
    topic: "security",
    keywords: [],
    mechanismHypothesis: "Comprobar exposición financiera.",
    questions: [],
    missingEvidence: [],
    tone: {
      label: "unclassified",
      positiveTerms: [],
      negativeTerms: [],
      method: "Sintético",
      caveat: "Sin inferencia predictiva.",
    },
    ...changes,
  };
}

describe("preparación y archivo automático sin registrar inversiones", () => {
  it("GET sin perfil solo informa configuración y no consulta red", async () => {
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("unexpected network"));
    try {
      expect((await getAutomationWorkspace(now)).status).toBe("not-configured");
      expect(network).not.toHaveBeenCalled();
      const db = await getDb();
      expect(await db.select().from(t.financeSync)).toHaveLength(0);
      await expect(prepareAutomationInput(now, providers())).rejects.toThrow(
        "perfil privado",
      );
    } finally {
      network.mockRestore();
    }
  });
  it("reutiliza series semanales y el mismo cierre diario, guardando una entrada inmutable por contexto", async () => {
    await seed();
    const sources = providers();
    const first = await prepareAutomationInput(now, sources, "cache-retry");
    const second = await prepareAutomationInput(
      new Date(now.getTime() + 5 * 60_000),
      sources,
      "cache-retry",
    );
    expect(first.inputHash).toBe(second.inputHash);
    expect(second.asOf).toBe(first.asOf);
    expect(sources.history).toHaveBeenCalledTimes(2);
    expect(sources.reference).toHaveBeenCalledTimes(2);
    expect(sources.fx).toHaveBeenCalledTimes(1);
    const db = await getDb();
    expect(await db.select().from(t.financeAutomationInputs)).toHaveLength(1);
    expect(await db.select().from(t.financeMovements)).toHaveLength(0);
    expect(await db.select().from(t.financeInstruments)).toHaveLength(0);
    const read = await getAutomationWorkspace(now);
    expect(read.status).toBe("pending");
    expect(sources.history).toHaveBeenCalledTimes(2);
  });
  it("publica exactamente una vez y rechaza reemplazos aunque cambie el identificador", async () => {
    await seed();
    const input = await prepareAutomationInput(now, providers()),
      report = cashReport(input);
    await publishAutomationReport(report, now);
    await publishAutomationReport(
      report,
      new Date(now.getTime() + 3 * 3600000),
    );
    await expect(
      publishAutomationReport(
        { ...report, id: "overwrite", conclusion: "Distinta" },
        now,
      ),
    ).rejects.toThrow();
    const db = await getDb();
    expect(await db.select().from(t.financeAnalyses)).toHaveLength(1);
    expect((await getAutomationWorkspace(now)).current).toEqual(report);
    expect(await db.select().from(t.financeMovements)).toHaveLength(0);
  });
  it("un movimiento o cambio de perfil invalida la propuesta conservando el historial", async () => {
    await seed();
    const input = await prepareAutomationInput(now, providers()),
      report = cashReport(input);
    await publishAutomationReport(report, now);
    const db = await getDb();
    await db.insert(t.financeMovements).values({
      id: "synthetic-deposit",
      data: {
        id: "synthetic-deposit",
        kind: "deposit",
        date: "2026-11-01",
        currency: "MXN",
        amount: "250",
        fee: "0",
        note: "Fixture sintético",
        createdAt: now.toISOString(),
      },
    });
    expect((await getAutomationWorkspace(now)).status).toBe("stale");
    const fresh = await prepareAutomationInput(
      new Date(now.getTime() + 60_000),
      providers(),
    );
    await db.insert(t.financeProfiles).values({
      id: "synthetic-profile-2",
      data: {
        ...profile,
        id: "synthetic-profile-2",
        version: 2,
        updatedAt: now.toISOString(),
      },
    });
    await expect(
      publishAutomationReport(cashReport(fresh), now),
    ).rejects.toThrow();
    expect((await getAutomationWorkspace(now, true)).history).toHaveLength(1);
  });
  it("rechaza contexto futuro, vencido y huella inventada", async () => {
    await seed();
    const input = await prepareAutomationInput(now, providers());
    expect(() =>
      validateAutomationReport(
        cashReport(input),
        input,
        new Date(now.getTime() - 1),
      ),
    ).toThrow();
    await expect(
      publishAutomationReport(
        cashReport(input),
        new Date(now.getTime() + 2 * 3600000 + 1),
      ),
    ).rejects.toThrow();
    await expect(
      publishAutomationReport(
        { ...cashReport(input), inputHash: "a".repeat(64) },
        now,
      ),
    ).rejects.toThrow();
    expect(
      automationInputHash({
        ...input,
        asOf: new Date(now.getTime() + 10_000).toISOString(),
      }),
    ).toBe(input.inputHash);
  });
  it("valida presupuesto, pesos, fuentes, noticias y números no finitos", async () => {
    await seed();
    const input = await prepareAutomationInput(now, providers()),
      report = cashReport(input);
    for (const mutate of [
      (r: AutomationReport) => {
        r.initial.items[0].amountMxn = "10001";
      },
      (r: AutomationReport) => {
        r.initial.items[0].weight = 0.5;
      },
      (r: AutomationReport) => {
        r.initial.items[0].sourceUrl = "https://example.com/invented";
      },
      (r: AutomationReport) => {
        r.initial.items[0].symbol = "FAKE";
      },
      (r: AutomationReport) => {
        r.risk.annualizedVolatility = Infinity;
      },
      (r: AutomationReport) => {
        r.risk.annualizedVolatility = 0.2;
      },
      (r: AutomationReport) => {
        r.status = "review";
      },
      (r: AutomationReport) => {
        r.news.push({
          id: "invented",
          title: "Inventada",
          url: "https://example.com/news",
          sourceName: "Fuente",
          publishedAt: now.toISOString(),
          mechanism: "Hipótesis",
          implication: "Revisar",
        });
      },
    ]) {
      const changed = structuredClone(report);
      mutate(changed);
      expect(() => validateAutomationReport(changed, input, now)).toThrow();
    }
  });
  it("registra errores seguros y conserva cachés ante fallo semanal", async () => {
    await seed();
    const sources = providers();
    await prepareAutomationInput(now, sources);
    const broken = providers();
    broken.history = vi.fn(async () => {
      throw new Error("https://provider.test?apikey=secret-private-key");
    });
    const next = new Date(now.getTime() + 8 * 86400000);
    broken.fx = vi.fn(async () => {
      throw new Error("secret-private-key");
    });
    const input = await prepareAutomationInput(next, broken);
    expect(input.histories[0].points).toHaveLength(60);
    expect(input.dataWarnings.join(" ")).toContain("serie anterior");
    expect(JSON.stringify(input)).not.toContain("secret-private-key");
    await recordAutomationFailure(
      "https://provider.test?apikey=secret-private-key",
      next,
    );
    const state = (await (await getDb()).select().from(t.financeSync))[0]?.data;
    expect(state.status).toBe("error");
    expect(JSON.stringify(state)).not.toContain("secret-private-key");
  });
  it("comprueba unidades, comisión y cambio frente a referencias y costos verificados", async () => {
    await seed();
    const input = await prepareAutomationInput(now, providers());
    input.profile.broker = {
      name: "Intermediario sintético",
      verified: true,
      fractional: false,
      feePercent: 0,
      fxSpreadPercent: 0,
    };
    input.inputHash = automationInputHash(input);
    const report = cashReport(input),
      asset = AUTOMATION_ASSETS[0];
    report.initial.items = [
      {
        symbol: asset.symbol,
        name: asset.name,
        sourceUrl: asset.sourceUrl,
        weight: 1,
        amountMxn: "9500",
        quantity: "5",
        price: "100",
        priceSession: "2026-10-30",
        reason: "Cinco títulos según referencia sintética.",
      },
    ];
    report.initial.cashRemainderMxn = "500";
    expect(
      validateAutomationReport(report, input, now).initial.items[0].quantity,
    ).toBe("5");
    const inflated = structuredClone(report);
    inflated.initial.items[0].amountMxn = "10000";
    inflated.initial.cashRemainderMxn = "0";
    expect(() => validateAutomationReport(inflated, input, now)).toThrow();
    const fractional = structuredClone(report);
    fractional.initial.items[0].quantity = "5.5";
    expect(() => validateAutomationReport(fractional, input, now)).toThrow();
    const wrongPrice = structuredClone(report);
    wrongPrice.initial.items[0].price = "99";
    expect(() => validateAutomationReport(wrongPrice, input, now)).toThrow();
    input.profile.broker.feePercent = 1;
    input.profile.broker.fxSpreadPercent = 1;
    input.references.find((r) => r.symbol === "VT")!.fxMxn = "10";
    input.inputHash = automationInputHash(input);
    const omittedFees = cashReport(input);
    omittedFees.initial.items = [
      { ...report.initial.items[0], amountMxn: "10000", quantity: "10" },
    ];
    expect(() => validateAutomationReport(omittedFees, input, now)).toThrow();
  });
  it("expone el archivo completo solo en la exportación privada", async () => {
    await seed();
    await prepareAutomationInput(now, providers());
    expect((await getAutomationWorkspace(now)).archive).toBeUndefined();
    const full = await getAutomationWorkspace(now, true);
    expect(full.archive?.profiles).toHaveLength(1);
    expect(full.archive?.histories).toHaveLength(2);
    expect(full.archive?.inputs).toHaveLength(1);
  });
  it("una ejecución antigua no publica ni marca fallida una preparación nueva", async () => {
    await seed();
    const sources = providers();
    const first = await prepareAutomationInput(now, sources, "attempt-a");
    const later = new Date(now.getTime() + 11 * 60_000);
    const second = await prepareAutomationInput(later, sources, "attempt-b");
    await recordAutomationFailure("old failure", later, "attempt-a");
    await expect(
      publishAutomationReport(cashReport(first), later, "attempt-a"),
    ).rejects.toThrow();
    const db = await getDb();
    let state = (await db.select().from(t.financeSync))[0].data;
    expect(state.status).toBe("running");
    expect(state.leaseToken).toBe("attempt-b");
    await publishAutomationReport(cashReport(second), later, "attempt-b");
    await recordAutomationFailure("late failure", later, "attempt-b");
    state = (await db.select().from(t.financeSync))[0].data;
    expect(state.status).toBe("ok");
  });
  it("un reintento idempotente termina únicamente su propio turno", async () => {
    await seed();
    const sources = providers();
    const input = await prepareAutomationInput(now, sources, "attempt-a");
    const report = cashReport(input);
    await publishAutomationReport(report, now, "attempt-a");
    const later = new Date(now.getTime() + 60_000);
    const retry = await prepareAutomationInput(later, sources, "attempt-b");
    expect(retry.inputHash).toBe(input.inputHash);
    await expect(
      publishAutomationReport(report, later, "attempt-a"),
    ).rejects.toThrow();
    await publishAutomationReport(report, later, "attempt-b");
    const db = await getDb();
    expect((await db.select().from(t.financeSync))[0].data.status).toBe("ok");
    expect(await db.select().from(t.financeAnalyses)).toHaveLength(1);
  });
  it("los escenarios conservan capital y retorno en su valor final", async () => {
    await seed();
    const input = await prepareAutomationInput(now, providers()),
      report = cashReport(input);
    report.scenarios = [
      {
        label: "Pérdida ilustrativa",
        returnPercent: -30,
        endValueMxn: "7000",
        assumption: "Choque hipotético.",
      },
    ];
    expect(
      validateAutomationReport(report, input, now).scenarios[0].endValueMxn,
    ).toBe("7000");
    report.scenarios[0].endValueMxn = "99999999";
    expect(() => validateAutomationReport(report, input, now)).toThrow();
  });
  it("combina cierre del viernes con FX conocido el domingo sin consultar Alpha ni mover la captura en reintentos", async () => {
    await seed();
    const db = await getDb(),
      sources = providers();
    await db.insert(t.financeMarks).values({
      id: "synthetic-sunday-fx",
      data: {
        id: "synthetic-sunday-fx",
        kind: "fx",
        value: "19",
        asOf: "2026-11-01",
        capturedAt: now.toISOString(),
        source: "FX sintético",
        sourceUrl:
          "https://api.frankfurter.dev/v2/rate/USD/MXN?date=2026-11-01",
      },
    });
    for (const asset of AUTOMATION_ASSETS.filter((a) => a.currency === "USD")) {
      const data = await sources.history(asset, now);
      data.reference = {
        symbol: asset.symbol,
        price: "100",
        currency: "USD",
        fxMxn: "18",
        session: "2026-10-30",
        fxSession: "2026-10-30",
        capturedAt: "2026-10-30T22:00:00Z",
        sourceUrl: "https://www.alphavantage.co/documentation/#latestprice",
      };
      await db.insert(t.financeHistories).values({ id: data.id, data });
    }
    vi.mocked(sources.history).mockClear();
    const input = await prepareAutomationInput(now, sources, "weekend-attempt");
    expect(input.references[0]).toMatchObject({
      session: "2026-10-30",
      fxSession: "2026-11-01",
      capturedAt: now.toISOString(),
      fxMxn: "19",
    });
    const retry = await prepareAutomationInput(
      new Date(now.getTime() + 5 * 60_000),
      sources,
      "weekend-attempt",
    );
    expect(retry.inputHash).toBe(input.inputHash);
    expect(sources.reference).not.toHaveBeenCalled();
    expect(sources.history).not.toHaveBeenCalled();
    expect(sources.fx).not.toHaveBeenCalled();
    input.profile.broker = {
      name: "Intermediario sintético",
      verified: true,
      fractional: false,
      feePercent: 0,
      fxSpreadPercent: 0,
    };
    input.inputHash = automationInputHash(input);
    const report = cashReport(input),
      asset = AUTOMATION_ASSETS[0];
    report.initial.items = [
      {
        symbol: asset.symbol,
        name: asset.name,
        sourceUrl: asset.sourceUrl,
        weight: 1,
        amountMxn: "9500",
        quantity: "5",
        price: "100",
        priceSession: "2026-10-30",
        reason: "Referencia del viernes y FX del domingo.",
      },
    ];
    report.initial.cashRemainderMxn = "500";
    expect(
      validateAutomationReport(report, input, now).initial.items[0].quantity,
    ).toBe("5");
    for (const fxSession of ["2026-11-02", "2026-10-23"]) {
      const invalid = structuredClone(input);
      invalid.references.find((r) => r.symbol === "VT")!.fxSession = fxSession;
      invalid.inputHash = automationInputHash(invalid);
      expect(() =>
        validateAutomationReport(
          { ...report, inputHash: invalid.inputHash },
          invalid,
          now,
        ),
      ).toThrow();
    }
  });
  it("una cartera totalmente retirada conserva capital real cero en escenarios", async () => {
    await seed();
    const input = await prepareAutomationInput(now, providers());
    input.portfolio = {
      ...input.portfolio,
      hasMovements: true,
      complete: true,
      valueMxn: "0",
      cashMxn: "0",
      positions: [],
    };
    input.inputHash = automationInputHash(input);
    const report = cashReport(input);
    report.scenarios = [
      {
        label: "Pérdida ilustrativa",
        returnPercent: -30,
        endValueMxn: "0",
        assumption: "Cartera real con saldo cero.",
      },
    ];
    expect(
      validateAutomationReport(report, input, now).scenarios[0].endValueMxn,
    ).toBe("0");
    report.scenarios[0].endValueMxn = "7000";
    expect(() => validateAutomationReport(report, input, now)).toThrow();
  });
  it("un cambio de modelo crea otra entrada e informe preservando el archivo previo", async () => {
    await seed();
    const sources = providers(),
      configuredVersion = modelConfig.version;
    const first = await prepareAutomationInput(now, sources, "model-a");
    expect(first.engineVersion).toBe(configuredVersion);
    const report = cashReport(first);
    await publishAutomationReport(report, now, "model-a");
    expect(() =>
      validateAutomationReport(
        { ...report, engineVersion: "incorrect-model" },
        first,
        now,
      ),
    ).toThrow();
    try {
      modelConfig.version = "automatic-quant-synthetic-next";
      expect((await getAutomationWorkspace(now)).status).toBe("stale");
      const later = new Date(now.getTime() + 60_000),
        second = await prepareAutomationInput(later, sources, "model-b");
      expect(second.inputHash).not.toBe(first.inputHash);
      expect(second.engineVersion).toBe(modelConfig.version);
      await publishAutomationReport(cashReport(second), later, "model-b");
      const db = await getDb();
      expect(await db.select().from(t.financeAnalyses)).toHaveLength(2);
      expect(await db.select().from(t.financeAutomationInputs)).toHaveLength(2);
    } finally {
      modelConfig.version = configuredVersion;
    }
  });
  it("conserva incidentes del sistema financiero sin exigir una empresa del catálogo", () => {
    const bank = newsFixture("bank-outage", {
      title: "Regional bank payment outage",
      eventKind: "security",
      companies: [],
    });
    const billboard = newsFixture("billboard-noise", {
      title: "Hackers hijack highway billboard",
      eventKind: "security",
      companies: [],
    });
    expect(
      selectAutomationNews([billboard, bank], now).map((event) => event.id),
    ).toEqual(["bank-outage"]);
  });
  it("prioriza macro antigua material sobre ruido reciente y excluye capturas futuras", async () => {
    await seed();
    const db = await getDb();
    const events = [
      ...Array.from({ length: 80 }, (_, i) => newsFixture(`security-${i}`)),
      newsFixture("older-fed", {
        title: "Federal Reserve changes interest rates",
        eventKind: "macro",
        topic: "Tipos de interés",
        publishedAt: "2026-10-10T10:00:00Z",
      }),
      newsFixture("listed-earnings", {
        title: "Microsoft reports earnings",
        eventKind: "earnings",
        publishedAt: "2026-10-20T10:00:00Z",
        companies: [{ symbol: "MSFT", name: "Microsoft", private: false }],
      }),
      newsFixture("future-capture", {
        title: "Federal Reserve changes rates",
        eventKind: "macro",
        capturedAt: "2026-11-02T00:00:00Z",
      }),
      newsFixture("future-publication", {
        title: "Federal Reserve changes rates",
        eventKind: "macro",
        publishedAt: "2026-11-02T00:00:00Z",
      }),
      newsFixture("outdated-macro", {
        title: "Federal Reserve changes rates",
        eventKind: "macro",
        publishedAt: "2026-09-01T00:00:00Z",
      }),
    ];
    await db
      .insert(t.financeNewsEvents)
      .values(events.map((data) => ({ id: data.id, data })));
    const input = await prepareAutomationInput(now, providers());
    expect(input.news.map((e) => e.id)).toEqual([
      "older-fed",
      "listed-earnings",
    ]);
    expect(input.dataWarnings.join(" ")).toContain("muestra priorizada");
    expect(await db.select().from(t.financeNewsEvents)).toHaveLength(
      events.length,
    );
  });
  it("limita a 32 noticias y reduce primero el contexto de menor prioridad para caber en 400 KB", async () => {
    await seed();
    const db = await getDb();
    const macro = newsFixture("important-fed", {
      title: "Federal Reserve changes interest rates",
      eventKind: "macro",
      topic: "Tipos de interés",
      publishedAt: "2026-10-10T10:00:00Z",
    });
    const earnings = Array.from({ length: 40 }, (_, i) =>
      newsFixture(`earnings-${i}`, {
        title: `Microsoft earnings report ${i}`,
        excerpt: `${i} ${"Contenido sintético. ".repeat(1200)}`,
        eventKind: "earnings",
        companies: [{ symbol: "MSFT", name: "Microsoft", private: false }],
      }),
    );
    const events = [...earnings, macro];
    const selected = selectAutomationNews(events, now);
    expect(selected).toHaveLength(32);
    expect(selected[0].id).toBe(macro.id);
    expect(
      selectAutomationNews([...events].reverse(), now).map((e) => e.id),
    ).toEqual(selected.map((e) => e.id));
    await db
      .insert(t.financeNewsEvents)
      .values(events.map((data) => ({ id: data.id, data })));
    const input = await prepareAutomationInput(now, providers());
    expect(input.news[0].id).toBe(macro.id);
    expect(input.news.length).toBeLessThan(32);
    expect(Buffer.byteLength(JSON.stringify(input))).toBeLessThanOrEqual(
      400_000,
    );
    expect(input.dataWarnings.join(" ")).toContain("se acotó por tamaño");
  });
});
