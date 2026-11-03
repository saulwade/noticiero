import { describe, it, expect } from "vitest";
import {
  evidenceTimeline,
  timelineMarkdown,
} from "@/features/evidence/timeline";
import {
  buildDossiers,
  timelineAssessment,
  timelineAssessor,
  weeklyReport,
} from "@/features/evidence/engine";
import type { EvidenceRecord } from "@/features/evidence/types";
const now = new Date("2026-11-03T18:00:00Z");
const record = (
  id: string,
  date: string,
  author = "alice",
  extra: Partial<EvidenceRecord> = {},
): EvidenceRecord => ({
  id,
  externalId: id,
  source: "github",
  sourceName: "GitHub",
  url: `https://github.com/x/y/issues/${id}`,
  quote: "Our API returns 401 PGRST303 after sign in.",
  title: "Access issue",
  kind: "community",
  language: "en",
  product: "Example",
  authorKey: `github:${author}`,
  occurredAt: date,
  capturedAt: `${date}T18:00:00Z`,
  ...extra,
});
describe("comparación de casos y capturas", () => {
  it("separa nuevos casos, versiones, autores conocidos y antecedentes", () => {
    const rows = [
      record("old", "2026-10-22"),
      record("old-r2", "2026-11-01", "alice", {
        externalId: "old",
        revision: 2,
      }),
      record("a", "2026-11-02"),
      record("b", "2026-11-02", "bob"),
      record("h", "2026-11-02", "charlie", { occurredAt: "2026-09-01" }),
      record("resolved", "2026-10-23", "zoe"),
      record("resolved-r2", "2026-11-01", "zoe", {
        externalId: "resolved",
        revision: 2,
        resolution: "resolved",
      }),
    ];
    const t = evidenceTimeline(rows, timelineAssessment, now, 7);
    expect(t.from).toBe("2026-10-28");
    expect(t.previousFrom).toBe("2026-10-21");
    expect(t.total).toMatchObject({
      newCases: 3,
      historicalCases: 1,
      publishedCases: 2,
      updatedCases: 2,
      additionalVersions: 2,
      newAuthors: 2,
      returningAuthors: 2,
      resolutionUpdates: 1,
    });
    expect(t.groups[0].previousNewCases).toBe(2);
  });
  it("no cuenta dos autores por varios casos de la misma cuenta", () => {
    const t = evidenceTimeline(
      [record("a", "2026-11-01"), record("b", "2026-11-02")],
      timelineAssessment,
      now,
      7,
    );
    expect(t.total.newCases).toBe(2);
    expect(t.total.newAuthors).toBe(1);
  });
  it("no presenta estadísticas ni recapturas como nuevos clientes", () => {
    const old = record("a", "2026-10-01");
    const t = evidenceTimeline(
      [
        old,
        { ...old, id: "r2", revision: 2, capturedAt: "2026-11-02T18:00:00Z" },
        record("stat", "2026-11-02", "nobody", {
          kind: "statistic",
          authorKey: undefined,
        }),
      ],
      timelineAssessment,
      now,
      7,
    );
    expect(t.statisticsCaptured).toBe(1);
    expect(t.total.newCases).toBe(0);
    expect(t.total.newAuthors).toBe(0);
    expect(t.groups[0].trend).toBe("case-updates");
  });
  it("la fecha original impide llamar demanda reciente a antecedentes", () => {
    const t = evidenceTimeline(
      [record("a", "2026-11-01", "alice", { occurredAt: "2026-02-01" })],
      timelineAssessment,
      now,
      7,
    );
    expect(t.groups[0].trend).toBe("historical-context");
    expect(t.comparisonLimited).toBe(true);
    expect(timelineMarkdown(t).join("\n")).toContain(
      "No puede inferirse una tendencia de mercado",
    );
  });
  it("muestra falta de evidencia nueva sin afirmar que desapareció la necesidad", () => {
    const t = evidenceTimeline(
      [record("a", "2026-10-22")],
      timelineAssessment,
      now,
      7,
    );
    expect(t.groups[0].trend).toBe("no-new-evidence");
    expect(timelineMarkdown(t).join("\n")).toContain(
      "no prueba que desapareciera",
    );
  });
  it("no inventa un autor nuevo cuando sólo se reclasifica un caso", () => {
    const old = record("a", "2026-10-22", "alice", {
      quote: "Our SQL editor fails with PAM authentication.",
    });
    const t = evidenceTimeline(
      [
        old,
        record("a2", "2026-11-01", "alice", { externalId: "a", revision: 2 }),
      ],
      timelineAssessment,
      now,
      7,
    );
    expect(t.total.newCases).toBe(0);
    expect(t.total.newAuthors).toBe(0);
    expect(
      t.groups.find((g) => g.key.includes("pam-authentication"))
        ?.previousNewCases,
    ).toBe(1);
    expect(
      t.groups.find((g) => g.key.includes("jwt-validation"))?.previousNewCases,
    ).toBe(0);
  });
  it("rechaza futuro y formatos inválidos sin contaminar ventanas", () => {
    const t = evidenceTimeline(
      [
        record("bad", "2030-01-01"),
        record("nan", "2026-11-01", "a", { capturedAt: "bad" }),
        record("calendar", "2026-11-01", "b", { occurredAt: "2026-02-30" }),
        record("future-today", "2026-11-03", "c", {
          occurredAt: "2026-11-03T23:00:00Z",
        }),
      ],
      timelineAssessment,
      now,
      7,
    );
    expect(t.total.newCases).toBe(0);
    expect(() => evidenceTimeline([], timelineAssessment, now, 8)).toThrow();
  });
  it("dos recursos del mismo organismo no crean fuentes independientes ni casos duplicados", () => {
    const a = record("p1", "2026-11-01", "a", {
      externalId: "same-official-case",
      source: "profeco",
      kind: "complaint",
      authorKey: undefined,
      issue: "Negativa a cambio o devolución",
      quote: "Negativa a cambio o devolución. Giro: Tienda.",
    });
    const b = {
      ...a,
      id: "p2",
      source: "profeco-telecom" as const,
      capturedAt: "2026-11-02T18:00:00Z",
    };
    const dossiers = buildDossiers([a, b], [], now);
    expect(dossiers).toHaveLength(1);
    expect(dossiers[0].anonymousCases).toBe(1);
    expect(dossiers[0].sourceFamilies).toEqual(["profeco"]);
    expect(
      evidenceTimeline([a, b], timelineAssessment, now, 7).total,
    ).toMatchObject({ newCases: 1, additionalVersions: 1 });
  });
  it("el reporte automático incorpora las tres ventanas sin prometer crecimiento", () => {
    const report = weeklyReport([record("a", "2026-11-01")], [], now);
    expect(report.comparisons?.map((t) => t.days)).toEqual([7, 30, 90]);
    expect(report.markdown).toContain("versiones adicionales");
  });
  it("respeta revisiones sin aplicar decisiones de una fecha futura", () => {
    const row = record("a", "2026-11-01");
    const rejected = {
      id: "a",
      decision: "rejected" as const,
      note: "No es el segmento",
      at: now.toISOString(),
    };
    expect(
      evidenceTimeline([row], timelineAssessor([rejected], now), now, 7).total
        .newCases,
    ).toBe(0);
    expect(
      evidenceTimeline(
        [row],
        timelineAssessor([{ ...rejected, at: "2030-01-01T18:00:00Z" }], now),
        now,
        7,
      ).total.newCases,
    ).toBe(1);
  });
});
