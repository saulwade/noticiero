import { z } from "zod";
import type { StockContext } from "./stock-types";
import type { AutomationInput } from "./automatic-types";

const finite = z.number().finite();
const line = z.string().min(1).max(4000);
export const stockReportSchema = z
  .object({
    context: z.custom<StockContext>((value) =>
      Boolean(value && typeof value === "object"),
    ),
    caveat: line,
    analyses: z
      .array(
        z
          .object({
            symbol: line.max(20),
            status: z.enum(["available", "partial", "pending"]),
            factId: line.max(160).optional(),
            metrics: z
              .array(
                z
                  .object({
                    key: line.max(100),
                    label: line.max(200),
                    value: finite,
                    unit: z.enum(["ratio", "USD"]),
                    period: line.max(40),
                    factIndexes: z
                      .array(finite.int().min(0).max(39))
                      .min(1)
                      .max(2),
                  })
                  .strict(),
              )
              .max(8),
            findings: z.array(line).max(12),
            questions: z.array(line).max(8),
            statistics: z
              .object({
                observations: finite.int().min(52).max(155),
                from: line.max(10),
                to: line.max(10),
                annualizedVolatility: finite.min(0).max(100),
                maximumDrawdown: finite.min(-1).max(0),
                cumulativeReturn: finite.min(-1).max(1e9),
                currency: z.literal("MXN"),
              })
              .strict()
              .optional(),
          })
          .strict(),
      )
      .max(6),
  })
  .strict();

export function validateStockReport(
  report: z.infer<typeof stockReportSchema> | undefined,
  input: AutomationInput,
  canonical: (x: unknown) => string,
  fail: () => never,
) {
  if (!input.stockResearch) {
    if (report) fail();
    return;
  }
  if (!report) fail();
  const expected = {
    ...input.stockResearch,
    candidates: input.stockResearch.candidates.map((candidate) => {
      const { history: _history, ...context } = candidate;
      void _history;
      return context;
    }),
  };
  if (
    canonical(report.context) !== canonical(expected) ||
    report.analyses.length !== expected.candidates.length ||
    new Set(report.analyses.map((a) => a.symbol)).size !==
      report.analyses.length
  )
    fail();
  for (const analysis of report.analyses) {
    const candidate = input.stockResearch.candidates.find(
      (c) => c.symbol === analysis.symbol,
    );
    if (!candidate || analysis.factId !== candidate.facts?.id) fail();
    const facts = [
      ...(candidate.facts?.facts ?? []),
      ...(candidate.facts?.comparisonFacts ?? []),
    ];
    if (
      new Set(analysis.metrics.map((m) => m.key)).size !==
      analysis.metrics.length
    )
      fail();
    for (const metric of analysis.metrics) {
      const [a, b] = metric.factIndexes.map((index) => facts[index]);
      if (
        !a ||
        !b ||
        a.unit !== "USD" ||
        b.unit !== "USD" ||
        metric.factIndexes.length !== 2 ||
        a.end > input.asOf.slice(0, 10) ||
        b.end > input.asOf.slice(0, 10) ||
        a.filed > input.asOf.slice(0, 10) ||
        b.filed > input.asOf.slice(0, 10) ||
        metric.period !== `${a.start ?? a.end} / ${a.end}`
      )
        fail();
      const same =
        a.start === b.start && a.end === b.end && a.accession === b.accession;
      let value: number;
      if (metric.key.startsWith("revenue-yoy")) {
        const lag = (Date.parse(a.end) - Date.parse(b.end)) / 86400000;
        const durationDifference =
          Math.abs(
            Date.parse(a.end) -
              Date.parse(a.start ?? "") -
              (Date.parse(b.end) - Date.parse(b.start ?? "")),
          ) / 86400000;
        if (
          !a.label.startsWith("Ingresos") ||
          a.label !== b.label ||
          !(b.value > 0) ||
          lag < 350 ||
          lag > 380 ||
          !Number.isFinite(durationDifference) ||
          durationDifference > 7 ||
          metric.unit !== "ratio"
        )
          fail();
        value = a.value / b.value - 1;
      } else if (metric.key.startsWith("fcf-proxy")) {
        if (
          !same ||
          !a.label.startsWith("Flujo operativo") ||
          !b.label.startsWith("Inversión en propiedad") ||
          b.value < 0 ||
          metric.unit !== "USD"
        )
          fail();
        value = a.value - b.value;
      } else if (
        metric.key.startsWith("operating-margin") ||
        metric.key.startsWith("net-margin")
      ) {
        const label = metric.key.startsWith("operating")
          ? "Resultado operativo"
          : "Resultado neto";
        if (
          !same ||
          !a.label.startsWith("Ingresos") ||
          !b.label.startsWith(label) ||
          !(a.value > 0) ||
          metric.unit !== "ratio"
        )
          fail();
        value = b.value / a.value;
      } else fail();
      if (
        !Number.isFinite(value) ||
        Math.abs(value - metric.value) > 1e-8 * Math.max(1, Math.abs(value))
      )
        fail();
    }
    if (analysis.statistics) {
      const history = candidate.history,
        stats = analysis.statistics;
      if (
        !history?.adjusted ||
        history.currency !== "USD" ||
        history.symbol !== candidate.symbol ||
        Date.parse(history.capturedAt) > Date.parse(input.asOf)
      )
        fail();
      let prices: number[] = [],
        dates: string[] = [];
      for (const point of history.points.slice(-156)) {
        const price = Number(point.adjustedClose) * Number(point.fxMxn),
          previous = dates.at(-1);
        const lag =
          (Date.parse(point.date) - Date.parse(point.fxDate ?? point.date)) /
          86400000;
        if (
          !(price > 0) ||
          !Number.isFinite(price) ||
          point.date > input.asOf.slice(0, 10) ||
          point.date > history.capturedAt.slice(0, 10) ||
          lag < 0 ||
          lag > 7 ||
          !Number.isFinite(lag) ||
          (previous && point.date <= previous)
        )
          fail();
        const interval = previous
          ? (Date.parse(point.date) - Date.parse(previous)) / 86400000
          : 7;
        if (interval < 4 || interval > 10) {
          prices = [];
          dates = [];
        }
        prices.push(price);
        dates.push(point.date);
      }
      if (
        prices.length < 53 ||
        stats.observations !== prices.length - 1 ||
        stats.from !== dates[0] ||
        stats.to !== dates.at(-1) ||
        Date.parse(input.asOf.slice(0, 10)) - Date.parse(stats.to) >
          14 * 86400000
      )
        fail();
      const returns = prices.slice(1).map((p, i) => p / prices[i] - 1),
        mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const vol = Math.sqrt(
        (returns.reduce((s, r) => s + (r - mean) ** 2, 0) /
          (returns.length - 1)) *
          52,
      );
      let peak = prices[0],
        drawdown = 0;
      for (const p of prices) {
        peak = Math.max(peak, p);
        drawdown = Math.min(drawdown, p / peak - 1);
      }
      if (
        Math.abs(vol - stats.annualizedVolatility) > 1e-8 ||
        Math.abs(drawdown - stats.maximumDrawdown) > 1e-8 ||
        Math.abs(prices.at(-1)! / prices[0] - 1 - stats.cumulativeReturn) > 1e-8
      )
        fail();
    }
    const expectedStatus =
      analysis.metrics.length && analysis.statistics
        ? "available"
        : candidate.facts || analysis.statistics
          ? "partial"
          : "pending";
    if (analysis.status !== expectedStatus) fail();
  }
}
