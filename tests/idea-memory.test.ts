import { describe, expect, it } from "vitest";
import {
  classifyIdeaEvidence,
  canonicalSourceUrl,
  classifyStoryContext,
  linkIdeaEvidence,
} from "@/features/idea-memory/quality";
import { makeStory } from "@/features/news/normalize";
import { assessIdea } from "@/features/idea-memory/engine";
import type {
  IdeaDefinition,
  IdeaDecision,
  IdeaSourceCheck,
} from "@/features/idea-memory/types";
import type { EvidenceRecord } from "@/features/evidence/types";

const now = new Date("2026-11-16T18:00:00Z");
export const idea: IdeaDefinition = {
  id: "OP-001",
  title: "Costos de automatizaciones",
  hypothesis: "Conciliar consumo por cliente",
  origin: "review",
  createdAt: "2026-11-01T00:00:00Z",
  match: {
    groups: [
      ["token", "billing"],
      ["tokens", "customers"],
    ],
  },
  sources: [],
};
function record(id = "a", patch: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id,
    externalId: id,
    source: "github",
    sourceName: "GitHub",
    url: `https://github.com/n8n-io/n8n/issues/${id}`,
    title: "Token billing fails",
    quote:
      "We bill our customers using tokens. The token billing fails and we lost 3 hours every month manually checking invoices.",
    occurredAt: "2026-11-14T12:00:00Z",
    capturedAt: "2026-11-15T12:00:00Z",
    language: "en",
    kind: "community",
    authorKey: `github:${id}`,
    product: "n8n-io/n8n",
    ...patch,
  };
}
const classify = (r: EvidenceRecord, decisions: IdeaDecision[] = []) =>
  classifyIdeaEvidence(idea, r, [], decisions, now)!;
