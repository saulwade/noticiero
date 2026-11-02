import {
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  Database,
  Clock3,
  RefreshCw,
} from "lucide-react";
import type { DashboardData } from "@/lib/types";
import {
  DATABASE_REFERENCE_BYTES,
  MAX_EVIDENCE_BYTES,
  MAX_EVIDENCE_RECORDS,
} from "@/features/storage/capacity";
const date = (at?: string) =>
  at
    ? new Date(at).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })
    : "Sin confirmar";
export function OperationsView({
  data,
  onRefresh,
}: {
  data: DashboardData;
  onRefresh: () => void;
}) {
  const ops = data.operations;
  const repository = ops?.repository;
  const capacity = ops?.capacity;
  const archive = ops?.backup?.archive;
  const archiveUrl =
    archive?.url &&
    /^https:\/\/github\.com\/saulwade\/noticiero-ops\/releases\/tag\/history-\d{4}-\d{2}$/.test(
      archive.url,
    )
      ? archive.url
      : undefined;
  const mb = (bytes: number) =>
    (bytes / 1_000_000).toLocaleString("es-MX", { maximumFractionDigits: 1 });
  const safeRepo =
    repository && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository)
      ? repository
      : undefined;
  return (
    <section className="operations-view">
      <div className="workspace-heading">
        <span className="eyebrow">TU ESPACIO, CUIDADO</span>
        <h1>
          El pulso de tu espacio.
          <br />
          <em>Todo a la vista.</em>
        </h1>
        <p>Actualizaciones, respaldo independiente y avisos de recuperación.</p>
      </div>
      <div className="workspace-actions">
        <button
          className="small-button"
          onClick={onRefresh}
          disabled={data.demo}
        >
          <RefreshCw size={14} />
          Actualizar estado
        </button>
      </div>
      {!data.configuration.hosted ? (
        <p className="workspace-notice">
          Estás en la versión local. Los respaldos automáticos protegen la base
          de la versión en línea. La base local se conserva por separado.
        </p>
      ) : null}
      <div className="operations-grid">
        <article className="operations-card">
          <Clock3 size={20} />
          <span className="eyebrow">ÚLTIMA ACTUALIZACIÓN COMPLETADA</span>
          <strong>{date(ops?.lastSuccessfulUpdate)}</strong>
          <p>
            En línea: mañana entre 07:00–07:59 y noche entre 20:00–20:59 CDMX.
          </p>
        </article>
        <article className="operations-card">
          <Database size={20} />
          <span className="eyebrow">RESPALDO AUTOMÁTICO</span>
          <strong>
            {ops?.backup?.status === "completed"
              ? date(ops.backup.at)
              : ops?.backup?.status === "failed"
                ? "Último intento fallido"
                : "Pendiente de confirmación"}
          </strong>
          <p>
            Copia diaria cifrada, con siete días de retención en el repositorio
            privado de operaciones.
          </p>
          {ops?.backup?.bytes ? (
            <small>
              {(ops.backup.bytes / 1024 / 1024).toFixed(2)} MB cifrados ·{" "}
              {Object.values(ops.backup.counts ?? {}).reduce(
                (a, b) => a + b,
                0,
              )}{" "}
              registros
            </small>
          ) : null}
          {safeRepo && ops?.backup?.runId && /^\d+$/.test(ops.backup.runId) ? (
            <a
              className="inline-link"
              href={`https://github.com/${safeRepo}/actions/runs/${ops.backup.runId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver respaldo en GitHub
              <ArrowUpRight size={13} />
            </a>
          ) : null}
          <p aria-label="Estado del archivo histórico">
            {archive?.status === "completed"
              ? "Archivo histórico comprimido y cifrado: copia verificada por descarga."
              : "Archivo histórico: pendiente de una copia verificada."}{" "}
            Se conserva por separado, sin expiración programada. La base
            mantiene todo su historial.
          </p>
          {archive?.status === "completed" && archiveUrl ? (
            <a
              className="inline-link"
              href={archiveUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver archivo privado <ArrowUpRight size={13} />
            </a>
          ) : null}
        </article>
        <article
          className="operations-card"
          aria-label="Capacidad de almacenamiento"
        >
          <Database size={20} />
          <span className="eyebrow">ESPACIO Y CONSERVACIÓN</span>
          <strong>
            {capacity
              ? `${mb(capacity.databaseBytes)} MB en la base principal`
              : "Medición pendiente"}
          </strong>
          {capacity ? (
            <small>
              {capacity.evidenceRecords.toLocaleString("es-MX")} /{" "}
              {MAX_EVIDENCE_RECORDS.toLocaleString("es-MX")} versiones de
              evidencia · {mb(capacity.evidenceBytes)} /{" "}
              {mb(MAX_EVIDENCE_BYTES)} MB
            </small>
          ) : null}
          <p>
            Referencia de la base: {mb(DATABASE_REFERENCE_BYTES)} MB. Avisos al
            70% y 85% de cada margen. No se elimina contenido ni se cambia de
            plan automáticamente.
          </p>
          <small>
            Medición de la base principal; no incluye otras ramas ni consumo de
            procesamiento o transferencia del proveedor.
          </small>
        </article>
      </div>
      <p
        className="research-explanation"
        aria-label="Estado de la investigación automática"
      >
        Investigación automática · último análisis guardado:{" "}
        {date(data.research?.updatedAt)}. Las señales, palabras clave y reportes
        se conservan en segundo plano. No necesitas abrir una sección ni
        rellenar formularios; los revisamos en conversación cuando lo pidas.
      </p>
      <section className="operations-alerts">
        <h2>
          {ops?.alerts.length ? (
            <AlertCircle size={18} />
          ) : (
            <ShieldCheck size={18} />
          )}
          Avisos activos <span>{ops?.alerts.length ?? 0}</span>
        </h2>
        {ops?.alerts.length ? (
          ops.alerts.map((alert) => (
            <article key={alert.id}>
              <span className="status-dot" />
              <div>
                <strong>{alert.message}</strong>
                <p>Detectado {date(alert.firstSeen)}</p>
              </div>
            </article>
          ))
        ) : (
          <p className="research-explanation">
            No hay problemas activos detectados. El monitor independiente
            comprueba también que la app responda y que lleguen las ediciones
            esperadas.
          </p>
        )}
      </section>
      <div className="operations-footer">
        <p>
          Los fallos abren una incidencia privada en GitHub, sin incluir notas
          ni credenciales. Al recuperarse, el aviso se resuelve. La recepción
          por correo depende de tus preferencias de GitHub.
        </p>
        {safeRepo ? (
          <a
            className="inline-link"
            href={`https://github.com/${safeRepo}/issues`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir avisos de GitHub
            <ArrowUpRight size={14} />
          </a>
        ) : (
          <p>
            El repositorio de operaciones todavía no está configurado en este
            entorno.
          </p>
        )}
        <p>
          Restaurar requiere el archivo cifrado y la clave de recuperación. La
          restauración solo admite una base vacía; nunca sobrescribe tu espacio
          actual.
        </p>
      </div>
    </section>
  );
}
