"use client";
import {
  ArrowUpRight,
  Check,
  CircleHelp,
  ExternalLink,
  Rss,
  SlidersHorizontal,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  allSourceDefinitions,
  optionalSources,
} from "@/features/sources/registry";
import { relativeTime } from "@/lib/time";
import type { DashboardData } from "@/lib/types";

export function SourcesView({
  data,
  enabled,
  onToggle,
}: {
  data: DashboardData;
  enabled: Record<string, boolean>;
  onToggle: (id: string, value: boolean) => void;
}) {
  return (
    <div className="sources-view">
      <div className="section-title">
        <div>
          <span className="eyebrow">TU DIETA INFORMATIVA</span>
          <h2>
            Buenas fuentes.
            <br />
            <em>Mejores preguntas.</em>
          </h2>
          <p>
            Elige las voces que alimentan tu radar. Cada historia conserva su
            origen.
          </p>
        </div>
        <Rss size={44} strokeWidth={0.8} className="section-illustration" />
      </div>
      <div className="source-grid">
        {allSourceDefinitions.map((source) => {
          const state = data.sources.find((s) => s.id === source.id);
          const active = enabled[source.id] !== false;
          return (
            <article className="source-config-card" key={source.id}>
              <div className="source-config-top">
                <span
                  className="source-large-mark"
                  style={{
                    color: source.color,
                    background: `${source.color}12`,
                  }}
                >
                  {source.initials}
                </span>
                <button
                  className={`toggle-switch ${active ? "on" : ""}`}
                  role="switch"
                  aria-checked={active}
                  aria-label={`Activar ${source.name}`}
                  onClick={() => onToggle(source.id, !active)}
                >
                  <span />
                </button>
              </div>
              <h3>
                {source.name}
                <a
                  href={source.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir ${source.name}`}
                >
                  <ArrowUpRight size={14} />
                </a>
              </h3>
              <p>{source.description}</p>
              <div className={`source-status ${state?.status ?? "pending"}`}>
                <span className="status-dot" />
                {!active
                  ? "Desactivada"
                  : state?.status === "ok"
                    ? `${state.count} noticias · ${state.checkedAt ? relativeTime(state.checkedAt) : ""}`
                    : state?.status === "error"
                      ? "No disponible en el último intento"
                      : "Lista para consultar"}
              </div>
            </article>
          );
        })}
      </div>
      <div className="subsection-heading">
        <h3>Más señales, cuando las necesites</h3>
        <span>Próximas integraciones</span>
      </div>
      <div className="optional-source-list">
        {optionalSources.map((source) => (
          <div key={source.name}>
            <span className="optional-source-icon">
              <Rss size={15} />
            </span>
            <div>
              <strong>{source.name}</strong>
              <p>{source.description}</p>
              <small>{source.requirement}</small>
            </div>
            <span className="neutral-badge">Planeada</span>
          </div>
        ))}
      </div>
      <div className="notice-inline">
        <CircleHelp size={16} />
        <p>
          Las fuentes se consultan al actualizar. Un medio temporalmente no
          disponible no interrumpe el resto de tu edición. Los artículos de
          suscripción conservan sus condiciones de acceso.
        </p>
      </div>
    </div>
  );
}
export function SettingsView({ data }: { data: DashboardData }) {
  const cfg = data.configuration;
  const remaining = Math.max(0, cfg.monthlyBudget - cfg.spent);
  return (
    <div className="settings-view">
      <div className="section-title">
        <div>
          <span className="eyebrow">A TU MANERA</span>
          <h2>
            Un espacio para
            <br />
            <em>mantener la perspectiva.</em>
          </h2>
          <p>El dashboard está listo. Tú eliges qué conexiones activar.</p>
        </div>
        <SlidersHorizontal
          size={42}
          strokeWidth={1}
          className="section-illustration"
        />
      </div>
      <section className="settings-card">
        <div className="settings-heading">
          <Sparkles size={18} />
          <h3>Motor local de investigación</h3>
          <span className="connection-badge connected">
            {cfg.analysisMode === "api" ? "Modo API seleccionado" : "$0 en API"}
          </span>
        </div>
        <p>
          TF-IDF y similitud coseno agrupan términos; reglas explícitas detectan
          solicitudes, quejas y trabajo manual. Las hipótesis usan plantillas en
          español y conservan las citas originales. No hay un modelo generativo
          ni una API de pago en el modo local.
        </p>
        <p className="settings-hint">
          {data.research?.documentsTracked ?? 0} documentos en el corpus ·{" "}
          {data.research?.notes.length ?? 0} notas acumuladas. Los datos se
          guardan en tu base local. El equipo y la conexión deben estar
          disponibles para consultar fuentes.
        </p>
      </section>
      <section className="settings-card">
        <div className="settings-heading">
          <Sparkles size={18} />
          <h3>Resúmenes e ideas en español</h3>
          <span className={`connection-badge ${cfg.ai ? "connected" : ""}`}>
            {cfg.ai ? "Conectado" : "Por configurar"}
          </span>
        </div>
        <p>
          Opcional: para redactar o traducir resúmenes de forma generativa,
          conecta una API compatible con Chat Completions o un modelo local con
          Ollama. Sin esta conexión se muestran extractos en su idioma original.
          El cuaderno funciona sin ella.
        </p>
        <div className="config-code">
          <code>ANALYSIS_MODE=api</code>
          <code>LLM_BASE_URL</code>
          <code>LLM_MODEL</code>
          <code>LLM_API_KEY</code>
          <code>AI_INPUT_USD_PER_MILLION</code>
          <code>AI_OUTPUT_USD_PER_MILLION</code>
        </div>
        <p className="settings-hint">
          Configura estas variables en <code>.env.local</code> y reinicia el
          servidor. Las tarifas deben corresponder a tu modelo; para un modelo
          local gratuito pueden ser 0. Las suscripciones de chat y las APIs se
          contratan por separado.
        </p>
        {cfg.model ? (
          <span className="neutral-badge">Modelo: {cfg.model}</span>
        ) : null}
      </section>
      <section className="settings-card">
        <div className="settings-heading">
          <Wallet size={18} />
          <h3>Límite opcional para una API externa</h3>
        </div>
        <div className="budget-numbers">
          <div>
            <span>Reservado / utilizado</span>
            <strong>
              ${cfg.spent.toFixed(4)} <small>USD</small>
            </strong>
          </div>
          <div>
            <span>Límite configurado</span>
            <strong>
              ${cfg.monthlyBudget.toFixed(2)} <small>USD</small>
            </strong>
          </div>
        </div>
        <div className="budget-track">
          <span
            style={{
              width: `${Math.min(100, (cfg.spent / cfg.monthlyBudget) * 100)}%`,
            }}
          />
        </div>
        <p className="settings-hint">
          Este límite no es una suscripción ni un cargo mensual. En modo local
          no se utiliza. ${remaining.toFixed(2)} USD disponibles dentro del
          límite. Se reserva un máximo estimado antes de cada llamada. Configura
          también los controles de gasto de tu proveedor.
        </p>
      </section>
      <section className="settings-card">
        <div className="settings-heading">
          <ExternalLink size={18} />
          <h3>Contexto bursátil</h3>
          <span className={`connection-badge ${cfg.market ? "connected" : ""}`}>
            {cfg.market ? "Conectado" : "Por configurar"}
          </span>
        </div>
        <p>
          Cotizaciones reales de cierre con Alpha Vantage. Sin clave, verás las
          empresas relacionadas y un enlace a Yahoo Finance.
        </p>
        <div className="config-code">
          <code>ALPHA_VANTAGE_API_KEY</code>
        </div>
        <a
          className="inline-link"
          href="https://www.alphavantage.co/support/#api-key"
          target="_blank"
          rel="noopener noreferrer"
        >
          Obtener una clave de API
          <ArrowUpRight size={13} />
        </a>
      </section>
      <section className="settings-card">
        <div className="settings-heading">
          <Check size={18} />
          <h3>Recopilación y cierre del día</h3>
          <span className="neutral-badge">CDMX</span>
        </div>
        <div className="schedule-row">
          <span>
            {cfg.hosted ? "Recopilación en línea" : "Recopilación local"}
            <strong>{cfg.hosted ? "07:00 y 20:00 CDMX" : "Cada hora"}</strong>
          </span>
          <span>
            Cierre nocturno<strong>Desde 20:00</strong>
          </span>
        </div>
        <p className="settings-hint">
          {cfg.hosted
            ? "Dos tareas diarias de Vercel recopilan sin depender de tu laptop. En Hobby, la ejecución puede ocurrir dentro de la hora programada. Revisa los avisos en Estado y respaldos."
            : cfg.background
              ? "Servicio local activo: macOS mantiene el servidor y solicita una actualización cada hora. El cierre se guarda a partir de las 20:00 CDMX; si el equipo duerme, se recupera al volver a estar disponible. No recopila con el equipo apagado."
              : "Para activar el servidor y la recopilación en segundo plano en macOS, ejecuta npm run schedule:install. Los reportes usan la zona horaria de CDMX."}
        </p>
      </section>
      <div className="storage-note">
        <span className="status-dot" />
        <span>
          {cfg.storage === "local"
            ? "PostgreSQL local integrado · datos en .data/postgres"
            : "PostgreSQL externo conectado"}
        </span>
        <span>Claves protegidas en el servidor</span>
      </div>
    </div>
  );
}
