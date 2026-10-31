"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronDown,
  FileUp,
  MessageSquare,
  Search,
} from "lucide-react";
import type {
  EvidenceData,
  EvidenceRecord,
  EvidenceReview,
  GroundedField,
  ProblemDossier,
} from "@/features/evidence/types";
import "./evidence-workspace.css";

type Decision = EvidenceReview["decision"];
type Notice = { kind: "success" | "error"; text: string };
type Filters = {
  query: string;
  country: string;
  language: string;
  kind: string;
};
const decisions: Record<Decision, string> = {
  useful: "Útil",
  rejected: "Mal clasificado / rechazar",
  duplicate: "Duplicado",
  "wrong-segment": "Segmento incorrecto",
};
const statuses: Record<ProblemDossier["status"], string> = {
  isolated: "Aislada",
  repeated: "Recurrente",
  contrasted: "Contrastada",
  validating: "En validación",
};
const kinds: Record<EvidenceRecord["kind"], string> = {
  community: "Comunidad",
  complaint: "Reclamación",
  statistic: "Estadística · contexto",
};
const sourceNames: Record<string, string> = {
  hn: "Hacker News",
  github: "GitHub público",
  cfpb: "CFPB · Estados Unidos",
  profeco: "PROFECO · importación CSV",
};
const fieldLabels: Record<keyof ProblemDossier["fields"], string> = {
  segment: "Quién tiene el problema",
  task: "Qué intenta hacer",
  obstacle: "Obstáculo",
  frequency: "Frecuencia observada",
  consequence: "Consecuencia",
  workaround: "Solución actual",
};
const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Mexico_City",
});

function date(value: string) {
  const parsed = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value,
  );
  return Number.isNaN(parsed.getTime())
    ? "Fecha desconocida"
    : dateFormatter.format(parsed);
}

function language(value: string) {
  return value === "es"
    ? "Español"
    : value === "en"
      ? "Inglés"
      : "Idioma desconocido";
}

