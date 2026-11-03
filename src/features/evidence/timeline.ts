import { editionFor } from "@/lib/time";
import { evidenceCaseKey, latestEvidenceVersions } from "./versions";
import type { EvidenceRecord } from "./types";

export type TimelineAssessment = {
  key: string;
  label: string;
  resolved: boolean;
};
export type TimelineCounts = {
  newCases: number;
  historicalCases: number;
  publishedCases: number;
  updatedCases: number;
  additionalVersions: number;
  newAuthors: number;
  returningAuthors: number;
  anonymousNewCases: number;
  resolutionUpdates: number;
};
export type TimelineGroup = TimelineCounts & {
  key: string;
  label: string;
  previousNewCases: number;
  activeCases: number;
  trend:
    | "new-independent-evidence"
    | "new-cases"
    | "historical-context"
    | "case-updates"
    | "no-new-evidence";
};
export type EvidenceTimeline = {
  days: number;
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  sourceFirstCaptures: Record<string, string>;
  comparisonLimited: boolean;
  statisticsCaptured: number;
  groups: TimelineGroup[];
  total: TimelineCounts;
};
const zero = (): TimelineCounts => ({
  newCases: 0,
  historicalCases: 0,
  publishedCases: 0,
  updatedCases: 0,
  additionalVersions: 0,
  newAuthors: 0,
  returningAuthors: 0,
  anonymousNewCases: 0,
  resolutionUpdates: 0,
});
const shift = (day: string, n: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000)
    .toISOString()
    .slice(0, 10);
const day = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : editionFor(new Date(value)).date;
const validTime = (value: string) => {
  if (!Number.isFinite(Date.parse(value))) return false;
  const calendar = value.slice(0, 10);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(calendar) &&
    new Date(`${calendar}T12:00:00Z`).toISOString().slice(0, 10) === calendar
  );
};

/** Captures measure discovery in this sample, never market demand or event time. */
export function evidenceTimeline(
  records: EvidenceRecord[],
  assess: (record: EvidenceRecord) => TimelineAssessment | undefined,
  now = new Date(),
  days = 7,
): EvidenceTimeline {
  if (!Number.isFinite(now.getTime()) || ![7, 30, 90].includes(days))
    throw new Error("Ventana inválida.");
  const to = editionFor(now).date,
    from = shift(to, 1 - days),
    previousFrom = shift(from, -days),
    previousTo = shift(from, -1);
  const valid = records.filter(
    (r) =>
      validTime(r.capturedAt) &&
      validTime(r.occurredAt) &&
      Date.parse(r.capturedAt) <= now.getTime() &&
      (!r.occurredAt.includes("T") ||
        Date.parse(r.occurredAt) <= now.getTime()) &&
      day(r.occurredAt) <= to,
  );
  const sourceFirstCaptures: Record<string, string> = {};
  for (const r of valid)
    sourceFirstCaptures[r.source] = [
      sourceFirstCaptures[r.source] ?? day(r.capturedAt),
      day(r.capturedAt),
    ].sort()[0];
  const byCase = new Map<string, EvidenceRecord[]>();
  for (const r of valid.filter((r) => r.kind !== "statistic")) {
    const key = evidenceCaseKey(r);
    byCase.set(key, [...(byCase.get(key) ?? []), r]);
  }
  const groups = new Map<string, TimelineGroup>();
  const knownAuthors = new Map<string, Set<string>>(),
    currentAuthors = new Map<string, Set<string>>();
  const ensure = (a: TimelineAssessment) => {
    if (!groups.has(a.key))
      groups.set(a.key, {
        ...zero(),
        key: a.key,
        label: a.label,
        previousNewCases: 0,
        activeCases: 0,
        trend: "no-new-evidence",
      });
    return groups.get(a.key)!;
  };
  // Known authors are assessed against the version available before the window.
  for (const versions of byCase.values()) {
    const old = latestEvidenceVersions(
      versions.filter((r) => day(r.capturedAt) < from),
    )[0];
    const a = old && assess(old);
    if (a && old.authorKey) {
      const set = knownAuthors.get(a.key) ?? new Set<string>();
      set.add(old.authorKey);
      knownAuthors.set(a.key, set);
    }
  }
  for (const versions of byCase.values()) {
    const ordered = [...versions].sort(
      (a, b) =>
        a.capturedAt.localeCompare(b.capturedAt) || a.id.localeCompare(b.id),
    );
    const first = ordered[0],
      latest = latestEvidenceVersions(versions)[0];
    const firstDay = day(first.capturedAt);
    if (firstDay >= previousFrom && firstDay <= previousTo) {
      const previous = latestEvidenceVersions(
        versions.filter((r) => day(r.capturedAt) <= previousTo),
      )[0];
      const previousAssessment = previous && assess(previous);
      if (previousAssessment) ensure(previousAssessment).previousNewCases++;
    }
    const a = assess(latest);
    if (!a) continue;
    const group = ensure(a);
    if (!a.resolved) group.activeCases++;
    const captures = ordered.filter(
      (r) => day(r.capturedAt) >= from && day(r.capturedAt) <= to,
    );
    const before = latestEvidenceVersions(
      versions.filter((r) => day(r.capturedAt) < from),
    )[0];
    if (before?.authorKey && assess(before)) {
      const known = knownAuthors.get(a.key) ?? new Set<string>();
      known.add(before.authorKey);
      knownAuthors.set(a.key, known);
    }
    if (firstDay >= from && firstDay <= to) {
      group.newCases++;
      if (day(latest.occurredAt) < from) group.historicalCases++;
      else group.publishedCases++;
      if (!latest.authorKey && latest.kind === "complaint")
        group.anonymousNewCases++;
    } else if (captures.length) group.updatedCases++;
    group.additionalVersions += Math.max(
      0,
      captures.length - (firstDay >= from ? 1 : 0),
    );
    if (
      captures.length &&
      latest.authorKey &&
      (firstDay >= from || knownAuthors.get(a.key)?.has(latest.authorKey))
    ) {
      const set = currentAuthors.get(a.key) ?? new Set<string>();
      set.add(latest.authorKey);
      currentAuthors.set(a.key, set);
    }
    if (before && captures.length && !assess(before)?.resolved && a.resolved)
      group.resolutionUpdates++;
  }
  const total = zero();
  for (const group of groups.values()) {
    const old = knownAuthors.get(group.key) ?? new Set<string>();
    for (const author of currentAuthors.get(group.key) ?? []) {
      if (old.has(author)) group.returningAuthors++;
      else group.newAuthors++;
    }
    group.trend =
      group.newCases > 0 && group.historicalCases === group.newCases
        ? "historical-context"
        : group.newCases > 0
          ? group.newAuthors > 0
            ? "new-independent-evidence"
            : "new-cases"
          : group.updatedCases > 0
            ? "case-updates"
            : "no-new-evidence";
    for (const k of Object.keys(total) as (keyof TimelineCounts)[])
      total[k] += group[k];
  }
  return {
    days,
    from,
    to,
    previousFrom,
    previousTo,
    sourceFirstCaptures,
    comparisonLimited: Object.values(sourceFirstCaptures).some(
      (d) => d > previousFrom,
    ),
    statisticsCaptured: valid.filter(
      (r) =>
        r.kind === "statistic" &&
        day(r.capturedAt) >= from &&
        day(r.capturedAt) <= to,
    ).length,
    total,
    groups: [...groups.values()].sort(
      (a, b) =>
        b.newAuthors - a.newAuthors ||
        b.newCases - a.newCases ||
        a.key.localeCompare(b.key),
    ),
  };
}

