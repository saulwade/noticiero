import {
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  Database,
  Clock3,
  RefreshCw,
} from "lucide-react";
import type { DashboardData } from "@/lib/types";
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
        </article>
      </div>
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
