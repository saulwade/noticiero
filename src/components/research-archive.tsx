"use client";
import { useState } from "react";
import { Download, ArrowUpRight, MessageSquare } from "lucide-react";
import type { ResearchData } from "@/lib/types";
import { editionFor } from "@/lib/time";
export function ResearchArchive({
  research,
  query,
  onValidate,
  demo,
}: {
  research: ResearchData;
  query: string;
  onValidate?: (id: string, eventId?: string) => void;
  demo: boolean;
}) {
  const [days, setDays] = useState(3);
  const [observedNow] = useState(() => Date.now());
  const from = editionFor(new Date(observedNow - (days - 1) * 86400000)).date;
  const events = (research.history ?? []).filter(
    (event) =>
      (days === 0 || editionFor(new Date(event.at)).date >= from) &&
      `${event.idea.title} ${event.idea.problem}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const observations = (research.observations ?? []).filter(
    (item) =>
      (days === 0 || editionFor(new Date(item.at)).date >= from) &&
      `${item.title} ${item.keywords.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="automatic-archive">
      <p className="research-explanation">
        Este archivo se llena solo al actualizar las noticias. Conserva
        oportunidades nuevas y revisiones con su evidencia, aunque no las hayas
        leído ni marcado como favoritas. Las capturas históricas se conservan;
        una hipótesis puede quedar superada al mejorar los criterios actuales.
      </p>
      <div className="archive-tools">
        <label>
          Actividad de{" "}
          <select
            aria-label="Periodo del archivo automático"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            <option value={1}>Hoy</option>
            <option value={3}>Últimos 3 días</option>
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={0}>Todo el archivo</option>
          </select>
        </label>
        {!demo ? (
          <a
            className="small-button"
            href={`/api/research/brief?days=${days || 90}`}
          >
            <Download size={14} />
            Descargar investigación {days || 90} días
          </a>
        ) : null}
      </div>
      <p className="settings-hint">
        La descarga reúne señales, palabras clave, notas, revisiones y reportes
        del periodo. La exportación admite hasta 90 días por archivo.
      </p>
      <details className="context-observations">
        <summary>
          Temas y palabras clave de las noticias · {observations.length}{" "}
          documentos
        </summary>
        <p className="research-explanation">
          Este contexto también se conserva automáticamente. Un tema frecuente o
          una noticia financiera todavía requiere investigar una necesidad
          concreta.
        </p>
        {observations.map((item) => (
          <article className="archive-event" key={item.id}>
            <div className="detail-topline">
              <span className="eyebrow">{item.category} · CONTEXTO</span>
              <time>{editionFor(new Date(item.at)).date}</time>
            </div>
            <h3>{item.title}</h3>
            <div className="idea-tags">
              {item.keywords.map((keyword) => (
                <span key={keyword}>{keyword}</span>
              ))}
            </div>
            <p>{item.excerpt}</p>
            <a
              className="inline-link"
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.sourceName}
              <ArrowUpRight size={13} />
            </a>
          </article>
        ))}
      </details>
      {events.length ? (
        events.map((event) => (
          <article className="archive-event" key={event.id}>
            {event.currentAssessment === "superseded" ? (
              <p className="research-explanation">
                Hipótesis histórica superada por los filtros actuales; no es una
                oportunidad activa.
              </p>
            ) : null}
            <div className="detail-topline">
              <span className="eyebrow">
                {event.kind === "discovered"
                  ? "OPORTUNIDAD NUEVA"
                  : "EVIDENCIA ACTUALIZADA"}
              </span>
              <time>
                {new Date(event.at).toLocaleString("es-MX", {
                  timeZone: "America/Mexico_City",
                })}
              </time>
            </div>
            <h3>{event.idea.title}</h3>
            <p>{event.idea.problem}</p>
            <details>
              <summary>Ver hipótesis y evidencia de este momento</summary>
              <p>{event.idea.proposal}</p>
              {event.idea.evidence.map((item, index) => (
                <div key={index}>
                  {item.quote ? (
                    <blockquote>{item.quote}</blockquote>
                  ) : (
                    <p>{item.reason}</p>
                  )}
                  {item.url ? (
                    <a
                      className="inline-link"
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.sourceName ?? "Abrir evidencia"}
                      <ArrowUpRight size={12} />
                    </a>
                  ) : null}
                </div>
              ))}
            </details>
            {onValidate ? (
              <button
                className="small-button"
                onClick={() => onValidate(event.opportunityId, event.id)}
              >
                <MessageSquare size={14} />
                Preparar entrevistas
              </button>
            ) : null}
          </article>
        ))
      ) : (
        <div className="workspace-empty">
          <h3>El archivo empieza con evidencia.</h3>
          <p>
            No hay descubrimientos o revisiones en este periodo. Las señales
            aisladas siguen guardándose en el cuaderno.
          </p>
        </div>
      )}
    </div>
  );
}