function sourceUrl(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function download(content: Blob, filename: string) {
  const url = URL.createObjectURL(content);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function matching(
  record: EvidenceRecord,
  filters: Filters,
  includeQuery = true,
) {
  const query = filters.query.trim().toLocaleLowerCase("es");
  return (
    (!includeQuery ||
      !query ||
      `${record.title} ${record.quote} ${record.issue ?? ""} ${record.segment ?? ""}`
        .toLocaleLowerCase("es")
        .includes(query)) &&
    (!filters.country || (record.country ?? "unknown") === filters.country) &&
    (!filters.language || record.language === filters.language) &&
    (!filters.kind || record.kind === filters.kind)
  );
}

export function EvidenceWorkspace({
  data,
  demo,
  onRefresh,
  onProject,
}: {
  data: EvidenceData;
  demo: boolean;
  onRefresh: () => Promise<void>;
  onProject: (projectId: string) => void;
}) {
  const [tab, setTab] = useState<"problems" | "records" | "reports">(
    "problems",
  );
  const [filters, setFilters] = useState<Filters>({
    query: "",
    country: "",
    language: "",
    kind: "",
  });
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice>();
  const [csv, setCsv] = useState<{ filename: string; text: string }>();
  const [readingFile, setReadingFile] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileSelection = useRef(0);
  const countries = useMemo(
    () =>
      [
        ...new Set(
          data.records.flatMap((record) =>
            record.country ? [record.country] : [],
          ),
        ),
      ].sort(),
    [data.records],
  );
  const records = useMemo(
    () => data.records.filter((record) => matching(record, filters)),
    [data.records, filters],
  );
  const dossiers = useMemo(() => {
    const byId = new Map(data.records.map((record) => [record.id, record]));
    const query = filters.query.trim().toLocaleLowerCase("es");
    return data.dossiers.filter((dossier) => {
      const labelMatches = dossier.label
        .toLocaleLowerCase("es")
        .includes(query);
      return dossier.evidenceIds.some((id) => {
        const record = byId.get(id);
        return record && matching(record, filters, !labelMatches);
      });
    });
  }, [data.dossiers, data.records, filters]);
  const reviews = useMemo(
    () => new Map(data.reviews.map((review) => [review.id, review])),
    [data.reviews],
  );
  const hasFilters = Object.values(filters).some(Boolean);

  async function persist(
    payload: Record<string, unknown>,
    key: string,
    message: string,
  ) {
    if (demo || busy) return false;
    setBusy(key);
    setNotice(undefined);
    let saved = false;
    try {
      const response = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "No se pudo guardar. Intenta de nuevo.",
        );
      saved = true;
      if (payload.action === "project") {
        if (typeof result.projectId !== "string" || !result.projectId)
          throw new Error(
            "La investigación se guardó, pero no recibimos su identificador. Actualiza la página y revisa Entrevistas.",
          );
        onProject(result.projectId);
      } else {
        await onRefresh();
      }
      setNotice({
        kind: "success",
        text:
          payload.action === "import" && result.limited
            ? "Importación parcial: se alcanzó el límite de almacenamiento. Revisa la cobertura de PROFECO; el archivo anterior permanece intacto."
            : payload.action === "import" && typeof result.message === "string"
              ? result.message
              : message,
      });
      return true;
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          saved && payload.action !== "project"
            ? "Los cambios se guardaron, pero no pudimos actualizar la vista. Actualiza la página para verlos."
            : error instanceof Error
              ? error.message
              : "No se pudo guardar. Tus datos siguen aquí para reintentar.",
      });
      return saved;
    } finally {
      setBusy("");
    }
  }

  async function selectFile(file?: File) {
    const selection = ++fileSelection.current;
    setCsv(undefined);
    setReadingFile(false);
    setNotice(undefined);
    if (!file) return;
    if (file.size > 1_000_000) {
      setNotice({
        kind: "error",
        text: "El CSV supera 1 MB. Selecciona un archivo más pequeño.",
      });
      return;
    }
    setReadingFile(true);
    try {
      const text = await file.text();
      if (selection !== fileSelection.current) return;
      if (!text.trim()) throw new Error("El archivo está vacío.");
      if (new Blob([text]).size > 1_000_000)
        throw new Error("El contenido del CSV supera 1 MB.");
      setCsv({ filename: file.name, text });
    } catch (error) {
      if (selection === fileSelection.current)
        setNotice({
          kind: "error",
          text:
            error instanceof Error
              ? error.message
              : "No pudimos leer el archivo.",
        });
    } finally {
      if (selection === fileSelection.current) setReadingFile(false);
    }
  }

  async function exportResearch() {
    if (busy) return;
    setBusy("export");
    setNotice(undefined);
    try {
      const response = await fetch("/api/evidence/export");
      if (!response.ok)
        throw new Error(
          "No pudimos descargar la investigación. Intenta de nuevo.",
        );
      download(await response.blob(), "noticiero-evidencia.md");
      setNotice({
        kind: "success",
        text: "Investigación descargada en Markdown.",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "No pudimos descargar la investigación.",
      });
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="evidence-workspace" aria-label="Radar de evidencia">
      <header className="ev-heading">
        <div>
          <span className="ev-eyebrow">
            OBSERVAR · CONTRASTAR · ENTREVISTAR
          </span>
          <h1>
            Problemas reales.
            <br />
            <em>Preguntas mejores.</em>
          </h1>
          <p>
            Un radar de evidencia para decidir qué investigar. Cada hipótesis
            conserva sus citas, sus límites y un próximo paso.
          </p>
        </div>
        <button
          className="ev-button"
          onClick={() => void exportResearch()}
          disabled={Boolean(busy)}
        >
          <ArrowDownToLine size={15} />
          {busy === "export" ? "Descargando…" : "Exportar investigación"}
        </button>
      </header>

      {demo && (
        <p className="ev-notice">
          Vista de ejemplo · las revisiones, importaciones e investigaciones se
          guardan en tu espacio real.
        </p>
      )}
      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={`ev-notice ev-notice-${notice.kind}`}
        >
          {notice.text}
        </p>
      )}
      {data.storageLimited && (
        <p role="status" className="ev-notice">
          La ampliación del archivo está pausada por el límite de
          almacenamiento. La evidencia conservada sigue disponible.
        </p>
      )}

      <div className="ev-overview">
        <div>
          <strong>{data.dossiers.length}</strong>
          <span>problemas por investigar</span>
        </div>
        <div>
          <strong>{data.totalRecords}</strong>
          <span>registros conservados</span>
        </div>
        <div>
          <strong>
            {data.sources.filter((source) => source.status === "ok").length}
            <small> / {data.sources.length}</small>
          </strong>
          <span>fuentes con captura correcta</span>
        </div>
        <p>
          Más cobertura no significa más demanda.
          <br />
          Una cuenta pública tampoco demuestra intención de compra.
        </p>
      </div>

      <details className="ev-coverage">
        <summary>
          <span>Cobertura y estado de las fuentes</span>
          <ChevronDown size={15} />
        </summary>
        <p className="ev-muted">
          Muestra acotada. Un resultado vacío no confirma cobertura completa;
          los registros anteriores se conservan ante fallos.
        </p>
        <div className="ev-source-grid">
          {data.sources.map((source) => (
            <article key={source.id} className="ev-source">
              <div className="ev-row">
                <strong>{sourceNames[source.id] ?? source.id}</strong>
                <span className={`ev-badge ev-source-${source.status}`}>
                  {
                    {
                      ok: "Correcta",
                      error: "Error",
                      limited: "Limitada",
                      waiting: "En espera",
                    }[source.status]
                  }
                </span>
              </div>
              <p>{source.message}</p>
              <small>
                {source.count} registros en la última comprobación ·{" "}
                {date(source.checkedAt)}
              </small>
            </article>
          ))}
          {!data.sources.length && (
            <p className="ev-muted">Aún no hay comprobaciones de fuentes.</p>
          )}
        </div>
      </details>

      <div className="ev-tabs" role="group" aria-label="Vistas de evidencia">
        <button
          aria-pressed={tab === "problems"}
          onClick={() => setTab("problems")}
        >
          Problemas <span>{data.dossiers.length}</span>
        </button>
        <button
          aria-pressed={tab === "records"}
          onClick={() => setTab("records")}
        >
          Evidencia <span>{data.records.length}</span>
        </button>
        <button
          aria-pressed={tab === "reports"}
          onClick={() => setTab("reports")}
        >
          Balances semanales <span>{data.reports.length}</span>
        </button>
      </div>

      {tab !== "reports" && (
        <>
          <div className="ev-filters">
            <label className="ev-search">
              <Search size={15} />
              <input
                aria-label="Buscar problema o cita"
                placeholder="Buscar un problema o una cita…"
                value={filters.query}
                onChange={(event) =>
                  setFilters({ ...filters, query: event.target.value })
                }
              />
            </label>
            <label>
              <span>País sustentado</span>
              <select
                aria-label="País sustentado"
                value={filters.country}
                onChange={(event) =>
                  setFilters({ ...filters, country: event.target.value })
                }
              >
                <option value="">Todos los países</option>
                {countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
                <option value="unknown">País desconocido</option>
              </select>
            </label>
            <label>
              <span>Idioma</span>
              <select
                aria-label="Idioma"
                value={filters.language}
                onChange={(event) =>
                  setFilters({ ...filters, language: event.target.value })
                }
              >
                <option value="">Todos los idiomas</option>
                <option value="es">Español</option>
                <option value="en">Inglés</option>
                <option value="unknown">Desconocido</option>
              </select>
            </label>
            <label>
              <span>Tipo</span>
              <select
                aria-label="Tipo"
                value={filters.kind}
                onChange={(event) =>
                  setFilters({ ...filters, kind: event.target.value })
                }
              >
                <option value="">Toda la evidencia</option>
                {Object.entries(kinds).map(([kind, label]) => (
                  <option key={kind} value={kind}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="ev-result-line">
            <span>
              {tab === "problems"
                ? `${dossiers.length} problemas`
                : `${records.length} registros`}{" "}
              en esta vista
              {data.totalRecords > data.records.length
                ? ` · muestra de ${data.records.length} de ${data.totalRecords} registros conservados`
                : ""}
            </span>
            {hasFilters && (
              <button
                onClick={() =>
                  setFilters({ query: "", country: "", language: "", kind: "" })
                }
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </>
      )}

      {tab === "problems" && (
        <div className="ev-dossiers">
          {dossiers.map((dossier) => (
            <Dossier
              key={dossier.id}
              dossier={dossier}
              records={data.records.filter((record) =>
                dossier.evidenceIds.includes(record.id),
              )}
              reviews={reviews}
              disabled={demo || Boolean(busy)}
              busy={busy}
              onReview={(id, decision, note) =>
                persist(
                  { action: "review", id, decision, note },
                  `review:${id}`,
                  "Revisión guardada. Tu criterio queda vinculado a la evidencia.",
                )
              }
              onProject={() =>
                void persist(
                  { action: "project", dossierId: dossier.id },
                  `project:${dossier.id}`,
                  "Investigación lista en Entrevistas.",
                )
              }
            />
          ))}
          {!dossiers.length && (
            <Empty
              filtered={hasFilters}
              text="Todavía no hay problemas agrupados. Revisa la evidencia disponible y el estado de las fuentes para comenzar."
            />
          )}
        </div>
      )}

      {tab === "records" && (
        <div className="ev-record-list">
          {records.map((record) => (
            <Record
              key={record.id}
              record={record}
              review={reviews.get(record.id)}
              disabled={demo || Boolean(busy)}
              saving={busy === `review:${record.id}`}
              onReview={(decision, note) =>
                persist(
                  { action: "review", id: record.id, decision, note },
                  `review:${record.id}`,
                  "Revisión guardada. Tu criterio queda vinculado a la evidencia.",
                )
              }
            />
          ))}
          {!records.length && (
            <Empty
              filtered={hasFilters}
              text="Aún no hay evidencia capturada. Comprueba las fuentes o importa un CSV oficial de PROFECO."
            />
          )}
        </div>
      )}

      {tab === "reports" && (
        <div className="ev-reports">
          <p className="ev-muted">
            Compara publicaciones y capturas. La incorporación de un archivo
            histórico no demuestra un aumento reciente del problema.
          </p>
          {data.reports.map((report) => (
            <details className="ev-report" key={report.id}>
              <summary>
                <span>
                  <strong>
                    Balance del {date(report.from)} al {date(report.to)}
                  </strong>
                  <small>
                    Generado el {date(report.generatedAt)}
                    {report.provisional
                      ? " · Provisional: período en curso"
                      : ""}
                  </small>
                </span>
                <ChevronDown size={16} />
              </summary>
              <button
                className="ev-button"
                onClick={() =>
                  download(
                    new Blob([report.markdown], {
                      type: "text/markdown;charset=utf-8",
                    }),
                    `noticiero-balance-${report.from.slice(0, 10)}.md`,
                  )
                }
              >
                <ArrowDownToLine size={14} />
                Descargar balance
              </button>
              <pre>{report.markdown}</pre>
            </details>
          ))}
          {!data.reports.length && (
            <Empty text="El primer balance aparecerá después del cierre semanal. Mientras tanto, cada ficha muestra la actividad disponible de 7, 30 y 90 días." />
          )}
        </div>
      )}

      <details className="ev-import">
        <summary>
          <span>
            <FileUp size={16} />
            Importar evidencia de PROFECO
          </span>
          <ChevronDown size={15} />
        </summary>
        <p>
          Selecciona un CSV oficial de hasta 1 MB. Se validará su estructura y
          se conservarán las fechas originales y la atribución. Los datos
          históricos no cuentan como casos publicados hoy.
        </p>
        <p className="ev-muted">
          El archivo se lee en tu dispositivo. Solo se envía al pulsar «Importar
          CSV».
        </p>
        <p className="ev-muted">
          Hasta 500 filas con expediente, fecha de ingreso, proveedor y motivo
          de reclamación o giro. Fechas en formato AAAA-MM-DD o DD/MM/AAAA.
        </p>
        <div className="ev-import-controls">
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            aria-label="Archivo CSV oficial de PROFECO"
            disabled={demo || Boolean(busy) || readingFile}
            onChange={(event) => void selectFile(event.target.files?.[0])}
          />
          <button
            className="ev-button ev-primary"
            disabled={demo || Boolean(busy) || readingFile || !csv}
            onClick={async () => {
              if (!csv) return;
              const saved = await persist(
                { action: "import", csv: csv.text },
                "import",
                "CSV importado. La evidencia conserva sus fechas originales.",
              );
              if (saved) {
                setCsv(undefined);
                if (fileInput.current) fileInput.current.value = "";
              }
            }}
          >
            {readingFile
              ? "Leyendo archivo…"
              : busy === "import"
                ? "Importando…"
                : "Importar CSV"}
          </button>
        </div>
        {csv && (
          <small className="ev-muted">
            Listo para validar: {csv.filename}. Aún no se ha enviado.
          </small>
        )}
      </details>
    </section>
  );
}

function Empty({ filtered, text }: { filtered?: boolean; text: string }) {
  return (
    <div className="ev-empty">
      <span className="ev-eyebrow">EL PUNTO DE PARTIDA</span>
      <h3>
        {filtered
          ? "Sin coincidencias con estos filtros."
          : "La evidencia viene primero."}
      </h3>
      <p>
        {filtered
          ? "Prueba otro país, idioma o tipo de evidencia, o limpia los filtros para ver todo."
          : text}
      </p>
    </div>
  );
}

function Grounded({ label, field }: { label: string; field?: GroundedField }) {
  return (
    <div className="ev-grounded">
      <dt>{label}</dt>
      <dd>
        {field?.value || (
          <span className="ev-muted">Desconocido · falta evidencia</span>
        )}
        {field?.quote && <blockquote>«{field.quote}»</blockquote>}
      </dd>
    </div>
  );
}

function Dossier({
  dossier,
  records,
  reviews,
  disabled,
  busy,
  onReview,
  onProject,
}: {
  dossier: ProblemDossier;
  records: EvidenceRecord[];
  reviews: Map<string, EvidenceReview>;
  disabled: boolean;
  busy: string;
  onReview: (id: string, decision: Decision, note: string) => Promise<boolean>;
  onProject: () => void;
}) {
  return (
    <details className="ev-dossier">
      <summary>
        <div className="ev-dossier-title">
          <div className="ev-row">
            <span className={`ev-badge ev-status-${dossier.status}`}>
              {statuses[dossier.status]}
            </span>
            <span className="ev-muted">
              Última captura: {date(dossier.lastSeen)}
            </span>
          </div>
          <h2>{dossier.label}</h2>
          <p>
            {dossier.identifiedAuthors} autores identificados ·{" "}
            {dossier.anonymousCases} casos anónimos ·{" "}
            {dossier.evidenceIds.length} registros
          </p>
          <div className="ev-meta">
            <span>
              {dossier.countries.length
                ? dossier.countries.join(" · ")
                : "País desconocido"}
            </span>
            <span>
              {dossier.languages.length
                ? dossier.languages.map(language).join(" · ")
                : "Idioma desconocido"}
            </span>
          </div>
        </div>
        <ChevronDown className="ev-chevron" size={18} />
      </summary>
      <div className="ev-dossier-body">
        <p className="ev-muted">
          Primera captura: {date(dossier.firstSeen)} ·{" "}
          {dossier.sourceFamilies.length} familias de fuentes
          {dossier.sourceFamilies.length
            ? `: ${dossier.sourceFamilies.join(", ")}`
            : ""}
          . Los autores son cuentas públicas, no clientes verificados. Los
          indicadores agregados son contexto.
        </p>
        <section className="ev-block">
          <h3>Por qué aparece aquí</h3>
          {dossier.reasons.length ? (
            <ul>
              {dossier.reasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="ev-muted">Sin razones documentadas todavía.</p>
          )}
        </section>
        <section className="ev-block">
          <h3>Lo que sostiene la evidencia</h3>
          <dl className="ev-grounded-grid">
            {Object.entries(fieldLabels).map(([key, label]) => (
              <Grounded
                key={key}
                label={label}
                field={dossier.fields[key as keyof ProblemDossier["fields"]]}
              />
            ))}
          </dl>
        </section>
        <section className="ev-block">
          <h3>Actividad · publicación frente a captura</h3>
          <div className="ev-activity">
            {[7, 30, 90].map((days) => {
              const activity = dossier.activity.find(
                (item) => item.days === days,
              );
              return (
                <div key={days}>
                  <strong>{days} días</strong>
                  <span>
                    {activity ? activity.publishedCases : "—"} casos publicados
                  </span>
                  <small>
                    {activity ? activity.capturedCases : "—"} capturados en el
                    período
                  </small>
                </div>
              );
            })}
          </div>
          <p className="ev-muted">
            Un caso histórico capturado hoy conserva su fecha de publicación.
            «—» significa que no hay medición disponible.
          </p>
        </section>
        <div className="ev-two-col">
          <section className="ev-block">
            <h3>Alternativas y soluciones actuales</h3>
            {dossier.alternatives.length ? (
              <ul>
                {dossier.alternatives.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="ev-muted">
                No documentadas. Preguntar qué usan hoy y cuánto cuesta.
              </p>
            )}
          </section>
          <section className="ev-block">
            <h3>Contradicciones y límites</h3>
            {dossier.contradictions.length ? (
              <ul>
                {dossier.contradictions.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="ev-muted">
                Sin contradicciones capturadas. Su ausencia no confirma la
                hipótesis.
              </p>
            )}
          </section>
        </div>
        <section className="ev-hypothesis">
          <span className="ev-eyebrow">
            UNA HIPÓTESIS, POR COMPROBAR EN MÉXICO
          </span>
          <p>
            {dossier.mexicoHypothesis ||
              "La transferencia de este problema a México todavía debe comprobarse con evidencia local."}
          </p>
          <h3>Un experimento pequeño</h3>
          <p>
            {dossier.experiment ||
              "Definir un experimento con personas del segmento antes de construir."}
          </p>
          <h3>Preguntas para la entrevista</h3>
          {dossier.questions.length ? (
            <ol>
              {dossier.questions.map((question, index) => (
                <li key={index}>{question}</li>
              ))}
            </ol>
          ) : (
            <p>
              ¿Cuándo ocurrió por última vez? ¿Qué hiciste para resolverlo? ¿Qué
              consecuencia tuvo?
            </p>
          )}
          <button
            className="ev-button ev-primary"
            disabled={disabled}
            onClick={onProject}
          >
            <MessageSquare size={15} />
            {busy === `project:${dossier.id}`
              ? "Abriendo investigación…"
              : "Llevar a Entrevistas"}
            <ArrowUpRight size={14} />
          </button>
        </section>
        <section className="ev-block">
          <h3>Citas y revisión humana</h3>
          <p className="ev-muted">
            La revisión conserva ejemplos para evaluar las reglas. Cada decisión
            queda guardada; no implica entrenamiento automático.
          </p>
          <div className="ev-record-list">
            {records.map((record) => (
              <Record
                key={record.id}
                record={record}
                review={reviews.get(record.id)}
                disabled={disabled}
                saving={busy === `review:${record.id}`}
                onReview={(decision, note) =>
                  onReview(record.id, decision, note)
                }
              />
            ))}
            {records.length < dossier.evidenceIds.length && (
              <p className="ev-muted">
                Esta vista contiene {records.length} de los{" "}
                {dossier.evidenceIds.length} registros vinculados. Exporta la
                investigación para consultar el archivo disponible.
              </p>
            )}
          </div>
        </section>
      </div>
    </details>
  );
}

function Record({
  record,
  review,
  disabled,
  saving,
  onReview,
}: {
  record: EvidenceRecord;
  review?: EvidenceReview;
  disabled: boolean;
  saving: boolean;
  onReview: (decision: Decision, note: string) => Promise<boolean>;
}) {
  const href = sourceUrl(record.url);
  return (
    <article className="ev-record">
      <div className="ev-row">
        <span className="ev-badge">{kinds[record.kind]}</span>
        <span className="ev-muted">
          {record.sourceName}
          {record.historical ? " · Archivo histórico" : ""}
        </span>
      </div>
      <h4>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer">
            {record.title}
            <ArrowUpRight size={13} />
          </a>
        ) : (
          record.title
        )}
      </h4>
      <blockquote>
        {record.quote ? `«${record.quote}»` : "Sin cita textual disponible."}
      </blockquote>
      <div className="ev-record-facts">
        <span>
          {record.country ?? "País desconocido"}
          {record.countryBasis ? ` · ${record.countryBasis}` : ""}
        </span>
        <span>{language(record.language)}</span>
        <span>
          {record.kind === "statistic"
            ? "Indicador agregado · no cuenta como autor"
            : record.authorKey
              ? `Autor público: ${record.authorKey}`
              : "Caso sin identidad pública"}
        </span>
      </div>
      {(record.product || record.issue || record.segment) && (
        <p className="ev-muted">
          {[
            record.product && `Producto: ${record.product}`,
            record.issue && `Problema: ${record.issue}`,
            record.segment && `Segmento: ${record.segment}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <p className="ev-dates">
        Publicado:{" "}
        {date(
          record.kind === "complaint"
            ? record.occurredAt.slice(0, 10)
            : record.occurredAt,
        )}{" "}
        · Capturado: {date(record.capturedAt)}
      </p>
      <ReviewForm
        key={`${record.id}:${review?.at ?? "new"}`}
        id={record.id}
        review={review}
        disabled={disabled}
        saving={saving}
        onReview={onReview}
      />
    </article>
  );
}

function ReviewForm({
  id,
  review,
  disabled,
  saving,
  onReview,
}: {
  id: string;
  review?: EvidenceReview;
  disabled: boolean;
  saving: boolean;
  onReview: (decision: Decision, note: string) => Promise<boolean>;
}) {
  const [decision, setDecision] = useState<Decision>(
    review?.decision ?? "useful",
  );
  const [note, setNote] = useState(review?.note ?? "");
  return (
    <details className="ev-review">
      <summary>
        <span>
          {review ? (
            <>
              <Check size={13} />
              {decisions[review.decision]} · {date(review.at)}
            </>
          ) : (
            "Revisar esta evidencia"
          )}
        </span>
        <ChevronDown size={13} />
      </summary>
      {review?.note && (
        <p className="ev-saved-note">
          <strong>Nota guardada:</strong> {review.note}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onReview(decision, note);
        }}
      >
        <label htmlFor={`ev-decision-${id}`}>
          Clasificación
          <select
            id={`ev-decision-${id}`}
            aria-label="Clasificación"
            value={decision}
            disabled={disabled}
            onChange={(event) => setDecision(event.target.value as Decision)}
          >
            {Object.entries(decisions).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`ev-note-${id}`}>
          Nota de revisión
          <textarea
            id={`ev-note-${id}`}
            aria-label="Nota de revisión"
            value={note}
            maxLength={2000}
            rows={2}
            disabled={disabled}
            placeholder="Qué sostiene la cita, qué falta o por qué no corresponde…"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <button className="ev-button" disabled={disabled} type="submit">
          {saving ? "Guardando…" : "Guardar revisión"}
        </button>
      </form>
    </details>
  );
}