export function timelineMarkdown(timeline: EvidenceTimeline) {
  const t = timeline.total;
  return [
    `### Ventana de ${timeline.days} días · ${timeline.from} a ${timeline.to}`,
    `Casos vistos por primera vez: ${t.newCases}; de ellos ${t.publishedCases} tienen fecha original en esta ventana y ${t.historicalCases} son antecedentes. Casos anteriores actualizados: ${t.updatedCases}; versiones adicionales: ${t.additionalVersions}.`,
    `Cuentas nuevas para cada problema: ${t.newAuthors}; cuentas ya conocidas con actividad: ${t.returningAuthors}; casos nuevos sin identidad pública: ${t.anonymousNewCases}. Una misma cuenta puede aparecer en varios problemas; estos totales no son personas únicas globales.`,
    `Actualizaciones que incorporan resolución: ${t.resolutionUpdates}. Estadísticas capturadas: ${timeline.statisticsCaptured}; no se cuentan como casos ni autores.`,
    timeline.comparisonLimited
      ? "Comparación limitada: alguna fuente no tiene capturas anteriores a toda la ventana previa. No puede inferirse una tendencia de mercado."
      : "Comparación de las capturas disponibles; no demuestra cobertura continua ni crecimiento de mercado.",
    ...timeline.groups
      .slice(0, 20)
      .map(
        (g) =>
          `- ${g.label}: ${g.newCases} casos nuevos en la muestra (${g.previousNewCases} en la ventana previa), ${g.newAuthors} cuentas nuevas para ese problema, ${g.updatedCases} casos actualizados, ${g.activeCases} casos sin resolución declarada. ${g.trend === "no-new-evidence" ? "Sin evidencia nueva observada; no prueba que desapareciera la necesidad." : g.trend === "historical-context" ? "Sólo nuevos antecedentes; no demanda nueva." : g.trend === "case-updates" ? "Recapturas/revisiones; no casos nuevos." : "Comprobar citas, segmento y vigencia antes de interpretar repetición."}`,
      ),
    "",
  ];
}
