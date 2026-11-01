import { z } from "zod";
import { createHash } from "node:crypto";
import { decimal, formatted, multiply, SCALE } from "./decimal";
import { validDay } from "./market-calendar";
import type { AutomationInput, AutomationReport } from "./automatic-types";
import { stockReportSchema, validateStockReport } from "./stock-validation";

const text = z.string().trim().min(1).max(4000);
const money = z.string().regex(/^\d{1,12}(?:\.\d{1,8})?$/);
const capital = z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/);
const date = z
  .string()
  .max(40)
  .refine((s) => Number.isFinite(Date.parse(s)), "Fecha inválida.");
const finite = z.number().finite();
const weight = finite.min(0).max(1);
const lines = z.array(text).max(30);
export const automationProfileSchema = z
  .object({
    id: z.string().min(1).max(160),
    version: z.number().int().min(1).max(100000),
    initialCapitalMxn: capital,
    monthlyContributionMxn: capital,
    horizonYears: finite.int().min(1).max(30),
    riskPreference: z.enum(["unconfirmed", "cautious", "balanced", "growth"]),
    reserveExcluded: z.literal(true),
    broker: z
      .object({
        name: text.max(200),
        verified: z.boolean(),
        fractional: z.boolean().optional(),
        feePercent: finite.min(0).max(10).optional(),
        fxSpreadPercent: finite.min(0).max(10).optional(),
      })
      .strict(),
    updatedAt: date,
  })
  .strict();
const allocation = z
  .object({
    symbol: z.string().min(1).max(20),
    name: text.max(200),
    weight,
    amountMxn: capital,
    quantity: money.optional(),
    price: money.optional(),
    priceSession: date.optional(),
    reason: text,
    sourceUrl: z.string().url().max(1000),
  })
  .strict();
const budget = z
  .object({
    budgetMxn: capital,
    items: z.array(allocation).max(8),
    cashRemainderMxn: capital,
  })
  .strict();
const baseAutomationReportSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1).max(160),
    inputHash: z.string().regex(/^[a-f0-9]{64}$/),
    asOf: date,
    engineVersion: z.string().min(1).max(120),
    status: z.enum(["provisional", "review", "insufficient-data"]),
    headline: text,
    conclusion: text,
    action: z.enum([
      "prepare",
      "maintain",
      "contribute",
      "review-risk",
      "wait",
    ]),
    reasons: lines,
    initial: budget,
    contribution: budget.extend({ reason: text }),
    risk: z
      .object({
        observations: finite.int().min(0).max(260),
        frequency: z.literal("weekly"),
        from: date.optional(),
        to: date.optional(),
        annualizedVolatility: finite.min(0).max(100).optional(),
        maximumDrawdown: finite.min(-1).max(0).optional(),
        historicalReturn: finite.min(-1).max(1000).optional(),
        concentration: weight,
        covarianceMethod: text,
        riskContributions: z
          .array(
            z
              .object({
                symbol: text.max(20),
                share: finite.min(-100).max(100),
              })
              .strict(),
          )
          .max(8),
        correlations: z
          .array(
            z
              .object({
                a: text.max(20),
                b: text.max(20),
                value: finite.min(-1).max(1),
              })
              .strict(),
          )
          .max(28),
        caveats: lines,
      })
      .strict(),
    scenarios: z
      .array(
        z
          .object({
            label: text,
            returnPercent: finite.min(-100).max(1000),
            endValueMxn: money,
            assumption: text,
          })
          .strict(),
      )
      .max(12),
    projections: z
      .array(
        z
          .object({
            years: finite.int().min(1).max(60),
            lowerMxn: money,
            medianMxn: money,
            upperMxn: money,
            method: text,
            caveat: text,
          })
          .strict(),
      )
      .max(12),
    alternatives: z
      .array(
        z
          .object({
            label: text,
            weights: z
              .array(z.object({ symbol: text.max(20), weight }).strict())
              .max(8),
            rationale: text,
          })
          .strict(),
      )
      .max(8),
    news: z
      .array(
        z
          .object({
            id: text.max(160),
            title: text,
            url: z.string().url().max(2000),
            sourceName: text,
            publishedAt: date,
            mechanism: text,
            implication: text,
          })
          .strict(),
      )
      .max(12),
    warnings: lines,
    nextReview: z
      .object({
        daily: date,
        contribution: date,
        strategy: date,
        triggers: lines,
      })
      .strict(),
    methodology: lines,
  })
  .strict();

