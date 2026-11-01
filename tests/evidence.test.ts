import { beforeEach, describe, it, expect } from "vitest";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import {
  buildDossiers,
  problemContext,
  weeklyReport,
} from "@/features/evidence/engine";
import {
  storeEvidence,
  getEvidenceData,
  evidenceAction,
  persistWeeklyReport,
  boundedEvidenceView,
} from "@/features/evidence/service";
import { validateSnapshot, backupColumns } from "@/features/backups/format";
import type { EvidenceRecord } from "@/features/evidence/types";
const now = new Date("2026-10-31T18:00:00Z");
const record = (
  id: string,
  extra: Partial<EvidenceRecord> = {},
): EvidenceRecord => ({
  id,
  externalId: id,
  source: "hn",
  sourceName: "Ask HN",
  url: `https://news.ycombinator.com/item?id=${id}`,
  title: "Account issue",
  quote:
    "I can't access my account every week and manually export records for 3 hours.",
  occurredAt: "2026-10-30T15:00:00Z",
  capturedAt: now.toISOString(),
  language: "en",
  kind: "community",
  authorKey: `hn:${id}`,
  product: "Example app",
  ...extra,
});
beforeEach(async () => {
  const db = await getDb();
  for (const table of [
    schema.evidenceRecords,
    schema.evidenceReviews,
    schema.evidenceConnectors,
    schema.evidenceReports,
    schema.validationProjects,
    schema.interviews,
  ])
    await db.delete(table);
});
describe("evidencia contextual y persistencia", () => {
  it("mide bytes UTF-8 y conserva referencias al recortar una vista multilingüe grande", () => {
    const records = Array.from({ length: 240 }, (_, i) =>
      record(`utf-${i}`, {
        product: `Product ${i % 30}`,
        quote: `I cannot access my account every week. ${"界".repeat(3000)}`,
      }),
    );
    const dossiers = buildDossiers(records, [], now);
    const data = {
      records,
      dossiers,
      reviews: [],
      sources: [],
      reports: Array.from({ length: 4 }, (_, i) => ({
        id: `report-${i}`,
        from: "2026-10-26",
        to: "2026-10-31",
        provisional: false,
        generatedAt: now.toISOString(),
        markdown: "界".repeat(60000),
      })),
      totalRecords: 240,
      storageLimited: false,
    };
    const view = boundedEvidenceView(data);
    expect(Buffer.byteLength(JSON.stringify(view))).toBeLessThanOrEqual(
      1_500_000,
    );
    expect(
      view.dossiers
        .flatMap((d) => d.evidenceIds)
        .every((id) => view.records.some((r) => r.id === id)),
    ).toBe(true);
    expect(data.records).toHaveLength(240);
  });
  it("usa solo la última revisión de un caso aunque cambie de problema, y no revive la anterior al rechazarla", () => {
    const old = record("old", { externalId: "same", revision: 1 });
    const current = record("new", {
      externalId: "same",
      revision: 2,
      quote: "I cannot pay the invoice: our billing payment fails.",
    });
    expect(buildDossiers([old, current], [], now)).toHaveLength(1);
    expect(
      buildDossiers(
        [old, current],
        [{ id: "new", decision: "rejected", note: "", at: now.toISOString() }],
        now,
      ),
    ).toHaveLength(0);
    const separate = record("consumer", { segment: "consumer" });
    const business = record("business", { segment: "business" });
    expect(buildDossiers([separate, business], [], now)).toHaveLength(2);
  });
  it("registra una resolución sin exigir otra queja y sin contarla como demanda", () => {
    const d = buildDossiers(
      [record("a"), record("b", { quote: "Account access works now." })],
      [],
      now,
    )[0];
    expect(d.contradictions).toHaveLength(1);
    expect(d.identifiedAuthors).toBe(1);
  });
  it("cada campo extraído cita el texto y nunca deduce país por idioma", () => {
    const r = record("a", {
      language: "es",
      quote: "No puedo entrar a mi cuenta cada semana y pierdo 3 horas.",
    });
    const context = problemContext(r);
    expect(context.accepted).toBe(true);
    for (const field of Object.values(context.fields))
      if (field) expect(r.quote).toContain(field.quote);
    const d = buildDossiers([r], [], now)[0];
    expect(d.countries).toEqual([]);
    expect(d.mexicoHypothesis).toContain("Comprobar");
  });
  it("distingue cuentas, reclamaciones e indicadores sin duplicar casos editados", () => {
    const rs = [
      record("a"),
      record("b", { externalId: "a" }),
      record("c", { authorKey: "hn:a" }),
      record("d", {
        kind: "statistic",
        quote: "10,000 account complaints",
        authorKey: undefined,
      }),
      record("e", {
        kind: "complaint",
        source: "cfpb",
        authorKey: undefined,
        country: "US",
        countryBasis: "CFPB jurisdiction",
      }),
    ];
    const groups = buildDossiers(rs, [], now);
    const d = groups.find((d) => !d.countries.length)!;
    expect(d.identifiedAuthors).toBe(2);
    expect(d.anonymousCases).toBe(0);
    expect(d.evidenceIds).toHaveLength(2);
    expect(d.countries).not.toContain("MX");
    expect(groups.find((d) => d.countries.includes("US"))?.anonymousCases).toBe(
      1,
    );
  });
  it("mantiene segmentos/productos separados y guarda soluciones como contradicción", () => {
    const rs = [
      record("a"),
      record("b", { product: "Another app" }),
      record("c", { quote: "The account access bug is fixed and works now." }),
    ];
    const ds = buildDossiers(rs, [], now);
    expect(ds).toHaveLength(2);
    expect(
      ds.find((d) => d.evidenceIds.includes("a"))?.contradictions,
    ).toHaveLength(1);
  });
  it("rechaza ruido y permite la evaluación humana explícita", () => {
    const r = record("a", {
      quote: "I agree with commenters: the LLM writing is painful to read.",
    });
    expect(buildDossiers([r], [], now)).toHaveLength(0);
    expect(
      buildDossiers(
        [r],
        [
          {
            id: r.id,
            decision: "useful",
            note: "Investigar",
            at: now.toISOString(),
          },
        ],
        now,
      ),
    ).toHaveLength(1);
    expect(
      buildDossiers(
        [record("b")],
        [{ id: "b", decision: "duplicate", note: "", at: now.toISOString() }],
        now,
      ),
    ).toHaveLength(0);
  });
  it("una importación histórica no inventa crecimiento de problemas actuales", () => {
    const d = buildDossiers(
      [record("a", { occurredAt: "2025-01-01T12:00:00Z", historical: true })],
      [],
      now,
    )[0];
    expect(d.activity[0].publishedCases).toBe(0);
    expect(d.activity[0].capturedCases).toBe(1);
    expect(
      weeklyReport(
        [record("a", { occurredAt: "2025-01-01T12:00:00Z" })],
        [],
        now,
      ).markdown,
    ).toContain("1 son antecedentes");
  });
  it("conserva el lunes de una fecha administrativa sin desplazarlo por zona horaria", () => {
    const r = record("dated", { occurredAt: "2026-10-26" });
    expect(weeklyReport([r], [], now).markdown).toContain("0 son antecedentes");
  });
  it("conserva reversiones y correcciones de metadatos como versiones nuevas", async () => {
    const first = record("versioned");
    await storeEvidence([first]);
    await storeEvidence([
      { ...first, quote: "I cannot pay our billing invoice." },
    ]);
    await storeEvidence([first]);
    await storeEvidence([
      { ...first, country: "MX", countryBasis: "Declarado en fuente" },
    ]);
    const data = await getEvidenceData(now, true);
    expect(data.records).toHaveLength(4);
    expect(data.dossiers).toHaveLength(1);
    expect(data.dossiers[0].countries).toEqual(["MX"]);
    const latest = data.records.find((r) => r.revision === 4)!;
    await evidenceAction({
      action: "review",
      id: latest.id,
      decision: "rejected",
      note: "Descartar caso actual",
    });
    expect((await getEvidenceData(now)).dossiers).toHaveLength(0);
  });
  it("acota la vista sin borrar los registros completos del archivo", async () => {
    const db = await getDb();
    const records = Array.from({ length: 1300 }, (_, i) =>
      record(`bound-${i}`, {
        quote: `I cannot access my account. ${"Public context ".repeat(250)}`,
      }),
    );
    await db
      .insert(schema.evidenceRecords)
      .values(records.map((data) => ({ id: data.id, data })));
    const view = await getEvidenceData(now);
    expect(view.totalRecords).toBe(1300);
    expect(view.records.length).toBeLessThanOrEqual(240);
    expect(Buffer.byteLength(JSON.stringify(view))).toBeLessThan(2_000_000);
    expect((await getEvidenceData(now, true)).records).toHaveLength(1300);
  });
  it("guarda automáticamente versiones y evaluaciones, y no duplica entrevistas", async () => {
    await storeEvidence([record("a")]);
    await storeEvidence([record("a")]);
    expect((await getEvidenceData(now)).records).toHaveLength(1);
    await storeEvidence([
      record("a", {
        quote: "I can't access my account and the export is broken.",
      }),
    ]);
    let data = await getEvidenceData(now);
    expect(data.records).toHaveLength(2);
    expect(data.dossiers[0].identifiedAuthors).toBe(1);
    const dossier = data.dossiers[0];
    const first = await evidenceAction({
      action: "project",
      dossierId: dossier.id,
    });
    const second = await evidenceAction({
      action: "project",
      dossierId: dossier.id,
    });
    expect(first).toEqual(second);
    const db = await getDb();
    expect(await db.select().from(schema.validationProjects)).toHaveLength(1);
    await evidenceAction({
      action: "review",
      id: data.records[0].id,
      decision: "rejected",
      note: "No describe nuestro segmento",
    });
    data = await getEvidenceData(now);
    expect(data.reviews[0].note).toContain("segmento");
    expect(data.records).toHaveLength(2);
  });
  it("cierra reportes semanales anteriores sin reescribir evidencia histórica", async () => {
    await storeEvidence([record("a")]);
    const one = await persistWeeklyReport(now);
    await persistWeeklyReport(new Date("2026-11-09T18:00:00Z"));
    const data = await getEvidenceData();
    const closed = data.reports.find((r) => r.id === one.id)!;
    expect(closed.provisional).toBe(false);
    expect(closed.markdown).toBe(one.markdown);
    expect(data.reports).toHaveLength(2);
  });
  it("no reescribe un cierre semanal al importar después del cierre dominical", async () => {
    await storeEvidence([record("a")]);
    const closed = await persistWeeklyReport(new Date("2026-11-02T03:00:00Z"));
    expect(closed.provisional).toBe(false);
    await storeEvidence([record("b")]);
    const again = await persistWeeklyReport(new Date("2026-11-02T04:00:00Z"));
    expect(again).toEqual(closed);
  });
  it("acepta respaldos anteriores completos y rechaza omisiones parciales del nuevo esquema", () => {
    const legacy = {
      version: 1,
      createdAt: now.toISOString(),
      tables: Object.keys(backupColumns)
        .filter((n) => !n.startsWith("evidence_") && !n.startsWith("finance_"))
        .map((name) => ({ name, rows: [] })),
    };
    expect(validateSnapshot(legacy).tables).toHaveLength(22);
    const bad = {
      ...legacy,
      tables: [...legacy.tables, { name: "evidence_records", rows: [] }],
    };
    expect(() => validateSnapshot(bad)).toThrow();
  });
});
