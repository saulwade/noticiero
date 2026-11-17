import { normalizedText } from "@/features/research/evidence-text";
import { buildDossiers, problemContext } from "./engine";
import { latestEvidenceVersions } from "./versions";
import { consumerApps, consumerStorefronts } from "./app-reviews";
import type { EvidenceRecord, EvidenceReview } from "./types";

export type ConsumerDigest = {
  version: "consumer-es-v1";
  asOf: string;
  reviews: number;
  publicAccounts: number;
  positiveReviews: number;
  problemReviews: number;
  recentCaptures: number;
  sourceUpdatedDates: number;
  keywords: { term: string; reviews: number }[];
  candidates: {
    id: string;
    problem: string;
    products: string[];
    cases: number;
    publicAccounts: number;
    resolvedCases: number;
    stage: "isolated" | "repeated";
    evidence: {
      quote: string;
      url: string;
      sourceUpdatedAt: string;
      rating?: number;
    }[];
    gaps: string[];
  }[];
  limits: string;
};
const terms = [
  "suscripcion",
  "cancelar",
  "sincronizar",
  "lista",
  "gastos",
  "saldo",
  "moneda",
  "recordatorios",
  "horarios",
  "energia",
  "vidas",
  "correcciones",
  "idiomas",
  "exportar",
  "datos",
  "familia",
  "pareja",
];
export function buildConsumerDigest(
  records: EvidenceRecord[],
  reviews: EvidenceReview[],
  now = new Date(),
): ConsumerDigest {
  const raw = records.filter(
    (r) =>
      r.source === "app-store" &&
      r.language === "es" &&
      Date.parse(r.occurredAt) <= now.getTime() &&
      Date.parse(r.capturedAt) <= now.getTime(),
  );
  const reviewMap = new Map(
    reviews
      .filter((r) => Date.parse(r.at) <= now.getTime())
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((r) => [r.id, r.decision]),
  );
  const latest = latestEvidenceVersions(raw).filter(
    (r) => !reviewMap.has(r.id) || reviewMap.get(r.id) === "useful",
  );
  const byId = new Map(latest.map((r) => [r.id, r]));
  const candidates = buildDossiers(raw, reviews, now)
    .flatMap((d) => {
      if (!d.scope?.key.startsWith("consumer:")) return [];
      const members = d.evidenceIds.flatMap((id) =>
        byId.has(id) ? [byId.get(id)!] : [],
      );
      const active = members.filter(
        (r) => problemContext(r).accepted && !problemContext(r).correction,
      );
      if (!active.length) return [];
      const accounts = new Set(
        active.flatMap((r) => (r.authorKey ? [r.authorKey] : [])),
      ).size;
      return [
        {
          id: d.id,
          problem: d.label,
          products: [
            ...new Set(members.flatMap((r) => (r.product ? [r.product] : []))),
          ],
          cases: active.length,
          publicAccounts: accounts,
          resolvedCases: members.filter((r) => problemContext(r).correction)
            .length,
          stage: accounts >= 2 ? ("repeated" as const) : ("isolated" as const),
          evidence: active.slice(0, 3).map((r) => ({
            quote: r.quote.slice(0, 500),
            url: r.url,
            sourceUpdatedAt: r.occurredAt,
            rating: r.rating,
          })),
          gaps: [
            ...(accounts < 2
              ? ["Encontrar otra cuenta independiente con el mismo obstáculo."]
              : []),
            "Comprobar si soporte, configuración o una versión reciente de la app ya resuelve el problema.",
            "Precisar el segmento y contrastar con otra familia de fuentes; las reseñas no prueban residencia ni personas verificadas.",
            "Comprobar una solución mejor y disposición a pagar; quejarse de un precio no demuestra un mercado para otra app.",
            "La fecha disponible es de actualización de reseña, no publicación original ni nueva demanda.",
          ],
        },
      ];
    })
    .sort(
      (a, b) =>
        b.publicAccounts - a.publicAccounts ||
        b.cases - a.cases ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 8);
  return {
    version: "consumer-es-v1",
    asOf: now.toISOString(),
    reviews: latest.length,
    publicAccounts: new Set(
      latest.flatMap((r) => (r.authorKey ? [r.authorKey] : [])),
    ).size,
    positiveReviews: latest.filter((r) => (r.rating ?? 0) >= 4).length,
    problemReviews: latest.filter(
      (r) => problemContext(r).accepted && !problemContext(r).correction,
    ).length,
    recentCaptures: latest.filter(
      (r) => Date.parse(r.capturedAt) >= now.getTime() - 7 * 86400000,
    ).length,
    sourceUpdatedDates: latest.filter((r) => r.dateBasis === "source_updated")
      .length,
    keywords: terms
      .map((term) => ({
        term,
        reviews: latest.filter((r) =>
          new RegExp(`\\b${term}\\b`).test(normalizedText(r.quote)),
        ).length,
      }))
      .filter((t) => t.reviews)
      .sort((a, b) => b.reviews - a.reviews || a.term.localeCompare(b.term))
      .slice(0, 15),
    candidates,
    limits: `Muestra parcial de reseñas en español; catálogo inicial de ${consumerApps.length} apps y rotación de ${consumerStorefronts.length} tiendas. La tienda no confirma residencia. Sin estimaciones de descargas, usuarios activos, mercado o intención de pago. Cuentas públicas seudonimizadas no son personas verificadas; reseñas y estrellas pueden tener sesgos.`,
  };
}
export function consumerDigestMarkdown(digest: ConsumerDigest) {
  const clean = (s: string) => s.replace(/[\r\n<>]/g, " ");
  return [
    "## Consumer apps · hispanohablantes globales",
    "",
    `${digest.reviews} reseñas distintas; ${digest.publicAccounts} claves de cuentas públicas; ${digest.problemReviews} obstáculos específicos; ${digest.positiveReviews} reseñas de cuatro/cinco estrellas como contexto de satisfacción.`,
    `${digest.recentCaptures} casos capturados en siete días; ${digest.sourceUpdatedDates} fechas de actualización de fuente, que no demuestran publicaciones originales nuevas.`,
    `Palabras en reseñas (documentos, no demanda): ${digest.keywords.map((k) => `${k.term} (${k.reviews})`).join(", ") || "sin muestra suficiente"}.`,
    "",
    ...digest.candidates.flatMap((c) => [
      `### ${clean(c.problem)} · ${c.stage === "repeated" ? "repetición en la muestra" : "pista aislada"}`,
      `Alternativas observadas: ${c.products.map(clean).join(", ")}. ${c.cases} casos, ${c.publicAccounts} claves de cuenta; ${c.resolvedCases} resoluciones declaradas relacionadas. No es un negocio validado.`,
      ...c.evidence.map(
        (e) =>
          `- Extracto: ${clean(e.quote)} · ${e.url} · actualizado en fuente ${e.sourceUpdatedAt}${e.rating ? ` · ${e.rating}/5 estrellas` : ""}`,
      ),
      ...c.gaps.map((g) => `- Falta: ${g}`),
      "",
    ]),
    ...(!digest.candidates.length
      ? [
          "Todavía no hay causas específicas suficientes; se conserva la muestra sin inventar una idea.",
          "",
        ]
      : []),
    digest.limits,
    "",
  ];
}
