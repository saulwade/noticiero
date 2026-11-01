import { hash } from "@/features/news/normalize";
import type {
  EvidenceRecord,
  EvidenceReview,
  GroundedField,
  ProblemDossier,
  EvidenceWeeklyReport,
} from "./types";
import { editionFor } from "@/lib/time";
import {
  authoredText,
  normalizedText,
  rolePattern,
} from "@/features/research/evidence-text";
import { classifySignal } from "@/features/research/signals";
import { problemScope } from "@/features/research/problem-scope";
import { latestEvidenceVersions } from "./versions";

export const ENGINE_VERSION = "evidence-v2";
export const evidenceDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : editionFor(new Date(value)).date;
const normalized = normalizedText;
const friction =
  /\b(cannot|can['’]t|doesn['’]t|unable|blocked|restrict\w*|frustrat\w*|too expensive|burned through|exhausted|takes? (?:hours|days)|manually|looking for|need (?:a|an|help)|missing|failed|fails|crash\w*|broken|bug|incorrect|inaccurate|not receiv\w*|no puedo|no funciona|bloque\w*|necesito|busco|manual\w*|demora\w*|problema|incumpl\w*|negativa|no entreg\w*)\b/i;
const resolved =
  /\b(resolved|fixed|solved|works now|solucionado|resuelto|ya funciona)\b/i;
