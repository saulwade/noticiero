import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  evaluateOpportunities,
  type EvaluationExample,
} from "../src/features/research/evaluation";

const raw = fs.readFileSync(
  "tests/fixtures/opportunity-evaluation.json",
  "utf8",
);
const dataset = JSON.parse(raw) as {
  examples: EvaluationExample[];
  labeler: string;
  sampling: string;
  purpose: string;
};
const examples = dataset.examples;
if (examples.length !== 100 || new Set(examples.map((e) => e.id)).size !== 100)
  throw new Error("La evaluación requiere cien ejemplos distintos.");
const groups = new Map<string, string>();
for (const row of examples) {
  if (groups.has(row.group) && groups.get(row.group) !== row.split)
    throw new Error("Un origen aparece en ambos grupos de evaluación.");
  groups.set(row.group, row.split);
}
const by = (field: "source" | "language") =>
  Object.fromEntries(
    [...new Set(examples.map((e) => e.record[field]))].map((value) => [
      value,
      evaluateOpportunities(examples.filter((e) => e.record[field] === value)),
    ]),
  );
console.log(
  JSON.stringify(
    {
      datasetSha256: createHash("sha256").update(raw).digest("hex"),
      labeler: dataset.labeler,
      sampling: dataset.sampling,
      purpose: dataset.purpose,
      limits:
        "Muestra pequeña etiquetada por agente, no representativa ni validación humana/comercial. Las métricas no demuestran precisión general.",
      all: evaluateOpportunities(examples),
      calibration: evaluateOpportunities(
        examples.filter((e) => e.split === "calibration"),
      ),
      check: evaluateOpportunities(examples.filter((e) => e.split === "check")),
      bySource: by("source"),
      byLanguage: by("language"),
    },
    null,
    2,
  ),
);
