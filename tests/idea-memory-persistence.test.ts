import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import {
  ideaMemory,
  ideaJournal,
  ideaLinks,
  ideaSourceChecks,
  ideaAssessments,
  evidenceRecords,
  evidenceReviews,
  dailyReports,
  savedItems,
} from "@/db/schema";
import {
  importIdeaMemory,
  getIdeaMemory,
  refreshIdeaMemory,
} from "@/features/idea-memory/service";
import { researchBrief } from "@/features/research/brief";
import { saveDailyReport } from "@/features/research/service";
import { eq } from "drizzle-orm";
import { refreshMemorySources } from "@/features/idea-memory/sources";
import type {
  IdeaDefinition,
  IdeaDecision,
} from "@/features/idea-memory/types";
import type { EvidenceRecord } from "@/features/evidence/types";
vi.mock("@/features/idea-memory/sources", async (original) => ({
  ...(await original<typeof import("@/features/idea-memory/sources")>()),
  refreshMemorySources: vi.fn(async () => []),
}));
const now = new Date("2026-11-16T18:00:00Z");
const definition: IdeaDefinition = {
  id: "OP-001",
  title: "Control de consumo",
  hypothesis: "Conciliar tokens por cliente y contrastar alternativas.",
  origin: "review",
  createdAt: "2026-11-01T00:00:00Z",
  match: { groups: [["tokens", "billing"]] },
  sources: [{ url: "https://langfuse.com/pricing", kind: "competitor" }],
};
const decision: IdeaDecision = {
  id: "review-1",
  ideaId: definition.id,
  at: "2026-11-15T00:00:00Z",
  actor: "research-review",
  decision: "pause",
  reason: "La competencia ya cubre el dashboard genérico.",
  references: ["https://langfuse.com/pricing"],
  excludedAuthors: [],
  excludedUrls: [],
};
const evidence: EvidenceRecord = {
  id: "memory-source-a",
  externalId: "43273",
  source: "github",
  sourceName: "GitHub",
  url: "https://github.com/n8n-io/n8n/issues/43273",
  title: "Token billing fails",
  quote:
    "We bill our customers using tokens. Our billing fails because usage is missing, so I manually check invoices for 3 hours each month.",
  language: "en",
  kind: "community",
  authorKey: "github:client",
  product: "n8n-io/n8n",
  occurredAt: "2026-11-14T00:00:00Z",
  capturedAt: "2026-11-15T00:00:00Z",
};
beforeEach(async () => {
  vi.mocked(refreshMemorySources).mockReset().mockResolvedValue([]);
  const db = await getDb();
  for (const table of [
    ideaMemory,
    ideaJournal,
    ideaLinks,
    ideaSourceChecks,
    ideaAssessments,
    evidenceRecords,
    evidenceReviews,
  ])
    await db.delete(table);
});
describe("memoria persistente append-only", () => {
  it("importa revisión privada e idempotente sin sobrescribir definiciones ni decisiones", async () => {
    await importIdeaMemory(
      { definitions: [definition], decisions: [decision] },
      now,
    );
    await importIdeaMemory(
      { definitions: [definition], decisions: [decision] },
      now,
    );
    await expect(
      importIdeaMemory(
        {
          definitions: [{ ...definition, title: "Cambio destructivo" }],
          decisions: [],
        },
        now,
      ),
    ).rejects.toThrow(/conserva/);
    await expect(
      importIdeaMemory(
        {
          definitions: [],
          decisions: [{ ...decision, reason: "Sobrescritura de conclusión" }],
        },
        now,
      ),
    ).rejects.toThrow(/sobrescribe/);
    const data = await getIdeaMemory(now);
    expect(data.definitions).toHaveLength(1);
    expect(data.decisions[0].reason).toBe(decision.reason);
  });
  it("actualiza en background con historial, reintentos idempotentes y reporte/exportación", async () => {
    const db = await getDb();
    await importIdeaMemory(
      { definitions: [definition], decisions: [decision] },
      now,
    );
    await db
      .insert(evidenceRecords)
      .values({ id: evidence.id, data: evidence });
    const oldReports = await db.select().from(dailyReports);
    const oldSaved = await db.select().from(savedItems);
    const first = await refreshIdeaMemory(now);
    const firstSnapshot = JSON.stringify(
      first.assessments.find((a) => a.ideaId === definition.id),
    );
    await refreshIdeaMemory(new Date(now.getTime() + 1000));
    const same = await getIdeaMemory(now);
    expect(same.assessmentCount).toBe(first.assessmentCount);
    const original = first.assessments.find((a) => a.ideaId === definition.id)!;
    expect(original.decision).toBe("pause");
    expect(original.totals.activeCases).toBe(1);
    await db.insert(evidenceRecords).values({
      id: "revised-source",
      data: {
        ...evidence,
        id: "revised-source",
        caseStatus: "closed",
        revision: 2,
        capturedAt: "2026-11-16T19:00:00Z",
      },
    });
    const later = await refreshIdeaMemory(new Date("2026-11-16T19:30:00Z"));
    expect(later.assessmentCount).toBeGreaterThan(first.assessmentCount);
    expect(
      JSON.stringify(
        (
          await db
            .select()
            .from(ideaAssessments)
            .where(eq(ideaAssessments.id, original.id))
        )[0].data,
      ),
    ).toBe(firstSnapshot);
    expect(
      (await db.select().from(evidenceRecords)).some(
        (r) => r.id === evidence.id,
      ),
    ).toBe(true);
    expect(await db.select().from(savedItems)).toEqual(oldSaved);
    expect(await db.select().from(dailyReports)).toEqual(oldReports);
    expect(await researchBrief(7, new Date("2026-11-16T19:30:00Z"))).toContain(
      decision.reason,
    );
    const report = await saveDailyReport(
      "2026-11-16",
      new Date("2026-11-16T19:30:00Z"),
    );
    expect(report.ideaMemory?.assessmentIds.length).toBeGreaterThan(0);
    expect(report.markdown).toContain("Memoria de ideas");
  });
  it("valida fuentes, fechas y referencias antes de escribir", async () => {
    await expect(
      importIdeaMemory(
        {
          definitions: [
            {
              ...definition,
              sources: [
                { url: "https://evil.example/private", kind: "competitor" },
              ],
            },
          ],
          decisions: [],
        },
        now,
      ),
    ).rejects.toThrow();
    await expect(
      importIdeaMemory(
        {
          definitions: [{ ...definition, createdAt: "2027-01-01T00:00:00Z" }],
          decisions: [],
        },
        now,
      ),
    ).rejects.toThrow(/futuras/);
    await expect(
      importIdeaMemory({ definitions: [], decisions: [decision] }, now),
    ).rejects.toThrow(/sin idea/);
    expect((await getIdeaMemory(now)).definitions).toEqual([]);
  });
  it("rechaza IDs repetidos dentro del mismo lote sin aplicar una parte", async () => {
    await expect(
      importIdeaMemory(
        {
          definitions: [
            definition,
            { ...definition, title: "Otra definición" },
          ],
          decisions: [],
        },
        now,
      ),
    ).rejects.toThrow(/duplicado/);
    await expect(
      importIdeaMemory(
        {
          definitions: [definition],
          decisions: [
            decision,
            { ...decision, reason: "Otra conclusión diferente" },
          ],
        },
        now,
      ),
    ).rejects.toThrow(/duplicado/);
    expect((await getIdeaMemory(now)).definitions).toEqual([]);
  });
  it("un corte anterior no incluye contadores de clasificaciones o consultas futuras", async () => {
    const db = await getDb();
    await importIdeaMemory({ definitions: [definition], decisions: [] }, now);
    await db
      .insert(evidenceRecords)
      .values({ id: evidence.id, data: evidence });
    await refreshIdeaMemory(now);
    await db.insert(ideaSourceChecks).values({
      id: "future-check",
      data: {
        id: "future-check",
        url: definition.sources[0].url,
        kind: "competitor",
        checkedAt: "2026-11-17T00:00:00Z",
        status: "ok",
        contentHash: "future",
        message: "future",
      },
    });
    const before = await getIdeaMemory(new Date("2026-11-16T17:00:00Z"));
    expect(before.linkedRevisions).toBe(0);
    expect(before.sourceCheckCount).toBe(0);
    expect(before.assessmentCount).toBe(0);
  });
  it("el mismo mecanismo en dos países no registra dos ideas con matcher idéntico", async () => {
    const db = await getDb();
    for (const country of ["MX", "US"]) {
      const id = `encoding-${country}`;
      await db.insert(evidenceRecords).values({
        id,
        data: {
          ...evidence,
          id,
          externalId: id,
          country,
          authorKey: `github:${id}`,
          title: "CSV export encoding failure",
          quote:
            "I cannot export CSV because accented characters have the wrong encoding every week, so I copy records manually for 3 hours.",
          product: "actualbudget/actual",
          url: `https://github.com/actualbudget/actual/issues/${country === "MX" ? 1 : 2}`,
        },
      });
    }
    const memory = await refreshIdeaMemory(now);
    const keys = memory.definitions.map((d) => d.match.scopeKey);
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("consulta también una incidencia resuelta y aplica su reapertura", async () => {
    const db = await getDb();
    await importIdeaMemory(
      { definitions: [{ ...definition, sources: [] }], decisions: [] },
      now,
    );
    await db.insert(evidenceRecords).values({
      id: evidence.id,
      data: { ...evidence, resolution: "resolved" },
    });
    vi.mocked(refreshMemorySources).mockResolvedValue([
      {
        id: "reopened",
        url: evidence.url,
        kind: "issue",
        checkedAt: now.toISOString(),
        status: "ok",
        issueState: "open",
        stateReason: "reopened",
        message: "Reabierta",
      },
    ]);
    const memory = await refreshIdeaMemory(
      now,
      async () => {},
      vi.fn<typeof fetch>(),
    );
    expect(vi.mocked(refreshMemorySources).mock.calls[0][0]).toContainEqual({
      url: evidence.url,
      kind: "issue",
    });
    expect(
      memory.assessments.find((a) => a.ideaId === definition.id)?.totals
        .activeCases,
    ).toBe(1);
  });
  it("refina criterios mediante una decisión nueva sin modificar la definición original", async () => {
    const db = await getDb();
    await importIdeaMemory({ definitions: [definition], decisions: [] }, now);
    const next = {
      ...decision,
      id: "refine-1",
      decision: "watch" as const,
      reason: "Exigir retiro para no confundir ahorro con guardar archivos.",
      matchOverride: { groups: [["saving", "retirement"]] },
    };
    await importIdeaMemory({ definitions: [], decisions: [next] }, now);
    expect((await getIdeaMemory(now)).definitions[0].match).toEqual(
      next.matchOverride,
    );
    expect((await db.select().from(ideaMemory))[0].data.match).toEqual(
      definition.match,
    );
    expect(
      (await getIdeaMemory(new Date("2026-11-14T18:00:00Z"))).definitions[0]
        .match,
    ).toEqual(definition.match);
  });
  it("pagina el historial sin perder evaluaciones que comparten instante", async () => {
    const db = await getDb();
    await importIdeaMemory({ definitions: [definition], decisions: [] }, now);
    await db
      .insert(evidenceRecords)
      .values({ id: evidence.id, data: evidence });
    const initial = await refreshIdeaMemory(now);
    const sample = initial.assessments.find((a) => a.ideaId === definition.id)!;
    await db.delete(ideaAssessments);
    const mixedIds = [
      ...Array.from(
        { length: 99 },
        (_, index) => `z${String(index).padStart(4, "0")}`,
      ),
      "A_1",
      "A-1",
      "A",
    ];
    const rows = mixedIds.map((id) => {
      return { id, data: { ...sample, id } };
    });
    await db.insert(ideaAssessments).values(rows);
    const first = await getIdeaMemory(now, true);
    expect(first.assessments).toHaveLength(100);
    expect(first.assessmentCount).toBeGreaterThan(100);
    const second = await getIdeaMemory(now, true, first.historyPage!.next!);
    const ids = [...first.assessments, ...second.assessments].map((a) => a.id);
    expect(new Set(ids).size).toBe(first.assessmentCount);
    expect(second.historyPage?.next).toBeUndefined();
  });
});
