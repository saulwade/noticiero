import { problemContext } from "@/features/evidence/engine";
import type { EvidenceRecord } from "@/features/evidence/types";

export type EvaluationOutcome = "problem" | "context" | "resolution";
export type EvaluationExample = {
  id: string;
  group: string;
  split: "calibration" | "check";
  expected: EvaluationOutcome;
  reason: string;
  record: EvidenceRecord;
};
export function observedOutcome(record: EvidenceRecord): EvaluationOutcome {
  const context = problemContext(record);
  return record.kind === "statistic"
    ? "context"
    : context.correction
      ? "resolution"
      : context.accepted
        ? "problem"
        : "context";
}
export function evaluateOpportunities(examples: EvaluationExample[]) {
  let tp = 0,
    fp = 0,
    fn = 0,
    tn = 0,
    exact = 0;
  const errors: {
    id: string;
    expected: EvaluationOutcome;
    actual: EvaluationOutcome;
  }[] = [];
  for (const example of examples) {
    const actual = observedOutcome(example.record);
    const expectedPositive = example.expected === "problem";
    const positive = actual === "problem";
    if (positive && expectedPositive) tp++;
    else if (positive) fp++;
    else if (expectedPositive) fn++;
    else tn++;
    if (actual === example.expected) exact++;
    else errors.push({ id: example.id, expected: example.expected, actual });
  }
  return {
    examples: examples.length,
    tp,
    fp,
    fn,
    tn,
    exact,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
    accuracy: examples.length ? exact / examples.length : null,
    errors,
  };
}
