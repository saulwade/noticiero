import { hash } from "@/features/news/normalize";
import { canonicalSourceUrl } from "./quality";
import {
  MEMORY_VERSION,
  type IdeaAssessment,
  type IdeaDefinition,
  type IdeaDecision,
  type IdeaEvidence,
  type IdeaSourceCheck,
} from "./types";

const DAY = 86400000;
export function latestSourceChecks(checks: IdeaSourceCheck[], now: Date) {
  const latest = new Map<string, IdeaSourceCheck>();
  for (const check of [...checks]
    .filter((c) => Date.parse(c.checkedAt) <= now.getTime())
    .sort(
      (a, b) =>
        a.checkedAt.localeCompare(b.checkedAt) || a.id.localeCompare(b.id),
    ))
    latest.set(canonicalSourceUrl(check.url), check);
  return latest;
}
export function assessIdea(
  idea: IdeaDefinition,
  links: IdeaEvidence[],
  checks: IdeaSourceCheck[],
  journal: IdeaDecision[],
  now: Date,
): IdeaAssessment {
  const cutoff = now.getTime();
  const decisions = journal
    .filter((d) => d.ideaId === idea.id && Date.parse(d.at) <= cutoff)
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const decision = decisions.at(-1);
  const available = links.filter(
    (l) =>
      l.ideaId === idea.id &&
      Date.parse(l.capturedAt) <= cutoff &&
      Date.parse(l.occurredAt) <= cutoff,
  );
  const latest = new Map<string, IdeaEvidence>();
  for (const link of [...available].sort(
    (a, b) =>
      a.capturedAt.localeCompare(b.capturedAt) ||
      (a.revision ?? 0) - (b.revision ?? 0) ||
      a.recordId.localeCompare(b.recordId),
  ))
    latest.set(link.caseKey, link);
  // A shared canonical URL across collectors or translated pages is one origin.
  const byUrl = new Map<string, IdeaEvidence>();
  for (const link of latest.values())
    byUrl.set(
      link.kind === "complaint" || link.kind === "statistic"
        ? link.caseKey
        : link.url,
      link,
    );
  const sourceByUrl = latestSourceChecks(checks, now);
  const lastValidByUrl = latestSourceChecks(
    checks.filter((c) => c.status === "ok"),
    now,
  );
  const current = [...byUrl.values()].map((link) => {
    const check = lastValidByUrl.get(link.url);
    if (
      check?.status !== "ok" ||
      check.kind !== "issue" ||
      Date.parse(check.checkedAt) < Date.parse(link.capturedAt) ||
      ["promotion", "context", "statistic", "rejected"].includes(link.quality)
    )
      return link;
    if (check.issueState === "closed")
      return {
        ...link,
        quality:
          check.stateReason === "completed"
            ? ("resolved" as const)
            : ("closed-unverified" as const),
        reasons: [
          ...link.reasons,
          check.stateReason === "completed"
            ? "La fuente reporta completed; falta comprobar versión instalada."
            : "La fuente sigue cerrada sin corrección comprobada.",
        ],
      };
    if (
      check.issueState === "open" &&
      (link.quality === "closed-unverified" ||
        (link.quality === "resolved" && check.stateReason === "reopened"))
    )
      return {
        ...link,
        quality:
          Date.parse(link.occurredAt) < cutoff - 30 * DAY
            ? ("historical" as const)
            : ("problem" as const),
        reasons: [
          ...link.reasons,
          "La fuente está abierta de nuevo; se conserva la resolución anterior como antecedente.",
        ],
      };
    return link;
  });
  const active = current.filter((l) => l.quality === "problem");
  const currentWeek = active.filter(
    (l) => Date.parse(l.occurredAt) >= cutoff - 7 * DAY,
  );
  const previousWeek = active.filter(
    (l) =>
      Date.parse(l.occurredAt) >= cutoff - 14 * DAY &&
      Date.parse(l.occurredAt) < cutoff - 7 * DAY,
  );
  const firstCapture = new Map<string, string>();
  for (const l of available)
    if (
      !firstCapture.has(l.caseKey) ||
      l.capturedAt < firstCapture.get(l.caseKey)!
    )
      firstCapture.set(l.caseKey, l.capturedAt);
  const firstAuthors = new Map<string, number>();
  for (const l of available.filter(
    (l) => !["promotion", "statistic", "rejected"].includes(l.quality),
  ))
    if (l.authorKey)
      firstAuthors.set(
        l.authorKey,
        Math.min(
          firstAuthors.get(l.authorKey) ?? Infinity,
          Date.parse(l.occurredAt),
        ),
      );
  const mechanismMap = new Map<string, IdeaEvidence[]>();
  for (const link of active) {
    const members = mechanismMap.get(link.mechanism) ?? [];
    members.push(link);
    mechanismMap.set(link.mechanism, members);
  }
  const mechanisms = [...mechanismMap]
    .map(([key, rows]) => ({
      key,
      label: rows[0].mechanismLabel ?? "Causa específica por comprobar",
      cases: rows.length,
      publicAccounts: new Set(
        rows.flatMap((r) => (r.authorKey ? [r.authorKey] : [])),
      ).size,
      anonymousCases: rows.filter((r) => !r.authorKey && r.kind === "complaint")
        .length,
      sourceFamilies: new Set(rows.map((r) => r.sourceFamily)).size,
    }))
    .sort(
      (a, b) =>
        b.publicAccounts - a.publicAccounts || a.key.localeCompare(b.key),
    );
  const sourceUrls = [
    ...new Set([
      ...idea.sources.map((s) => canonicalSourceUrl(s.url)),
      ...current
        .filter((l) => /^https:\/\/github\.com\/.+\/issues\/\d+$/.test(l.url))
        .slice(0, 12)
        .map((l) => l.url),
    ]),
  ];
  const sources: IdeaAssessment["sources"] = sourceUrls.map((url) => {
    const check = sourceByUrl.get(url);
    if (!check)
      return {
        url,
        status: "pending",
        message:
          "Consulta pública pendiente; no se supone que una alternativa esté ausente.",
      };
    if (check.status !== "ok")
      return {
        url,
        status: "error",
        checkedAt: check.checkedAt,
        message: check.message,
      };
    if (cutoff - Date.parse(check.checkedAt) > 2 * DAY)
      return {
        url,
        status: "stale",
        checkedAt: check.checkedAt,
        message: "Última consulta antigua; vigencia por comprobar.",
      };
    const baseline = checks
      .filter(
        (c) =>
          canonicalSourceUrl(c.url) === url &&
          c.status === "ok" &&
          Date.parse(c.checkedAt) <= cutoff &&
          c.contentHash &&
          (!decision || c.checkedAt >= decision.at),
      )
      .sort((a, b) => a.checkedAt.localeCompare(b.checkedAt))[0];
    const changed =
      check.kind === "competitor" &&
      baseline?.contentHash &&
      baseline.contentHash !== check.contentHash;
    return {
      url,
      status: changed ? "changed" : "ok",
      checkedAt: check.checkedAt,
      message: changed
        ? "Cambió el documento de competencia; requiere revisar qué cambió, no se infieren funciones nuevas."
        : check.message,
    };
  });
  const count = (quality: IdeaEvidence["quality"]) =>
    current.filter((l) => l.quality === quality).length;
  const totals = {
    cases: current.length,
    revisions: new Set(available.map((l) => l.recordId)).size,
    activeCases: active.length,
    publicAccounts: new Set(
      active.flatMap((l) => (l.authorKey ? [l.authorKey] : [])),
    ).size,
    anonymousCases: active.filter((l) => !l.authorKey && l.kind === "complaint")
      .length,
    historical: count("historical"),
    resolved: count("resolved"),
    closedUnverified: count("closed-unverified"),
    promotions: count("promotion"),
    context: count("context"),
    statistics: count("statistic"),
    rejected: count("rejected"),
    mexicoCases: active.filter((l) => l.country === "MX").length,
    quantifiedConsequences: active.filter(
      (l) =>
        l.fields.consequence &&
        /\d[\d.,]*\s*(?:hours?|minutes?|days?|horas?|minutos?|dias?|usd|mxn|dollars?|pesos)|[$€]\s*\d/i.test(
          l.fields.consequence,
        ) &&
        !/\b(?:could|would|may|might|save|podria|ahorraria)\b/i.test(
          l.fields.consequence,
        ),
    ).length,
    buyerStatements: active.filter((l) => l.fields.buyer).length,
  };
  const repeated = mechanisms.filter(
    (m) => !m.key.startsWith("isolated:") && m.publicAccounts >= 2,
  );
  const gaps = [
    ...(repeated.length
      ? []
      : [
          "Encontrar cuentas independientes con el mismo mecanismo; compartir palabras no basta.",
        ]),
    ...(totals.mexicoCases
      ? []
      : [
          "Comprobar vigencia y proceso en México/Latinoamérica; idioma no determina país.",
        ]),
    "Verificar organizaciones, comprador y disposición a pagar; ninguna cuenta pública se considera cliente validado.",
    "Cuantificar con registros la frecuencia, las pérdidas y el costo de servir; las citas son afirmaciones sin auditoría.",
    "Contrastar alternativas existentes y preferencia por una solución nueva; no se demuestra un hueco por falta de datos.",
    ...(totals.resolved || totals.closedUnverified
      ? [
          "Comprobar versión desplegada e instalaciones afectadas; completed no verifica adopción de la corrección.",
        ]
      : []),
    ...(sources.some((s) => s.status !== "ok")
      ? [
          "Completar o revisar consultas pendientes, fallidas o cambiadas de competencia y vigencia.",
        ]
      : []),
  ];
  const weekly = {
    currentCases: currentWeek.length,
    previousCases: previousWeek.length,
    newAccounts: new Set(
      currentWeek.flatMap((l) =>
        l.authorKey && firstAuthors.get(l.authorKey)! >= cutoff - 7 * DAY
          ? [l.authorKey]
          : [],
      ),
    ).size,
    newCaptures: [...firstCapture].filter(
      ([, at]) => Date.parse(at) >= cutoff - 7 * DAY,
    ).length,
    historicalImports: current.filter(
      (l) =>
        Date.parse(firstCapture.get(l.caseKey)!) >= cutoff - 7 * DAY &&
        Date.parse(l.occurredAt) < cutoff - 7 * DAY,
    ).length,
    revisions: Math.max(
      0,
      new Set(
        available
          .filter((l) => Date.parse(l.capturedAt) >= cutoff - 7 * DAY)
          .map((l) => l.recordId),
      ).size -
        [...firstCapture].filter(([, at]) => Date.parse(at) >= cutoff - 7 * DAY)
          .length,
    ),
    repeatedMechanisms: repeated.length,
  };
  const rationale = [
    ...(decision
      ? [`Decisión de investigación conservada: ${decision.reason}`]
      : [
          "Seguimiento automático; todavía no hay decisión comercial respaldada.",
        ]),
    `${active.length} casos recientes abiertos; ${totals.publicAccounts} cuentas públicas distintas, sin verificar organizaciones.`,
    `${repeated.length} mecanismos con repetición entre cuentas; no se combinan causas distintas.`,
    ...(totals.resolved
      ? [
          `${totals.resolved} casos con resolución declarada se conservan como evidencia que debilita la vigencia.`,
        ]
      : []),
  ];
  const state = {
    version: MEMORY_VERSION,
    ideaId: idea.id,
    date: now.toISOString().slice(0, 10),
    decision: decision?.decision ?? "watch",
    totals,
    weekly,
    mechanisms,
    sources,
    journalIds: decisions.map((d) => d.id),
    links: available.map((l) => l.id).sort(),
  };
  const inputHash = hash(JSON.stringify(state));
  return {
    id: `${idea.id}:${inputHash}`,
    ideaId: idea.id,
    version: MEMORY_VERSION,
    asOf: now.toISOString(),
    inputHash,
    decision: decision?.decision ?? "watch",
    rationale,
    gaps,
    totals,
    weekly,
    mechanisms,
    evidence: active.slice(0, 6),
    contradictions: current
      .filter((l) =>
        ["resolved", "promotion", "closed-unverified"].includes(l.quality),
      )
      .slice(0, 6),
    sources,
    journalIds: state.journalIds,
  };
}
