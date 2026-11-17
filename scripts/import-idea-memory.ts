import fs from "node:fs/promises";
import {
  importIdeaMemory,
  refreshIdeaMemory,
} from "../src/features/idea-memory/service";
const file = process.argv[2];
if (!file)
  throw new Error(
    "Indica un JSON privado con definiciones y decisiones; no se lee información financiera.",
  );
const stat = await fs.stat(file);
if (stat.size > 500_000)
  throw new Error("La importación supera el límite de 500 KB.");
try {
  const result = await importIdeaMemory(
    JSON.parse(await fs.readFile(file, "utf8")),
  );
  const memory = await refreshIdeaMemory();
  console.log(
    JSON.stringify({
      ...result,
      assessments: memory.assessmentCount,
      linkedRevisions: memory.linkedRevisions,
    }),
  );
} finally {
  const { getDb } = await import("../src/db/client");
  const db = await getDb();
  const client = (
    db as unknown as { $client?: { end?: () => Promise<unknown> } }
  ).$client;
  await client?.end?.();
}