export const automationReportSchema = baseAutomationReportSchema
  .extend({
    stockResearch: stockReportSchema.optional(),
    actualRisk: z
      .object({
        weights: z
          .array(z.object({ symbol: text.max(20), weight }).strict())
          .max(3),
        maximumWeightDrift: weight,
        risk: baseAutomationReportSchema.shape.risk,
        scenarios: baseAutomationReportSchema.shape.scenarios,
      })
      .strict()
      .optional(),
    evaluation: z
      .object({
        method: text,
        folds: finite.int().min(0).max(20),
        attemptedFolds: finite.int().min(1).max(20),
        infeasibleFolds: finite.int().min(0).max(20),
        trainingWeeks: z.literal(104),
        testWeeks: z.literal(13),
        estimatedVolatility: finite.min(0).max(100).optional(),
        realizedVolatility: finite.min(0).max(100).optional(),
        baselineRealizedVolatility: finite.min(0).max(100).optional(),
        breaches: finite.int().min(0).max(20),
        caveat: text,
      })
      .strict()
      .optional(),
  })
  .strict();

export function canonicalAutomation(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(canonicalAutomation).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalAutomation(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function automationInputHash(
  input: Omit<AutomationInput, "inputHash"> | AutomationInput,
) {
  const { asOf, ...rest } = input;
  const value = {
    ...rest,
    inputHash: undefined,
    asOf: Math.floor(Date.parse(asOf) / 1_800_000),
    ...(input.stockResearch
      ? {
          stockResearch: {
            ...input.stockResearch,
            asOf: Math.floor(Date.parse(input.stockResearch.asOf) / 1_800_000),
          },
        }
      : {}),
  };
  return createHash("sha256").update(canonicalAutomation(value)).digest("hex");
}
function fail(): never {
  throw new Error(
    "El análisis no corresponde a la entrada preparada o no conserva el presupuesto. Vuelve a ejecutar el cálculo.",
  );
}
function validWeights(items: { symbol: string; weight: number }[]) {
  if (
    new Set(items.map((i) => i.symbol)).size !== items.length ||
    (items.length &&
      Math.abs(items.reduce((s, i) => s + i.weight, 0) - 1) > 0.000001)
  )
    fail();
}
export function validateAutomationReport(
  raw: unknown,
  input: AutomationInput,
  now = new Date(),
): AutomationReport {
  if (Buffer.byteLength(JSON.stringify(raw) ?? "") > 200_000) fail();
  const parsed = automationReportSchema.safeParse(raw);
  if (!parsed.success) fail();
  const report = parsed.data;
  if (
    report.inputHash !== input.inputHash ||
    (input.engineVersion !== undefined &&
      report.engineVersion !== input.engineVersion) ||
    input.inputHash !== automationInputHash(input) ||
    report.asOf !== input.asOf ||
    Date.parse(input.asOf) > now.getTime() ||
    now.getTime() - Date.parse(input.asOf) > 2 * 3_600_000
  )
    fail();
  const assets = new Map(input.assets.map((a) => [a.symbol, a]));
  const refs = new Map(input.references.map((r) => [r.symbol, r]));
  // Initial allocation remains a hypothetical starting-capital model even when
  // the real ledger exists. Only contribution allocation uses real holdings.
  const initialBudget = input.profile.initialCapitalMxn;
  if (
    decimal(report.initial.budgetMxn) !== decimal(initialBudget) ||
    decimal(report.contribution.budgetMxn) !==
      decimal(input.profile.monthlyContributionMxn)
  )
    fail();
  for (const allocation of [report.initial, report.contribution]) {
    validWeights(allocation.items);
    const total = allocation.items.reduce(
      (sum, item) => sum + decimal(item.amountMxn),
      decimal(allocation.cashRemainderMxn),
    );
    const difference = total - decimal(allocation.budgetMxn);
    if (difference !== 0n) fail();
    for (const item of allocation.items) {
      const asset = assets.get(item.symbol),
        reference = refs.get(item.symbol);
      if (
        !asset ||
        item.name !== asset.name ||
        item.sourceUrl !== asset.sourceUrl
      )
        fail();
      const envelope = multiply(
        decimal(allocation.budgetMxn),
        BigInt(Math.round(item.weight * 100_000_000)),
      );
      if (decimal(item.amountMxn) > envelope + 2_000_000n) fail();
      if (
        item.symbol === "MXN-CASH" &&
        (item.quantity !== undefined ||
          item.price !== undefined ||
          item.priceSession !== undefined)
      )
        fail();
      if (
        item.price !== undefined &&
        (!reference || decimal(item.price) !== decimal(reference.price))
      )
        fail();
      if (
        item.priceSession !== undefined &&
        (!reference || item.priceSession !== reference.session)
      )
        fail();
      if (item.symbol !== "MXN-CASH" && item.quantity !== undefined) {
        const fxSession = reference?.fxSession ?? reference?.session;
        if (
          !reference ||
          reference.session > input.asOf.slice(0, 10) ||
          Date.parse(input.asOf.slice(0, 10)) - Date.parse(reference.session) >
            7 * 86_400_000 ||
          !fxSession ||
          !validDay(fxSession) ||
          fxSession > input.asOf.slice(0, 10) ||
          Date.parse(input.asOf.slice(0, 10)) - Date.parse(fxSession) >
            7 * 86_400_000 ||
          Date.parse(reference.capturedAt) > Date.parse(input.asOf) ||
          !Number.isFinite(Date.parse(reference.capturedAt)) ||
          fxSession > reference.capturedAt.slice(0, 10) ||
          reference.session > reference.capturedAt.slice(0, 10) ||
          !item.price ||
          !item.priceSession ||
          decimal(item.price) <= 0n ||
          !input.profile.broker.verified ||
          input.profile.broker.feePercent === undefined ||
          input.profile.broker.fxSpreadPercent === undefined ||
          input.profile.broker.fractional === undefined
        )
          fail();
        const quantity = decimal(item.quantity);
        if (input.profile.broker.fractional !== true && quantity % SCALE !== 0n)
          fail();
        const cost = multiply(
          multiply(quantity, decimal(reference.price)),
          decimal(reference.fxMxn),
        );
        if (cost > decimal(item.amountMxn) + 2_000_000n) fail();
        const feeRate =
          (input.profile.broker.feePercent +
            input.profile.broker.fxSpreadPercent) /
          100;
        const gross = Number(formatted(cost)) * (1 + feeRate);
        if (Math.abs(gross - Number(item.amountMxn)) > 0.020001) fail();
      }
    }
  }
  if (
    input.profile.riskPreference === "unconfirmed" &&
    report.status === "review"
  )
    fail();
  for (const alt of report.alternatives) {
    validWeights(alt.weights);
    if (alt.weights.some((w) => !assets.has(w.symbol))) fail();
  }
  for (const row of report.risk.riskContributions)
    if (!assets.has(row.symbol)) fail();
  for (const row of report.risk.correlations)
    if (!assets.has(row.a) || !assets.has(row.b)) fail();
  if (
    report.risk.observations < 52 &&
    [
      report.risk.annualizedVolatility,
      report.risk.maximumDrawdown,
      report.risk.historicalReturn,
    ].some((n) => n !== undefined)
  )
    fail();
  const dates = new Set(
    input.histories.flatMap((h) => h.points.map((p) => p.date)),
  );
  const equityDates = new Set(
    input.histories.find((h) => h.symbol === "VT")?.points.map((p) => p.date) ??
      [],
  );
  const commonDates = (
    input.histories.find((h) => h.symbol === "SGOV")?.points ?? []
  ).filter((p) => equityDates.has(p.date));
  if (report.risk.observations > Math.max(0, commonDates.length - 1)) fail();
  if (
    (report.risk.from && !dates.has(report.risk.from)) ||
    (report.risk.to && !dates.has(report.risk.to)) ||
    (report.risk.from && report.risk.to && report.risk.from > report.risk.to)
  )
    fail();
  for (const projection of report.projections)
    if (
      decimal(projection.lowerMxn) > decimal(projection.medianMxn) ||
      decimal(projection.medianMxn) > decimal(projection.upperMxn) ||
      projection.years > input.profile.horizonYears
    )
      fail();
  const portfolioValue = decimal(input.portfolio.valueMxn ?? "0");
  const components = input.portfolio.positions.reduce(
    (sum, p) => sum + decimal(p.valueMxn ?? "0"),
    decimal(input.portfolio.cashMxn),
  );
  const reconciled = components - portfolioValue;
  const knownPortfolio =
    input.portfolio.hasMovements &&
    input.portfolio.complete &&
    input.portfolio.valueMxn !== undefined &&
    portfolioValue >= 0n &&
    reconciled >= -1_000_000n &&
    reconciled <= 1_000_000n &&
    input.portfolio.positions.every(
      (p) =>
        p.symbol !== "MXN-CASH" &&
        assets.has(p.symbol) &&
        p.valueMxn !== undefined,
    );
  const scenarioBase = Number(
    knownPortfolio ? input.portfolio.valueMxn : input.profile.initialCapitalMxn,
  );
  const common = [...commonDates].sort((a, b) => a.date.localeCompare(b.date));
  let consecutive = common.length ? 1 : 0;
  for (let i = 1; i < common.length; i++) {
    const gap =
      (Date.parse(common[i].date) - Date.parse(common[i - 1].date)) / 86400000;
    consecutive = gap >= 4 && gap <= 10 ? consecutive + 1 : 1;
  }
  const historyReady =
    consecutive >= 53 &&
    input.histories.length >= 2 &&
    input.histories.every(
      (h) =>
        h.adjusted &&
        h.currency === "USD" &&
        Date.parse(h.capturedAt) <= Date.parse(input.asOf),
    ) &&
    Date.parse(input.asOf.slice(0, 10)) -
      Date.parse(common.at(-1)?.date ?? "") <=
      14 * 86400000;
  if (
    report.projections.length &&
    (!historyReady ||
      report.risk.observations < 52 ||
      report.status === "insufficient-data" ||
      (input.portfolio.hasMovements && !knownPortfolio))
  )
    fail();
  if (
    report.evaluation &&
    (!historyReady ||
      report.risk.observations < 117 ||
      report.evaluation.attemptedFolds !==
        Math.floor((report.risk.observations - 104) / 13) ||
      report.evaluation.folds + report.evaluation.infeasibleFolds !==
        report.evaluation.attemptedFolds ||
      report.evaluation.breaches > report.evaluation.folds ||
      [
        report.evaluation.estimatedVolatility,
        report.evaluation.realizedVolatility,
        report.evaluation.baselineRealizedVolatility,
      ].some((v) => (v !== undefined) !== report.evaluation!.folds > 0))
  )
    fail();
  if (report.actualRisk) {
    if (!knownPortfolio || report.actualRisk.weights.length !== 3) fail();
    const actual = report.actualRisk,
      total = Number(input.portfolio.valueMxn);
    const actualWeights = new Map(
      actual.weights.map((w) => [w.symbol, w.weight]),
    );
    if (actualWeights.size !== 3) fail();
    const objective = new Map(
      report.initial.items.map((w) => [w.symbol, w.weight]),
    );
    let drift = 0;
    for (const symbol of ["VT", "SGOV", "MXN-CASH"]) {
      const value =
        symbol === "MXN-CASH"
          ? Number(input.portfolio.cashMxn)
          : input.portfolio.positions
              .filter((p) => p.symbol === symbol)
              .reduce((s, p) => s + Number(p.valueMxn), 0);
      const expected = total > 0 ? value / total : 0;
      if (Math.abs((actualWeights.get(symbol) ?? -1) - expected) > 1e-8) fail();
      if (total > 0)
        drift = Math.max(
          drift,
          Math.abs(expected - (objective.get(symbol) ?? 0)),
        );
    }
    if (
      Math.abs(drift - actual.maximumWeightDrift) > 1e-8 ||
      actual.risk.observations !== report.risk.observations ||
      actual.risk.from !== report.risk.from ||
      actual.risk.to !== report.risk.to
    )
      fail();
    for (const scenario of actual.scenarios) {
      const expected = total * (1 + scenario.returnPercent / 100);
      if (
        Math.abs(Number(scenario.endValueMxn) - expected) >
        0.02 + total * 0.000000005
      )
        fail();
    }
    if (drift > 0.05 + 1e-8 && total > 0 && report.action === "maintain")
      fail();
  }
  for (const scenario of report.scenarios) {
    const expected = scenarioBase * (1 + scenario.returnPercent / 100);
    const tolerance = 0.02 + scenarioBase * 0.000000005;
    if (
      !Number.isFinite(expected) ||
      Math.abs(Number(scenario.endValueMxn) - expected) > tolerance
    )
      fail();
  }
  for (const news of report.news) {
    const known = input.news.find((n) => n.id === news.id);
    if (
      !known ||
      ["title", "url", "sourceName", "publishedAt"].some(
        (key) =>
          known[key as keyof typeof known] !== news[key as keyof typeof news],
      )
    )
      fail();
  }
  if (new Set(report.news.map((n) => n.id)).size !== report.news.length) fail();
  validateStockReport(report.stockResearch, input, canonicalAutomation, fail);
  for (const review of [
    report.nextReview.daily,
    report.nextReview.contribution,
    report.nextReview.strategy,
  ])
    if (Date.parse(review) < Date.parse(input.asOf.slice(0, 10))) fail();
  return report;
}
