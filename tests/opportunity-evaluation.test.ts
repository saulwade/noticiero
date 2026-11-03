import { describe, it, expect } from "vitest";
import dataset from "./fixtures/opportunity-evaluation.json";
import {
  evaluateOpportunities,
  type EvaluationExample,
} from "@/features/research/evaluation";
const examples = dataset.examples as EvaluationExample[];
describe("evaluación reproducible de oportunidades", () => {
  it("conserva cien ejemplos reales con evidencia y criterio; no duplica un origen entre particiones", () => {
    expect(examples).toHaveLength(100);
    expect(
      new Set(examples.map((e) => e.record.source + ":" + e.record.externalId))
        .size,
    ).toBe(100);
    const groups = new Map<string, string>();
    for (const e of examples) {
      expect(e.record.url).toMatch(/^https:\/\//);
      expect(e.reason.length).toBeGreaterThan(20);
      expect(Number.isFinite(Date.parse(e.record.occurredAt))).toBe(true);
      if (groups.has(e.group)) expect(groups.get(e.group)).toBe(e.split);
      groups.set(e.group, e.split);
    }
    expect(examples.some((e) => e.record.language === "en")).toBe(true);
    expect(examples.some((e) => e.record.language === "es")).toBe(true);
    expect(dataset.labeler).toContain("no etiquetado humano");
  });
  it("no divide por cero al no haber ejemplos ni predicciones positivas", () => {
    expect(evaluateOpportunities([])).toMatchObject({
      precision: null,
      recall: null,
      accuracy: null,
    });
    const context = examples.find((e) => e.record.kind === "statistic")!;
    expect(evaluateOpportunities([context])).toMatchObject({
      tp: 0,
      fp: 0,
      fn: 0,
      tn: 1,
      precision: null,
      recall: null,
      accuracy: 1,
    });
  });
  it("reporta omisiones, falsas alarmas y errores sin cambiar las etiquetas", () => {
    const before = JSON.stringify(examples);
    const result = evaluateOpportunities(examples);
    expect(result.tp + result.fp + result.fn + result.tn).toBe(100);
    expect(result.errors.length).toBe(100 - result.exact);
    expect(JSON.stringify(examples)).toBe(before);
  });
  it("protege precisión y cobertura de la muestra de comprobación", () => {
    const result = evaluateOpportunities(
      examples.filter((e) => e.split === "check"),
    );
    expect(result.tp + result.fn).toBeGreaterThanOrEqual(10);
    expect(result.precision).not.toBeNull();
    expect(result.recall).not.toBeNull();
    expect(result.precision!).toBeGreaterThanOrEqual(0.85);
    expect(result.recall!).toBeGreaterThanOrEqual(0.8);
  });
});
