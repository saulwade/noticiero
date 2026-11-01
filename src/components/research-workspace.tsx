"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Download,
  FileText,
  Layers,
  RefreshCw,
  Sprout,
} from "lucide-react";
import type { DashboardData, ResearchSignal, SavedItem } from "@/lib/types";
import { editionFor } from "@/lib/time";
import { ResearchArchive } from "./research-archive";
import { OpportunityResearchDigest } from "./opportunity-research-digest";

export function ResearchWorkspace({
  data,
  query,
  children,
  onNote,
  onReport,
  onValidate,
}: {
  data: DashboardData;
  query: string;
  children: React.ReactNode;
  onNote: (id: string, note: string, state: SavedItem["state"]) => void;
  onReport: () => Promise<void>;
  onValidate?: (id: string, eventId?: string) => void;
}) {
  const [tab, setTab] = useState<"ideas" | "notes" | "reports" | "archive">(
    "ideas",
  );
  const [generating, setGenerating] = useState(false);
  const research = data.research ?? {
    notes: [],
    signals: [],
    reports: [],
    documentsTracked: 0,
  };
  const notes = research.notes.filter((note) =>
    `${note.label} ${note.keywords.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  async function generate() {
    setGenerating(true);
    try {
      await onReport();
    } finally {
      setGenerating(false);
    }
  }
  return (
    <div className="research-workspace">
      <div className="local-engine-strip">
        <span>
          <Sprout size={15} />
          {data.configuration.analysisMode === "api"
            ? "Modo API externo"
            : "Motor local · sin costo de API"}
        </span>
        <span>
          {research.documentsTracked} documentos en el corpus ·{" "}
          {research.signals.length}{" "}
          {research.signals.length === 1
            ? "señal acumulada"
            : "señales acumuladas"}
        </span>
      </div>
      <p className="research-explanation auto-save-explanation">
        Señales, palabras clave e hipótesis se conservan automáticamente en cada
        actualización. El cierre nocturno añade el reporte del día. Guardar solo
        destaca tus favoritos.
      </p>
      <div
        className="research-tabs"
        role="group"
        aria-label="Secciones de investigación"
      >
        <button
          className={tab === "ideas" ? "active" : ""}
          onClick={() => setTab("ideas")}
        >
          <Layers size={14} />
          Oportunidades
        </button>
        <button
          className={tab === "notes" ? "active" : ""}
          onClick={() => setTab("notes")}
        >
          <BookOpen size={14} />
          Cuaderno de señales<span>{research.notes.length}</span>
        </button>
        <button
          className={tab === "reports" ? "active" : ""}
          onClick={() => setTab("reports")}
        >
          <FileText size={14} />
          Reportes nocturnos<span>{research.reports.length}</span>
        </button>
        <button
          className={tab === "archive" ? "active" : ""}
          onClick={() => setTab("archive")}
        >
          <Layers size={14} />
          Archivo automático
          <span>
            {(research.history?.length ?? 0) +
              (research.observations?.length ?? 0)}
          </span>
        </button>
      </div>
      {tab === "ideas" ? (
        <>
          <OpportunityResearchDigest data={data.evidence} query={query} />
          {data.opportunities.length ? children : null}
          {!data.opportunities.length ? (
            <button className="notebook-invite" onClick={() => setTab("notes")}>
              Las señales aisladas también cuentan. Abrir el cuaderno
              <ArrowUpRight size={14} />
            </button>
          ) : null}
        </>
      ) : tab === "archive" ? (
        <ResearchArchive
          research={research}
          query={query}
          onValidate={onValidate}
          demo={data.demo}
        />
      ) : tab === "notes" ? (
        <div className="research-notes">
          <p className="research-explanation">
            Las observaciones se agrupan por tarea, producto y segmento
            explícito y se conservan entre días. Las citas de otras personas no
            cuentan como experiencias propias. Una cuenta pública no es un
            cliente verificado. Puedes guardar tus propias preguntas y
            siguientes pasos en cada nota.
          </p>
          {notes.length ? (
            notes.map((note) => (
              <article className="research-note" key={note.id}>
                <div className="research-note-heading">
                  <div>
                    <span className="eyebrow">
                      DESDE{" "}
                      {new Date(note.firstSeen).toLocaleDateString("es-MX", {
                        timeZone: "America/Mexico_City",
                      })}
                    </span>
                    <h3>{note.label}</h3>
                  </div>
                  <span
                    className={`neutral-badge ${note.status === "repeated" ? "repeated-badge" : ""}`}
                  >
                    {note.status === "repeated"
                      ? "Patrón por investigar"
                      : "Señal aislada"}
                  </span>
                </div>
                <div className="research-keywords">
                  {note.keywords.map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                </div>
                <p className="research-counts">
                  {note.signalIds.length}{" "}
                  {note.signalIds.length === 1
                    ? "observación"
                    : "observaciones"}{" "}
                  · {note.independentVoices}{" "}
                  {note.independentVoices === 1
                    ? "autor público identificado"
                    : "autores públicos identificados"}
                </p>
                <div className="signal-list">
                  {research.signals
                    .filter((signal) => note.signalIds.includes(signal.id))
                    .slice(-5)
                    .map((signal) => (
                      <SignalQuote signal={signal} key={signal.id} />
                    ))}
                </div>
                <details className="research-journal">
                  <summary>Cómo ha evolucionado esta nota</summary>
                  {note.journal.map((entry) => (
                    <p key={entry.date}>
                      <time>{entry.date}</time>
                      <span>
                        +{entry.added} observaciones · {entry.totalVoices}{" "}
                        autores acumulados
                      </span>
                    </p>
                  ))}
                </details>
                <NoteEditor
                  id={note.id}
                  saved={data.saved.find((item) => item.id === note.id)}
                  onSave={(text, state) => onNote(note.id, text, state)}
                />
              </article>
            ))
          ) : (
            <div className="research-empty">
              <BookOpen size={26} />
              <h3>El cuaderno crece con la evidencia</h3>
              <p>
                Ask HN y las respuestas públicas alimentan este espacio al
                actualizar. Si no hay quejas o solicitudes explícitas, no
                inventamos notas.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="nightly-reports">
          <div className="report-controls">
            <p>
              El cierre se guarda automáticamente por la noche, a partir de las
              20:00 CDMX. También puedes generar un corte con lo observado hasta
              ahora.
            </p>
            <button
              className="small-button"
              onClick={() => void generate()}
              disabled={generating || data.demo}
            >
              <RefreshCw size={13} className={generating ? "spinning" : ""} />
              {generating ? "Preparando" : "Generar reporte de hoy"}
            </button>
          </div>
          {research.reports.length ? (
            research.reports.map((report) => (
              <article className="daily-report" key={report.date}>
                <div className="report-heading">
                  <div>
                    <span className="eyebrow">
                      {report.provisional
                        ? "CORTE PROVISIONAL"
                        : "CIERRE NOCTURNO"}
                    </span>
                    <h3>{report.date}</h3>
                  </div>
                  <a
                    className="small-button"
                    href={`/api/research/reports/${report.date}`}
                    download
                  >
                    <Download size={13} />
                    Exportar
                  </a>
                </div>
                <p className="report-summary">
                  {report.documentCount} documentos incorporados ·{" "}
                  {report.newSignals} señales nuevas · {report.themes.length}{" "}
                  temas con observaciones
                </p>
                <details className="report-details">
                  <summary>Leer reporte</summary>
                  {report.news?.length ? (
                    <>
                      <h4>Noticias de la jornada</h4>
                      {report.news.map((item) => (
                        <section key={item.url}>
                          <h4>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {item.title}
                              <ArrowUpRight size={12} />
                            </a>
                          </h4>
                          <p>{item.excerpt}</p>
                          <small>
                            {item.sourceName} · extracto en su idioma original
                          </small>
                        </section>
                      ))}
                    </>
                  ) : null}
                  <h4>Señales de problemas</h4>
                  {report.themes.length ? (
                    report.themes.map((theme) => (
                      <section key={theme.noteId}>
                        <h4>{theme.label}</h4>
                        <p>
                          {theme.voices} autores públicos identificados en{" "}
                          {theme.signals} observaciones acumuladas al corte.
                        </p>
                        {theme.evidence?.map((signal) => (
                          <SignalQuote signal={signal} key={signal.id} />
                        ))}
                      </section>
                    ))
                  ) : (
                    <p>
                      No hubo evidencia suficiente para destacar nuevos
                      patrones. Las fuentes consultadas no representan todo el
                      mercado.
                    </p>
                  )}
                  <h4>Hipótesis para validar</h4>
                  {report.hypotheses?.length ? (
                    report.hypotheses.map((idea) => (
                      <section key={idea.id}>
                        <h4>{idea.title}</h4>
                        <p>{idea.proposal}</p>
                        <p>
                          <strong>Primer experimento:</strong> {idea.experiment}
                        </p>
                      </section>
                    ))
                  ) : (
                    <p>
                      No se publican hipótesis sin repetición suficiente de
                      señales.
                    </p>
                  )}
                  <h4>Qué significa “aprendió”</h4>
                  <p>
                    El sistema actualizó las frecuencias de términos de su
                    corpus y agrupó señales parecidas. Utiliza reglas y
                    plantillas auditables. No entrenó un modelo de lenguaje ni
                    verificó disposición a pagar.
                  </p>
                  <p className="research-limit">
                    Fuentes consultadas:{" "}
                    {report.sourceNames.join(", ") ||
                      "Sin documentos incorporados en este corte"}
                    . Las citas conservan el idioma original.
                  </p>
                </details>
              </article>
            ))
          ) : (
            <div className="research-empty">
              <FileText size={27} />
              <h3>Tu archivo de cierres nocturnos</h3>
              <p>
                Aquí quedará guardado qué se observó cada día, qué se repitió y
                qué preguntas conviene investigar.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function SignalQuote({ signal }: { signal: ResearchSignal }) {
  return (
    <div className="signal-evidence">
      <span className="signal-kind">
        {signal.kind === "request"
          ? "BUSCA UNA SOLUCIÓN"
          : signal.kind === "pain"
            ? "DESCRIBE FRICCIÓN"
            : "SOLUCIÓN MANUAL"}
      </span>
      <blockquote>{signal.quote}</blockquote>
      <a href={signal.url} target="_blank" rel="noopener noreferrer">
        {signal.sourceName}
        {signal.author ? ` · ${signal.author}` : ""}
        <ArrowUpRight size={12} />
      </a>
      <span className="signal-date">
        Publicado {editionFor(new Date(signal.occurredAt)).date} · observado{" "}
        {editionFor(new Date(signal.detectedAt)).date}
      </span>
    </div>
  );
}
function NoteEditor({
  id,
  saved,
  onSave,
}: {
  id: string;
  saved?: SavedItem;
  onSave: (text: string, state: SavedItem["state"]) => void;
}) {
  const [text, setText] = useState(saved?.note ?? "");
  const [state, setState] = useState<SavedItem["state"]>(
    saved?.state ?? "explore",
  );
  return (
    <div className="idea-notes research-annotation">
      <label htmlFor={`research-${id}`}>Tus notas y siguientes preguntas</label>
      <textarea
        id={`research-${id}`}
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={4000}
        rows={3}
        placeholder="¿Quién lo vive? ¿Qué alternativa usa? ¿Qué tendría que comprobar?"
      />
      <div>
        <select
          aria-label="Estado de la investigación"
          value={state}
          onChange={(event) =>
            setState(event.target.value as SavedItem["state"])
          }
        >
          <option value="explore">Por explorar</option>
          <option value="validating">Validando</option>
          <option value="dismissed">Descartada</option>
        </select>
        <button className="small-button" onClick={() => onSave(text, state)}>
          Guardar nota
        </button>
      </div>
    </div>
  );
}