describe("memoria de ideas y evidencia independiente", () => {
  it("cuenta un caso, no las revisiones ni el segundo colector; conserva los vínculos", () => {
    const a = record("a"),
      revised = record("a2", {
        externalId: "a",
        capturedAt: "2026-11-16T12:00:00Z",
        revision: 2,
      });
    const cross = record("a3", {
      externalId: "a",
      source: "github-mx",
      capturedAt: "2026-11-16T13:00:00Z",
    });
    const report = assessIdea(
      idea,
      [a, revised, cross].map((r) => classify(r)),
      [],
      [],
      now,
    );
    expect(report.totals.cases).toBe(1);
    expect(report.totals.revisions).toBe(3);
    expect(report.totals.publicAccounts).toBe(1);
    expect(report.weekly.revisions).toBe(2);
  });
  it("nuevas capturas históricas no son nueva demanda ni cuentas nuevas actuales", () => {
    const r = classify(record("old", { occurredAt: "2026-09-01T12:00:00Z" }));
    const result = assessIdea(idea, [r], [], [], now);
    expect(result.totals.historical).toBe(1);
    expect(result.weekly.currentCases).toBe(0);
    expect(result.weekly.newAccounts).toBe(0);
    expect(result.weekly.historicalImports).toBe(1);
  });
  it("mismo autor con tres casos no equivale a tres clientes", () => {
    const result = assessIdea(
      idea,
      ["1", "2", "3"].map((id) =>
        classify(record(id, { authorKey: "github:one" })),
      ),
      [],
      [],
      now,
    );
    expect(result.totals.cases).toBe(3);
    expect(result.totals.publicAccounts).toBe(1);
  });
  it("promoción, estadística y revisión humana no suman demanda", () => {
    const promo = classify(
      record("p", {
        quote:
          "I built our token billing tool because checking costs manually takes hours. Try it at https://example.com",
      }),
    );
    const stat = classify(record("s", { kind: "statistic" }));
    const rejected = classifyIdeaEvidence(
      idea,
      record("r"),
      [{ id: "r", decision: "rejected", note: "", at: "2026-11-15T00:00:00Z" }],
      [],
      now,
    )!;
    expect([promo.quality, stat.quality, rejected.quality]).toEqual([
      "promotion",
      "statistic",
      "rejected",
    ]);
    expect(
      assessIdea(idea, [promo, stat, rejected], [], [], now).totals.activeCases,
    ).toBe(0);
  });
  it("filtra capturas y publicaciones futuras antes de contar", () => {
    expect(
      classifyIdeaEvidence(
        idea,
        record("future", { capturedAt: "2026-11-17T00:00:00Z" }),
        [],
        [],
        now,
      ),
    ).toBeUndefined();
    expect(
      classifyIdeaEvidence(
        idea,
        record("future", { occurredAt: "2026-11-17T00:00:00Z" }),
        [],
        [],
        now,
      ),
    ).toBeUndefined();
  });
  it("un cierre sin motivo no es resolución; completed es corrección reportada", () => {
    const r = classify(record("a", { caseStatus: "closed" }));
    const check: IdeaSourceCheck = {
      id: "c",
      url: r.url,
      kind: "issue",
      checkedAt: "2026-11-16T15:00:00Z",
      status: "ok",
      issueState: "closed",
      stateReason: "not_planned",
      message: "Cerrado",
    };
    expect(
      assessIdea(idea, [r], [check], [], now).totals.closedUnverified,
    ).toBe(1);
    const done = { ...check, id: "done", stateReason: "completed" as const };
    const result = assessIdea(idea, [r], [done], [], now);
    expect(result.totals.resolved).toBe(1);
    expect(result.totals.activeCases).toBe(0);
    expect(result.gaps.join(" ")).toMatch(/versión|instalacion/i);
  });
  it("una decisión restrictiva persiste ante volumen y registra contradicciones", () => {
    const decision: IdeaDecision = {
      id: "d",
      ideaId: idea.id,
      at: "2026-11-15T00:00:00Z",
      actor: "research-review",
      decision: "pause",
      reason: "Alternativas cubren el dashboard",
      references: ["https://langfuse.com"],
      excludedAuthors: [],
      excludedUrls: [],
    };
    const report = assessIdea(idea, [classify(record())], [], [decision], now);
    expect(report.decision).toBe("pause");
    expect(report.rationale.join(" ")).toContain(decision.reason);
    expect(report.journalIds).toEqual(["d"]);
  });
  it("registra competencia cambiada o pendiente sin inventar nuevas funciones", () => {
    const def = {
      ...idea,
      sources: [
        { url: "https://langfuse.com/pricing", kind: "competitor" as const },
      ],
    };
    const first: IdeaSourceCheck = {
      id: "f",
      url: def.sources[0].url,
      kind: "competitor",
      checkedAt: "2026-11-15T00:00:00Z",
      status: "ok",
      contentHash: "a",
      message: "Documento consultado",
    };
    const second = {
      ...first,
      id: "s",
      checkedAt: "2026-11-16T12:00:00Z",
      contentHash: "b",
    };
    expect(assessIdea(def, [], [], [], now).sources[0].status).toBe("pending");
    const result = assessIdea(def, [], [first, second], [], now);
    expect(result.sources[0].status).toBe("changed");
    expect(result.gaps.join(" ")).toMatch(/competencia/i);
  });
  it("URLs traducidas o con tracking conservan la misma identidad", () => {
    expect(
      canonicalSourceUrl(
        "https://community.n8n.io/t/example/123?tl=es&utm_source=x#foo",
      ),
    ).toBe("https://community.n8n.io/t/example/123");
  });
  it("reclamaciones distintas no se fusionan por compartir la URL de un dataset", () => {
    const a = classify(
      record("case-1", {
        source: "profeco",
        kind: "complaint",
        authorKey: undefined,
        url: "https://datos.gob.mx/dataset/cases",
      }),
    );
    const b = classify(
      record("case-2", {
        source: "profeco",
        kind: "complaint",
        authorKey: undefined,
        url: a.url,
      }),
    );
    const result = assessIdea(idea, [a, b], [], [], now);
    expect(result.totals.cases).toBe(2);
    expect(result.totals.anonymousCases).toBe(2);
  });
  it("ninguna evaluación declara organizaciones verificadas ni voluntad de compra", () => {
    const result = assessIdea(idea, [classify(record())], [], [], now);
    expect(result.decision).toBe("watch");
    expect(result.gaps.join(" ")).toMatch(/pagar/i);
    expect(result.totals.buyerStatements).toBe(1);
  });
  it("una reapertura no queda resuelta por una captura antigua", () => {
    const link = classify(record("a", { resolution: "resolved" }));
    const check: IdeaSourceCheck = {
      id: "reopen",
      url: link.url,
      kind: "issue",
      checkedAt: "2026-11-16T15:00:00Z",
      status: "ok",
      issueState: "open",
      stateReason: "reopened",
      message: "Reabierto",
    };
    const result = assessIdea(idea, [link], [check], [], now);
    expect(result.totals.resolved).toBe(0);
    expect(result.totals.activeCases).toBe(1);
  });
  it("un autor conocido por un caso resuelto no es una cuenta nueva", () => {
    const old = classify(
      record("old", {
        authorKey: "github:known",
        occurredAt: "2026-10-01T00:00:00Z",
        capturedAt: "2026-10-02T00:00:00Z",
        resolution: "resolved",
      }),
    );
    const fresh = classify(record("new", { authorKey: "github:known" }));
    expect(assessIdea(idea, [old, fresh], [], [], now).weekly.newAccounts).toBe(
      0,
    );
  });
  it("un fallo de consulta conserva una resolución pública anterior", () => {
    const link = classify(record("43273"));
    const ok: IdeaSourceCheck = {
      id: "ok",
      url: link.url,
      kind: "issue",
      checkedAt: "2026-11-15T12:00:00Z",
      status: "ok",
      issueState: "closed",
      stateReason: "completed",
      message: "completado",
    };
    const error = {
      ...ok,
      id: "error",
      checkedAt: "2026-11-16T12:00:00Z",
      status: "error" as const,
      issueState: undefined,
      stateReason: undefined,
    };
    const result = assessIdea(idea, [link], [ok, error], [], now);
    expect(result.totals.resolved).toBe(1);
    expect(result.totals.activeCases).toBe(0);
    expect(result.sources[0].status).toBe("error");
  });
  it("una comprobación antigua no revoca una captura posterior reabierta o resuelta", () => {
    const link = classify(
      record("43273", { capturedAt: "2026-11-16T16:00:00Z" }),
    );
    const old: IdeaSourceCheck = {
      id: "old",
      url: link.url,
      kind: "issue",
      checkedAt: "2026-11-15T12:00:00Z",
      status: "ok",
      issueState: "closed",
      stateReason: "completed",
      message: "completado",
    };
    expect(assessIdea(idea, [link], [old], [], now).totals.activeCases).toBe(1);
    const resolved = { ...link, quality: "resolved" as const };
    expect(
      assessIdea(
        idea,
        [resolved],
        [{ ...old, issueState: "open", stateReason: "reopened" }],
        [],
        now,
      ).totals.resolved,
    ).toBe(1);
  });
  it("enlaza noticias sin convertirlas en testimonios ni compradores", () => {
    const story = makeStory({
      title: "Token billing changes",
      excerpt: "Providers update token billing for enterprise customers.",
      sourceId: "techcrunch",
      sourceName: "TechCrunch",
      url: "https://example.com/token-billing",
      publishedAt: "2026-11-15T12:00:00Z",
    })!;
    const link = classifyStoryContext(
      idea,
      { ...story, detectedAt: "2026-11-15T12:00:00Z" },
      now,
    )!;
    expect(link.quality).toBe("context");
    expect(link.kind).toBe("news");
    const result = assessIdea(idea, [link], [], [], now);
    expect(result.totals.activeCases).toBe(0);
    expect(result.totals.context).toBe(1);
  });
  it("una revisión resuelta que ya no coincide reemplaza la demanda anterior", () => {
    const old = record("43273");
    const fixed = {
      ...old,
      id: "fixed-new",
      revision: 2,
      title: "Problem fixed",
      quote: "This is fixed. Everything works now.",
      caseStatus: "closed" as const,
      capturedAt: "2026-11-16T12:00:00Z",
    };
    const links = linkIdeaEvidence(idea, [old, fixed], [], [], now);
    expect(links).toHaveLength(2);
    const result = assessIdea(idea, links, [], [], now);
    expect(result.totals.activeCases).toBe(0);
    expect(result.totals.resolved).toBe(1);
    expect(links.some((l) => l.recordId === old.id)).toBe(true);
    const earlier = new Date("2026-11-15T18:00:00Z");
    expect(
      assessIdea(
        idea,
        linkIdeaEvidence(idea, [old, fixed], [], [], earlier),
        [],
        [],
        earlier,
      ).totals.activeCases,
    ).toBe(1);
  });
  it("un cambio de tema en la misma incidencia no mantiene el problema antiguo", () => {
    const old = record("43273");
    const newer = {
      ...old,
      id: "new-topic",
      revision: 2,
      title: "Different issue",
      quote: "I cannot upload a photo.",
      capturedAt: "2026-11-16T12:00:00Z",
    };
    const result = assessIdea(
      idea,
      linkIdeaEvidence(idea, [old, newer], [], [], now),
      [],
      [],
      now,
    );
    expect(result.totals.activeCases).toBe(0);
    expect(result.totals.context).toBe(1);
  });
});
