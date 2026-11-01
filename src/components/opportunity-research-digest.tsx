import type { EvidenceData } from "@/features/evidence/types";
import "./opportunity-research-digest.css";

const countries: Record<string, string> = {
  MX: "México",
  CO: "Colombia",
  US: "Estados Unidos",
  AR: "Argentina",
  CL: "Chile",
  PE: "Perú",
  BR: "Brasil",
};
export function OpportunityResearchDigest({
  data,
  query = "",
}: {
  data?: EvidenceData;
  query?: string;
}) {
  const leads = (data?.shortlist ?? []).filter((lead) =>
    `${lead.label} ${lead.product} ${lead.segment} ${lead.obstacle}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const regional = (data?.coverage ?? []).filter((c) => c.country !== "US");
  return (
    <section
      className="op-research-digest"
      aria-label="Prioridades de investigación"
    >
      <header>
        <span className="eyebrow">DEL PROBLEMA AL EXPERIMENTO</span>
        <h2>Qué vale la pena entender.</h2>
        <p>
          Selección automática por evidencia concreta y repetición. Son
          problemas por contrastar; todavía no son negocios validados.
        </p>
      </header>
      {regional.length ? (
        <p className="op-regional-coverage">
          {regional
            .map(
              (c) =>
                `${countries[c.country] ?? c.country}: ${c.cases} casos administrativos · ${c.statistics} grupos estadísticos · fecha más reciente ${c.latestDate}`,
            )
            .join(" | ")}
        </p>
      ) : null}
      {leads.length ? (
        <div className="op-lead-list">
          {leads.map((lead) => (
            <article key={lead.id} className="op-lead">
              <div className="op-lead-heading">
                <h3>{lead.label}</h3>
                <span>
                  {lead.historical
                    ? "Repetición histórica"
                    : "Repetición en la muestra"}
                </span>
              </div>
              <p className="op-lead-context">
                {lead.product} · {lead.segment}
                {lead.countries.length
                  ? ` · ${lead.countries.map((c) => countries[c] ?? c).join(", ")}`
                  : " · país por comprobar"}
              </p>
              <p>{lead.obstacle}</p>
              <p className="op-lead-counts">
                {lead.authors} cuentas públicas distintas ·{" "}
                {lead.anonymousCases} casos sin identidad pública. Ninguno
                equivale a un cliente validado.
              </p>
              <details>
                <summary>Evidencia y siguiente comprobación</summary>
                <div className="op-lead-detail">
                  <strong>Lo que falta comprobar</strong>
                  <ul>
                    {lead.gaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                  <strong>Primer experimento</strong>
                  <p>{lead.nextStep}</p>
                  {lead.evidence.map((e, i) => (
                    <figure key={`${e.url}-${i}`}>
                      <blockquote>{e.quote}</blockquote>
                      <figcaption>
                        <a href={e.url} target="_blank" rel="noreferrer">
                          {e.source} ↗
                        </a>
                        <span>
                          Fecha de fuente: {e.occurredAt.slice(0, 10)}
                        </span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </details>
            </article>
          ))}
        </div>
      ) : (
        <p className="op-lead-empty">
          {query
            ? "No hay problemas seleccionados que coincidan con esta búsqueda."
            : "Todavía falta evidencia concreta y repetida para seleccionar un problema. El archivo sigue acumulándose automáticamente; no se inventa una oportunidad para llenar este espacio."}
        </p>
      )}
    </section>
  );
}
