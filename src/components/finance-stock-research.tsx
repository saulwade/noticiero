import { ArrowUpRight, ChevronRight } from "lucide-react";
import type { StockResearchReport } from "@/features/finance/stock-types";
function day(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeZone: "America/Mexico_City",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}
function number(value: number, ratio = false) {
  return (
    new Intl.NumberFormat("es-MX", {
      maximumFractionDigits: ratio ? 1 : 0,
    }).format(value * (ratio ? 100 : 1)) + (ratio ? " %" : " USD")
  );
}
export function FinanceStockResearch({
  report,
}: {
  report?: StockResearchReport;
}) {
  if (!report) return null;
  return (
    <section
      className="fi-stock-research"
      aria-label="Investigación automática de empresas relacionadas"
    >
      <details className="fi-disclosure">
        <summary>
          <div>
            <h2>Más allá del titular.</h2>
            <p>
              {report.analyses.length} empresas en investigación · relaciones y
              fundamentos
            </p>
          </div>
          <ChevronRight size={14} />
        </summary>
        <p className="fi-hint">
          Se prepara automáticamente. Aquí investigamos posibles exposiciones;
          estas acciones no forman parte de tu cartera propuesta.
        </p>
        {report.context.candidates.map((candidate) => {
          const analysis = report.analyses.find(
            (a) => a.symbol === candidate.symbol,
          );
          if (!analysis) return null;
          return (
            <article className="fi-stock-card" key={candidate.symbol}>
              <div className="fi-stock-heading">
                <div>
                  <span className="fi-eyebrow">
                    {candidate.origin === "related"
                      ? "EXPOSICIÓN INDIRECTA DOCUMENTADA"
                      : "EMPRESA MENCIONADA"}
                  </span>
                  <h3>
                    {candidate.name} <small>{candidate.symbol}</small>
                  </h3>
                </div>
                <span className="fi-stock-status">
                  {analysis.status === "available"
                    ? "Fundamentos y estadística"
                    : analysis.status === "partial"
                      ? "Evidencia parcial"
                      : "Datos pendientes"}
                </span>
              </div>
              {candidate.links.map((link) => (
                <div className="fi-stock-link" key={link.id}>
                  <strong>
                    {link.fromName} → {candidate.name}
                  </strong>
                  <p>{link.description}</p>
                  <p>{link.mechanism}</p>
                  <p className="fi-footnote">Contraste: {link.counterpoint}</p>
                  <a
                    href={link.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Relación documentada · {day(link.sourceDate)}{" "}
                    <ArrowUpRight size={11} />
                  </a>
                </div>
              ))}
              {analysis.metrics.length ? (
                <dl className="fi-stock-metrics">
                  {analysis.metrics.map((metric) => (
                    <div key={metric.key}>
                      <dt>{metric.label}</dt>
                      <dd>{number(metric.value, metric.unit === "ratio")}</dd>
                      <small>
                        {metric.period.split(" / ")[0] ===
                        metric.period.split(" / ")[1]
                          ? `Cierre fiscal ${metric.period.split(" / ")[0]}`
                          : metric.period}
                      </small>
                    </div>
                  ))}
                </dl>
              ) : null}
              {analysis.statistics ? (
                <div className="fi-stock-statistics">
                  <strong>Comportamiento histórico en MXN</strong>
                  <p>
                    Volatilidad anualizada{" "}
                    {number(analysis.statistics.annualizedVolatility, true)} ·
                    caída máxima{" "}
                    {number(analysis.statistics.maximumDrawdown, true)} ·
                    retorno acumulado{" "}
                    {number(analysis.statistics.cumulativeReturn, true)}
                  </p>
                  <small>
                    {analysis.statistics.observations} retornos semanales ·{" "}
                    {day(analysis.statistics.from)} a{" "}
                    {day(analysis.statistics.to)}. Cierres ajustados y FX
                    histórico; no es pronóstico.
                  </small>
                </div>
              ) : null}
              <ul>
                {analysis.findings.map((finding) => (
                  <li key={finding}>{finding}</li>
                ))}
              </ul>
              <details className="fi-compact">
                <summary>Fuentes y qué falta comprobar</summary>
                {candidate.events.map((event) => (
                  <p key={event.id}>
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {event.title} <ArrowUpRight size={11} />
                    </a>
                    <small>
                      {" "}
                      · {event.sourceName} · {day(event.publishedAt)}
                    </small>
                  </p>
                ))}
                <ul>
                  {analysis.questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
                {candidate.facts ? (
                  <>
                    <p className="fi-footnote">
                      {candidate.facts.source} · captura{" "}
                      {day(candidate.facts.capturedAt)}. Cada cifra conserva
                      período y fecha de presentación.
                    </p>
                    {[
                      ...new Map(
                        analysis.metrics
                          .flatMap((metric) =>
                            metric.factIndexes.map(
                              (index) =>
                                [
                                  ...candidate.facts!.facts,
                                  ...(candidate.facts!.comparisonFacts ?? []),
                                ][index],
                            ),
                          )
                          .filter(Boolean)
                          .map((fact) => [fact.url, fact]),
                      ).values(),
                    ].map((fact) => (
                      <p key={fact.url}>
                        <a
                          href={fact.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {fact.filedKind === "observed"
                            ? "Fuente del proveedor · observado"
                            : "Documento SEC · presentado"}{" "}
                          {day(fact.filed)} <ArrowUpRight size={11} />
                        </a>
                      </p>
                    ))}
                    <ul>
                      {candidate.facts.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </details>
            </article>
          );
        })}
        {!report.analyses.length ? (
          <p>
            No hay emisores del universo inicial vinculados a los eventos
            disponibles. El archivo sigue acumulando noticias.
          </p>
        ) : null}
        <p className="fi-footnote">{report.caveat}</p>
        <ul className="fi-footnote">
          {report.context.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
