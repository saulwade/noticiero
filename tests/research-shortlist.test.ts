import { describe, expect, it } from "vitest";
import { buildDossiers, weeklyReport } from "@/features/evidence/engine";
import {
  evidenceCoverage,
  researchShortlist,
} from "@/features/evidence/shortlist";
import type { EvidenceRecord } from "@/features/evidence/types";
const now = new Date("2026-11-01T16:00:00Z");
const record = (
  id: string,
  extra: Partial<EvidenceRecord> = {},
): EvidenceRecord => ({
  id,
  externalId: id,
  source: "hn",
  sourceName: "Ask HN",
  url: `https://news.ycombinator.com/item?id=${id}`,
  title: "Invoice problem",
  quote:
    "I cannot export invoices from our accounting app every week, so I manually copy records for 3 hours.",
  occurredAt: "2026-10-30T12:00:00Z",
  capturedAt: now.toISOString(),
  kind: "community",
  language: "en",
  authorKey: `hn:${id}`,
  product: "Ledger",
  ...extra,
});
describe("resumen útil para investigar negocios", () => {
  it("el semanal usa el último total aunque reciba versiones en orden inverso", () => {
    const old = record("stats-old", {
      source: "sfc-co",
      externalId: "same-stat",
      kind: "statistic",
      country: "CO",
      revision: 1,
      quote: "Total antiguo: 100",
      period: "2026-09",
      aggregateCount: 100,
    });
    const latest = {
      ...old,
      id: "stats-new",
      revision: 2,
      quote: "Total nuevo: 200",
      aggregateCount: 200,
    };
    const report = weeklyReport([latest, old], [], now);
    expect(report.markdown).toContain("Total nuevo: 200");
    expect(report.markdown).not.toContain("Total antiguo: 100");
  });
  it("no produce prioridades con un solo autor ni con estadísticas agregadas", () => {
    const records = [
      record("a"),
      record("b", { authorKey: "hn:a" }),
      record("total", {
        kind: "statistic",
        aggregateCount: 9000,
        country: "CO",
      }),
    ];
    expect(
      researchShortlist(buildDossiers(records, [], now), records, now),
    ).toEqual([]);
  });
  it("muestra citas, lagunas y experimento sin declarar validación comercial", () => {
    const records = [record("a"), record("b")];
    const leads = researchShortlist(
      buildDossiers(records, [], now),
      records,
      now,
    );
    expect(leads).toHaveLength(1);
    expect(leads[0].authors).toBe(2);
    expect(leads[0].evidence).toHaveLength(2);
    expect(leads[0].gaps).toContain(
      "Comprobar disposición a pagar con un experimento real.",
    );
    expect(leads[0].gaps.some((g) => g.includes("México"))).toBe(true);
    expect(leads[0].nextStep).toContain("cinco personas");
  });
  it("señala antecedentes y no vuelve reciente un caso capturado hoy", () => {
    const records = [
      record("a", { occurredAt: "2026-01-10" }),
      record("b", { occurredAt: "2026-01-11" }),
    ];
    const leads = researchShortlist(
      buildDossiers(records, [], now),
      records,
      now,
    );
    expect(leads[0].historical).toBe(true);
    expect(leads[0].gaps.some((g) => g.includes("vigente"))).toBe(true);
  });
  it("la cobertura cuenta una versión por caso y separa grupos estadísticos de personas", () => {
    const records = [
      record("a", { country: "MX", revision: 1 }),
      record("a2", { externalId: "a", country: "MX", revision: 2 }),
      record("stats", {
        country: "CO",
        kind: "statistic",
        aggregateCount: 9000,
        period: "2026-09",
      }),
    ];
    expect(evidenceCoverage(records)).toEqual([
      { country: "CO", cases: 0, statistics: 1, latestDate: "2026-09" },
      { country: "MX", cases: 1, statistics: 0, latestDate: "2026-10-30" },
    ]);
  });
  it("un caso resuelto y sus revisiones no crean repetición activa", () => {
    const records = [record("a"), record("b", { resolution: "resolved" })];
    expect(
      researchShortlist(buildDossiers(records, [], now), records, now),
    ).toEqual([]);
  });
});
