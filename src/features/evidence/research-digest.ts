import { buildDossiers, problemContext } from "./engine";
import { latestEvidenceVersions, evidenceFamily } from "./versions";
import { isSpecificScope } from "@/features/research/problem-scope";
import type { EvidenceRecord, EvidenceReview } from "./types";
import { MEXICO_EVIDENCE_REPOSITORIES } from "./connectors";
import {
  buildConsumerDigest,
  consumerDigestMarkdown,
  type ConsumerDigest,
} from "./consumer-digest";

export type ResearchCandidate = {
  id: string;
  problem: string;
  product: string;
  countries: string[];
  marketContext?: "MX-fiscal";
  publicAccounts: number;
  anonymousCases: number;
  sourceFamilies: number;
  stage: "repeated" | "isolated" | "historical";
  latestOriginalDate: string;
  recentCases: number;
  hypothesis: string;
  gaps: string[];
  evidence: {
    url: string;
    quote: string;
    occurredAt: string;
    source: string;
  }[];
};
export type ResearchDigest = {
  version: "research-digest-v1";
  asOf: string;
  cases: number;
  statistics: number;
  candidates: ResearchCandidate[];
  limits: string;
  consumer?: ConsumerDigest;
};

/** Pure, bounded current interpretation. Never writes ideas, reviews or source rows. */
export function buildResearchDigest(
  records: EvidenceRecord[],
  reviews: EvidenceReview[],
  asOf: Date,
): ResearchDigest {
  const cutoff = asOf.getTime();
  const eligible = records.filter(
    (r) =>
      r.source !== "app-store" &&
      Number.isFinite(Date.parse(r.occurredAt)) &&
      Date.parse(r.capturedAt) <= cutoff &&
      Date.parse(r.occurredAt) <= cutoff,
  );
  const latest = latestEvidenceVersions(eligible);
  const byId = new Map(latest.map((r) => [r.id, r]));
  const candidates = buildDossiers(eligible, reviews, asOf)
    .flatMap((d) => {
      if (!d.scope || !isSpecificScope(d.scope)) return [];
      const active = d.evidenceIds.flatMap((id) => {
        const r = byId.get(id);
        return r &&
          r.kind !== "statistic" &&
          problemContext(r).accepted &&
          problemContext(r).fields.obstacle &&
          !problemContext(r).correction
          ? [r]
          : [];
      });
      if (!active.length) return [];
      const contexts = active.map(problemContext);
      if (!contexts.some((c) => c.fields.obstacle)) return [];
      const recent = active.filter(
        (r) => Date.parse(r.occurredAt) >= cutoff - 30 * 86400000,
      );
      const publicAccounts = new Set(
        active.flatMap((r) => (r.authorKey ? [r.authorKey] : [])),
      ).size;
      const anonymousCases = active.filter(
        (r) => !r.authorKey && r.kind === "complaint",
      ).length;
      const families = new Set(active.map((r) => evidenceFamily(r.source)));
      const countries = [
        ...new Set(active.flatMap((r) => (r.country ? [r.country] : []))),
      ];
      const voices = publicAccounts + anonymousCases;
      const mexicoFiscal = active.some(
        (r) =>
          r.product &&
          (MEXICO_EVIDENCE_REPOSITORIES as readonly string[]).includes(
            r.product,
          ),
      );
      const historical = !recent.length;
      // Single concrete obstacles are a watch list, not newly validated hypotheses.
      if (
        voices < 2 &&
        !contexts.some(
          (c) =>
            c.fields.frequency || c.fields.consequence || c.fields.workaround,
        ) &&
        !d.scope.mechanism
      )
        return [];
      const fields = (name: keyof typeof d.fields) =>
        contexts.some((c) => c.fields[name]);
      const gaps = [
        ...(voices < 2
          ? ["Encontrar otro caso independiente de la misma causa."]
          : []),
        ...(historical
          ? [
              "Comprobar vigencia: los casos son antecedentes de más de 30 días.",
            ]
          : []),
        ...(!countries.includes("MX")
          ? [
              "Comprobar el problema en un segmento de México; no se infiere país por idioma o repositorio.",
            ]
          : []),
        ...(families.size < 2
          ? ["Contrastar con otra familia de fuentes."]
          : []),
        ...(!fields("consequence")
          ? ["Medir el costo en tiempo o dinero."]
          : []),
        ...(active.some((r) => r.caseStatus === "closed")
          ? [
              "Comprobar vigencia del issue cerrado; cerrar no demuestra resolución ni demanda actual.",
            ]
          : []),
        "Identificar comprador y comprobar disposición a pagar.",
      ];
      const seen = new Set<string>();
      const evidence = active
        .filter((r) => {
          const key = r.authorKey ?? `${r.source}:${r.externalId}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 3)
        .map((r) => ({
          url: r.url,
          quote: r.quote.slice(0, 600),
          occurredAt: r.occurredAt,
          source: r.sourceName,
        }));
      const candidate: ResearchCandidate = {
        id: d.id,
        problem: d.label,
        product: d.alternatives.join(" · ") || "Producto por confirmar",
        countries,
        ...(mexicoFiscal ? { marketContext: "MX-fiscal" as const } : {}),
        publicAccounts,
        anonymousCases,
        sourceFamilies: families.size,
        stage: historical
          ? "historical"
          : voices >= 2
            ? "repeated"
            : "isolated",
        latestOriginalDate: active
          .map((r) => r.occurredAt)
          .sort()
          .at(-1)!,
        recentCases: recent.length,
        hypothesis: `Explorar una solución acotada para ${d.label.toLowerCase()}; el cliente y la solución siguen por comprobar.`,
        gaps,
        evidence,
      };
      const score =
        (countries.includes("MX") ? 10 : 0) +
        (mexicoFiscal ? 6 : 0) +
        (historical ? 0 : 8) +
        (publicAccounts ? 4 : 0) +
        (fields("consequence") ? 2 : 0) +
        Math.min(voices, 5);
      return [{ candidate, score }];
    })
    .sort(
      (a, b) =>
        b.score - a.score || a.candidate.id.localeCompare(b.candidate.id),
    );
  // Separate quotas prevent historical volume or one anonymous feed monopolizing the digest.
  const selected = [
    ...candidates.filter((c) => c.candidate.stage === "repeated").slice(0, 5),
    ...candidates.filter((c) => c.candidate.stage === "isolated").slice(0, 3),
    ...candidates.filter((c) => c.candidate.stage === "historical").slice(0, 3),
  ].map((c) => c.candidate);
  return {
    version: "research-digest-v1",
    asOf: asOf.toISOString(),
    cases: latest.filter((r) => r.kind !== "statistic").length,
    statistics: latest.filter((r) => r.kind === "statistic").length,
    candidates: selected,
    consumer: buildConsumerDigest(records, reviews, asOf),
    limits:
      "Muestra parcial de fuentes públicas. Las cuentas no son personas verificadas, las capturas no miden crecimiento del mercado y ninguna línea demuestra demanda o disposición a pagar.",
  };
}

export function researchDigestMarkdown(digest: ResearchDigest) {
  const clean = (s: string) => s.replace(/[\r\n<>]/g, " ");
  const label = {
    repeated: "Problema repetido",
    isolated: "Pista aislada",
    historical: "Antecedente histórico",
  };
  return [
    ...(digest.consumer ? consumerDigestMarkdown(digest.consumer) : []),
    "## Investigación automática del Radar",
    "",
    `${digest.cases} casos distintos y ${digest.statistics} grupos estadísticos disponibles al corte; las estadísticas no cuentan como personas.`,
    "",
    ...digest.candidates.flatMap((c) => [
      `### ${label[c.stage]} · ${clean(c.problem)}`,
      `${clean(c.product)} · ${c.publicAccounts} cuentas públicas · ${c.anonymousCases} reclamaciones sin identidad pública · ${c.sourceFamilies} familias de fuentes.`,
      ...(c.marketContext
        ? [
            "Contexto técnico fiscal de México; no verifica ubicación del autor ni demanda comercial local.",
          ]
        : []),
      `Fecha original más reciente: ${c.latestOriginalDate}. Casos publicados en los últimos 30 días: ${c.recentCases}.`,
      clean(c.hypothesis),
      ...c.evidence.flatMap((e) => [
        `> ${clean(e.quote)}`,
        `[${clean(e.source)}](${e.url}) · publicado ${e.occurredAt}`,
      ]),
      `Falta: ${c.gaps.join(" ")}`,
      "",
    ]),
    ...(!digest.candidates.length
      ? [
          "No hay líneas con evidencia específica suficiente para destacar en este corte.",
          "",
        ]
      : []),
    digest.limits,
    "",
  ];
}