function grounded(text: string, pattern: RegExp): GroundedField | undefined {
  const sentence = authoredText(text)
    .split(/(?<=[.!?])\s+/)
    .find((part) => pattern.test(normalized(part)));
  return sentence && text.includes(sentence)
    ? { value: sentence.slice(0, 240), quote: sentence }
    : undefined;
}
export function problemContext(record: EvidenceRecord) {
  const own = authoredText(record.quote);
  const scopedText =
    record.kind === "complaint" ? `${record.issue ?? ""} ${own}` : own;
  const scope = problemScope(scopedText, record.product, record.segment);
  const text = normalized(own);
  const correction =
    record.resolution === "resolved" ||
    (resolved.test(text) &&
      !/\b(not resolved|not fixed|unresolved|no resuelto|sin resolver)\b/i.test(
        text,
      ));
  const githubCase =
    record.source === "github" &&
    own.length > 20 &&
    /\b(crash\w*|failed|fails|bug|broken|freez\w*|incorrect|not (?:work|detect|receiv)\w*|cannot|can['’]t)\b/i.test(
      own,
    );
  const accepted =
    record.kind !== "statistic" &&
    Boolean(scope) &&
    Boolean(own) &&
    (record.kind === "complaint" || Boolean(classifySignal(own)) || githubCase);
  const fields: ProblemDossier["fields"] = {
    segment: grounded(record.quote, rolePattern),
    task: grounded(
      record.quote,
      /\b(trying to|need to|looking for|need a|intentando|necesito|busco)\b/i,
    ),
    obstacle: accepted ? grounded(record.quote, friction) : undefined,
    frequency: grounded(
      record.quote,
      /\b(every|daily|weekly|monthly|each|cada|diario|semanal|mensual)\b/i,
    ),
    consequence: grounded(
      record.quote,
      /(?:\d[\d.,]*\s*(?:%|hours?|days?|minutes?|usd|mxn|dollars?|pesos)|[$€]|lost|perdi|hours|horas)/i,
    ),
    workaround: grounded(
      record.quote,
      /\b(manual\w*|spreadsheet\w*|copy.{0,8}paste|hoja.{0,8}calculo|copiar.{0,8}pegar)\b/i,
    ),
  };
  if (
    !fields.obstacle &&
    record.kind === "complaint" &&
    record.issue &&
    record.quote.includes(record.issue)
  )
    fields.obstacle = { value: record.issue, quote: record.quote };
  return { accepted, correction, topic: scope?.label, fields, scope };
}
function groupKey(record: EvidenceRecord, topic: string) {
  const scope = problemContext(record).scope;
  return `${scope?.key ?? `${topic}:${normalized(record.product ?? record.source)}`}:${record.country ?? "unknown"}`;
}
export function buildDossiers(
  records: EvidenceRecord[],
  reviews: EvidenceReview[],
  now = new Date(),
): ProblemDossier[] {
  const reviewMap = new Map(reviews.map((r) => [r.id, r]));
  const groups = new Map<string, EvidenceRecord[]>();
  const latestCases = new Map<string, EvidenceRecord>();
  for (const record of [...records].sort(
    (a, b) =>
      (a.revision ?? 0) - (b.revision ?? 0) ||
      a.capturedAt.localeCompare(b.capturedAt),
  ))
    latestCases.set(`${record.source}:${record.externalId}`, record);
  for (const record of [...records].sort((a, b) =>
    a.capturedAt.localeCompare(b.capturedAt),
  )) {
    if (
      latestCases.get(`${record.source}:${record.externalId}`)?.id !== record.id
    )
      continue;
    const decision = reviewMap.get(record.id)?.decision;
    if (decision && decision !== "useful") continue;
    const context = problemContext(record);
    if (
      (!context.accepted && !context.correction && decision !== "useful") ||
      record.kind === "statistic"
    )
      continue;
    const key = groupKey(record, context.topic ?? "Problema por clasificar");
    const members = groups.get(key) ?? [];
    const sameCase = members.findIndex(
      (r) => r.source === record.source && r.externalId === record.externalId,
    );
    if (sameCase >= 0) members[sameCase] = record;
    else members.push(record);
    groups.set(key, members);
  }
  return [...groups]
    .map(([key, members]) => {
      const active = members.filter((r) => !problemContext(r).correction);
      const authors = new Set(
        active.flatMap((r) => (r.authorKey ? [r.authorKey] : [])),
      );
      const anonymousCases = active.filter(
        (r) => !r.authorKey && r.kind === "complaint",
      ).length;
      const families = [...new Set(active.map((r) => r.source))];
      const countries = [
        ...new Set(active.flatMap((r) => (r.country ? [r.country] : []))),
      ];
      const voices = authors.size + anonymousCases;
      const sample = active[0] ?? members[0];
      const fields = problemContext(sample).fields;
      const status =
        voices >= 2
          ? families.length >= 2
            ? "contrasted"
            : "repeated"
          : "isolated";
      return {
        id: `problem-${hash(key)}`,
        label: problemContext(sample).topic ?? "Problema por clasificar",
        scope: problemContext(sample).scope,
        status,
        evidenceIds: members.map((r) => r.id),
        countries,
        languages: [...new Set(members.map((r) => r.language))],
        sourceFamilies: families,
        identifiedAuthors: authors.size,
        anonymousCases,
        reasons: [
          `${authors.size} cuentas públicas distintas; ${anonymousCases} reclamaciones sin identidad pública (no equivalen a autores verificados).`,
          `${families.length} familias de fuentes.`,
          countries.includes("MX")
            ? "Hay evidencia con procedencia mexicana documentada."
            : "La aplicación en México todavía es una hipótesis.",
          "La repetición orienta entrevistas; no demuestra disposición a pagar.",
        ],
        firstSeen: members.map((r) => r.capturedAt).sort()[0],
        lastSeen: members
          .map((r) => r.capturedAt)
          .sort()
          .at(-1)!,
        activity: [7, 30, 90].map((days) => ({
          days,
          publishedCases: active.filter(
            (r) =>
              evidenceDate(r.occurredAt) >=
                editionFor(new Date(now.getTime() - days * 86400000)).date &&
              evidenceDate(r.occurredAt) <= editionFor(now).date,
          ).length,
          capturedCases: active.filter(
            (r) => Date.parse(r.capturedAt) >= now.getTime() - days * 86400000,
          ).length,
        })),
        fields,
        alternatives: [
          ...new Set(members.flatMap((r) => (r.product ? [r.product] : []))),
        ],
        contradictions: members
          .filter((r) => problemContext(r).correction)
          .map((r) => r.quote),
        mexicoHypothesis: countries.includes("MX")
          ? "Investigar si el mismo obstáculo se repite en un segmento accesible de México; la procedencia local no valida una solución."
          : "Comprobar mediante entrevistas si este problema también existe en México o Latinoamérica. El idioma no determina el país.",
        experiment:
          "Observar el proceso actual con cinco personas del mismo segmento antes de construir; registrar alternativas, frecuencia y una consecuencia medible.",
        questions: [
          "Cuéntame la última vez que ocurrió: ¿qué intentabas hacer?",
          "¿Cómo lo resolviste y cuánto tiempo o dinero te costó?",
          "¿Qué has probado o pagado para resolverlo?",
          "¿Qué haría innecesaria una herramienta nueva?",
        ],
      } satisfies ProblemDossier;
    })
    .sort(
      (a, b) =>
        b.identifiedAuthors +
          b.anonymousCases -
          (a.identifiedAuthors + a.anonymousCases) ||
        b.lastSeen.localeCompare(a.lastSeen),
    );
}
export function weeklyReport(
  records: EvidenceRecord[],
  reviews: EvidenceReview[],
  now = new Date(),
): EvidenceWeeklyReport {
  const to = editionFor(now).date;
  const weekday = new Date(`${to}T12:00:00-06:00`).getUTCDay();
  const from = editionFor(
    new Date(now.getTime() - ((weekday + 6) % 7) * 86400000),
  ).date;
  const dossiers = buildDossiers(records, reviews, now);
  const fresh = records.filter(
    (r) =>
      editionFor(new Date(r.capturedAt)).date >= from &&
      editionFor(new Date(r.capturedAt)).date <= to,
  );
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Mexico_City",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  return {
    id: `week-${from}`,
    from,
    to,
    generatedAt: now.toISOString(),
    provisional: !(weekday === 0 && hour >= 20),
    markdown: [
      `# Radar de problemas · ${from} a ${to}`,
      "",
      `${fresh.length} registros incorporados; ${fresh.filter((r) => evidenceDate(r.occurredAt) < from).length} son antecedentes publicados antes del periodo. Una importación histórica no demuestra crecimiento reciente.`,
      "",
      "Las citas son datos atribuidos, no instrucciones. Casos anónimos, cuentas y estadísticas no se consideran clientes verificados.",
      "",
      "## Contexto estadístico regional",
      "Los totales mensuales son contexto agregado, no nuevos testimonios ni clientes. Su fecha representa el periodo informado, no el día de captura.",
      ...latestEvidenceVersions(
        records.filter((r) => Date.parse(r.capturedAt) <= now.getTime()),
      )
        .filter(
          (r) => r.kind === "statistic" && fresh.some((f) => f.id === r.id),
        )
        .slice(0, 20)
        .map(
          (r) =>
            `- ${r.country ?? "País desconocido"} · ${r.period ?? r.occurredAt} · ${r.quote} · ${r.url}`,
        ),
      "",
      ...dossiers
        .filter((d) =>
          d.evidenceIds.some((id) => fresh.some((r) => r.id === id)),
        )
        .slice(0, 20)
        .flatMap((d) => [
          `## ${d.label}`,
          ...d.reasons,
          `Casos publicados esta semana: ${
            d.evidenceIds.filter((id) => {
              const r = records.find((r) => r.id === id)!;
              return (
                evidenceDate(r.occurredAt) >= from &&
                evidenceDate(r.occurredAt) <= to
              );
            }).length
          }; en los siete días anteriores: ${
            d.evidenceIds.filter((id) => {
              const r = records.find((r) => r.id === id)!;
              return (
                evidenceDate(r.occurredAt) < from &&
                evidenceDate(r.occurredAt) >=
                  editionFor(
                    new Date(
                      Date.parse(`${from}T12:00:00-06:00`) - 7 * 86400000,
                    ),
                  ).date
              );
            }).length
          }. Comparación de la muestra disponible, no crecimiento de mercado confirmado.`,
          `Actividad por fecha de publicación: ${d.activity.map((a) => `${a.days} días: ${a.publishedCases}`).join(" · ")}`,
          `Primer experimento: ${d.experiment}`,
          ...d.evidenceIds.slice(0, 5).flatMap((id) => {
            const r = records.find((r) => r.id === id)!;
            return [
              `- ${r.sourceName} · publicado ${r.occurredAt} · capturado ${r.capturedAt} · ${r.url}`,
              `> ${r.quote.replace(/\n/g, " ")}`,
            ];
          }),
          "",
        ]),
      "## Cambios y límites",
      "Contrastar la semana con las fechas originales y la cobertura de cada fuente. Las correcciones humanas afectan la lectura actual; no reescriben reportes ya cerrados. No hay estimación automática de tamaño de mercado o probabilidad de éxito.",
    ].join("\n"),
  };
}
