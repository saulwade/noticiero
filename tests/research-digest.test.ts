import { describe, it, expect } from "vitest";
import { buildResearchDigest } from "@/features/evidence/research-digest";
import { createDailyReport } from "@/features/research/report";
import { getDb } from "@/db/client";
import { saveDailyReport } from "@/features/research/service";
import { dailyReports, evidenceRecords } from "@/db/schema";
import type { EvidenceRecord } from "@/features/evidence/types";
const now = new Date("2026-11-07T16:00:00Z");
const record = (
  id: string,
  extra: Partial<EvidenceRecord> = {},
): EvidenceRecord => ({
  id,
  externalId: id,
  source: "github",
  sourceName: "GitHub",
  title: "CSV export broken",
  quote:
    "I cannot export CSV because accented characters have the wrong encoding every week, so I copy records manually for 3 hours.",
  url: `https://github.com/actualbudget/actual/issues/${id}`,
  kind: "community",
  language: "en",
  product: "actualbudget/actual",
  authorKey: `github:${id}`,
  occurredAt: "2026-11-06T12:00:00Z",
  capturedAt: now.toISOString(),
  ...extra,
});
describe("investigación del Radar en reportes automáticos", () => {
  it("prioriza contexto fiscal mexicano sin convertirlo en país del autor", () => {
    const r = record("cfdi", {
      product: "eclipxe13/CfdiUtils",
      quote: "No puedo descargar CFDI del SAT porque la solicitud falla.",
      language: "es",
    });
    const candidate = buildResearchDigest([r], [], now).candidates[0];
    expect(candidate.marketContext).toBe("MX-fiscal");
    expect(candidate.countries).toEqual([]);
    expect(candidate.stage).toBe("isolated");
  });
  it("distingue repetición, pista e histórico sin mutar las capturas", () => {
    const records = [
      record("a"),
      record("b"),
      record("isolated", { product: "Other" }),
      record("old", { product: "Old", occurredAt: "2026-01-01" }),
    ];
    const before = JSON.stringify(records),
      digest = buildResearchDigest(records, [], now);
    expect(digest.candidates.map((c) => c.stage).sort()).toEqual([
      "historical",
      "isolated",
      "repeated",
    ]);
    expect(
      digest.candidates.find((c) => c.stage === "repeated")?.publicAccounts,
    ).toBe(2);
    expect(
      digest.candidates.every((c) => c.gaps.some((g) => g.includes("pagar"))),
    ).toBe(true);
    expect(JSON.stringify(records)).toBe(before);
  });
  it("no infla repetición con versiones, la misma cuenta, resueltos o estadísticas", () => {
    const records = [
      record("a"),
      record("revision", {
        externalId: "a",
        revision: 2,
        authorKey: "github:a",
      }),
      record("same-author", { authorKey: "github:a" }),
      record("fixed", { resolution: "resolved" }),
      record("stats", { kind: "statistic", aggregateCount: 10000 }),
    ];
    const digest = buildResearchDigest(records, [], now);
    expect(digest.candidates).toHaveLength(1);
    expect(digest.candidates[0].stage).toBe("isolated");
    expect(digest.candidates[0].evidence).toHaveLength(1);
    expect(digest.statistics).toBe(1);
  });
  it("excluye evidencia futura y respeta el estado conocido al corte", () => {
    const old = record("a"),
      future = record("new", {
        externalId: "a",
        revision: 2,
        resolution: "resolved",
        capturedAt: "2026-11-08T12:00:00Z",
      });
    const digest = buildResearchDigest(
      [old, future, record("future", { occurredAt: "2026-11-08T12:00:00Z" })],
      [],
      now,
    );
    expect(digest.candidates).toHaveLength(1);
    expect(digest.candidates[0].evidence[0].url).toBe(old.url);
  });
  it("incorpora Radar sin señales HN y no atribuye México a repositorios ni idioma", () => {
    const report = createDailyReport("2026-11-07", [], [], [], [], now, {
      records: [record("a"), record("b")],
      reviews: [],
    });
    expect(report.researchDigest?.candidates).toHaveLength(1);
    expect(report.researchDigest?.candidates[0].countries).toEqual([]);
    expect(report.markdown).toContain("Problema repetido");
    expect(report.hypotheses).toEqual([]);
    const historicalReport = createDailyReport(
      "2026-11-05",
      [],
      [],
      [],
      [],
      now,
      { records: [record("a")], reviews: [] },
    );
    expect(historicalReport.researchDigest?.cases).toBe(0);
  });
  it("no reescribe un reporte cerrado anterior al día actual", async () => {
    const db = await getDb(),
      saved = createDailyReport("2026-11-05", [], [], [], [], now);
    await db
      .insert(dailyReports)
      .values({ date: saved.date, data: saved })
      .onConflictDoUpdate({ target: dailyReports.date, set: { data: saved } });
    const row = record("digest-closed-test");
    await db
      .insert(evidenceRecords)
      .values({ id: row.id, data: row })
      .onConflictDoNothing();
    expect(await saveDailyReport("2026-11-05", now)).toEqual(saved);
  });
  it("un contexto marcado útil no infla las cuentas del problema retenido", () => {
    const a = record("pain"),
      b = record("context", { quote: "The CSV export has encoding options." });
    const digest = buildResearchDigest(
      [a, b],
      [
        {
          id: b.id,
          decision: "useful",
          note: "context",
          at: now.toISOString(),
        },
      ],
      now,
    );
    expect(digest.candidates[0].stage).toBe("isolated");
    expect(digest.candidates[0].publicAccounts).toBe(1);
  });
});
