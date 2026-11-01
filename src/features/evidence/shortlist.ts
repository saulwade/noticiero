import { problemContext } from "./engine";
import type { EvidenceRecord, ProblemDossier, ResearchLead } from "./types";
import { authoredText } from "@/features/research/evidence-text";
import { latestEvidenceVersions } from "./versions";

export function evidenceCoverage(records: EvidenceRecord[]) {
  const latest = latestEvidenceVersions(records);
  return [...new Set(latest.flatMap((r) => (r.country ? [r.country] : [])))]
    .sort()
    .map((country) => {
      const rows = latest.filter((r) => r.country === country);
      return {
        country,
        cases: rows.filter((r) => r.kind !== "statistic").length,
        statistics: rows.filter((r) => r.kind === "statistic").length,
        latestDate: rows
          .map((r) => r.period ?? r.occurredAt.slice(0, 10))
          .sort()
          .at(-1)!,
      };
    });
}

/** A research shortlist, never a score of business success or willingness to pay. */
export function researchShortlist(
  dossiers: ProblemDossier[],
  records: EvidenceRecord[],
  now = new Date(),
): ResearchLead[] {
  const byId = new Map(records.map((r) => [r.id, r]));
  return dossiers
    .flatMap((d) => {
      const active = d.evidenceIds.flatMap((id) => {
        const r = byId.get(id);
        return r && r.kind !== "statistic" && !problemContext(r).correction
          ? [r]
          : [];
      });
      if (
        !d.scope ||
        d.identifiedAuthors + d.anonymousCases < 2 ||
        !d.fields.obstacle ||
        active.length < 2
      )
        return [];
      const historical = active.every(
        (r) =>
          Date.parse(r.occurredAt.slice(0, 10)) < now.getTime() - 30 * 86400000,
      );
      const gaps = [
        !d.fields.segment
          ? "Confirmar el perfil del cliente y quién decide la compra."
          : undefined,
        !d.fields.frequency
          ? "Medir con qué frecuencia ocurre el problema."
          : undefined,
        !d.fields.consequence
          ? "Cuantificar el tiempo o dinero que cuesta."
          : undefined,
        !d.fields.workaround
          ? "Observar qué solución utilizan hoy."
          : undefined,
        d.sourceFamilies.length < 2
          ? "Contrastar con otra fuente independiente."
          : undefined,
        historical || active.some((r) => r.caseStatus === "closed")
          ? "Comprobar que el problema sigue vigente; un caso cerrado no prueba resolución."
          : undefined,
        !d.countries.some((c) =>
          ["MX", "CO", "AR", "CL", "PE", "BR"].includes(c),
        )
          ? "Comprobar si ocurre en un segmento accesible de México o Latinoamérica."
          : undefined,
        "Comprobar disposición a pagar con un experimento real.",
      ].filter((s): s is string => Boolean(s));
      const lead: ResearchLead = {
        id: d.id,
        label: d.label,
        product: d.alternatives.join(" · ") || "Producto por confirmar",
        segment:
          d.scope.segment !== "desconocido"
            ? d.scope.segment
            : "Cliente por confirmar",
        countries: d.countries,
        historical,
        authors: d.identifiedAuthors,
        anonymousCases: d.anonymousCases,
        obstacle: d.fields.obstacle.value,
        gaps,
        nextStep: d.experiment,
        evidence: active.slice(0, 3).map((r) => ({
          quote: authoredText(r.quote).slice(0, 600),
          url: r.url,
          source: r.sourceName,
          occurredAt: r.occurredAt,
        })),
      };
      const quality =
        (historical ? 0 : 10) +
        (d.fields.consequence ? 3 : 0) +
        (d.fields.workaround ? 2 : 0) +
        (d.fields.segment ? 2 : 0) +
        Math.min(5, d.identifiedAuthors + d.anonymousCases);
      return [{ lead, quality }];
    })
    .sort((a, b) => b.quality - a.quality || a.lead.id.localeCompare(b.lead.id))
    .slice(0, 3)
    .map((r) => r.lead);
}
