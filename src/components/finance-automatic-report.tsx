import { ArrowUpRight, ChevronRight } from "lucide-react";
import type {
  AutomaticAllocation,
  AutomationReport,
  AutomationWorkspace,
} from "@/features/finance/automatic-types";
import type { FinanceData } from "@/features/finance/types";

function money(value: string | undefined) {
  if (value === undefined || !Number.isFinite(Number(value)))
    return "Pendiente";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number(value));
}
// The report uses fractions for weights and historical risk; scenario returns use percentage points.
function fraction(value: number | undefined) {
  return value === undefined
    ? "Pendiente"
    : `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(value * 100)} %`;
}
function date(value: string) {
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("es-MX", {
        dateStyle: "medium",
        timeZone: "America/Mexico_City",
      }).format(parsed)
    : "Fecha pendiente";
}
function Allocation({
  items,
  showAmounts = true,
}: {
  items: AutomaticAllocation[];
  showAmounts?: boolean;
}) {
  return (
    <ul className="fi-auto-allocation">
      {items.map((item) => (
        <li key={item.symbol}>
          <div className="fi-auto-asset">
            <strong>{item.symbol}</strong>
            <span>{item.name}</span>
          </div>
          <strong>
            {showAmounts ? money(item.amountMxn) : fraction(item.weight)}
            {showAmounts ? <small>{fraction(item.weight)}</small> : null}
          </strong>
          <div className="fi-auto-bar" aria-hidden="true">
            <i
              style={{
                width: `${Math.max(0, Math.min(100, item.weight * 100))}%`,
              }}
            />
          </div>
          <p>{item.reason}</p>
          <small>
            {showAmounts && item.quantity !== undefined
              ? `${item.quantity} títulos de referencia · `
              : ""}
            {item.priceSession
              ? `Precio del ${date(item.priceSession)} · `
              : ""}
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
              Fuente del instrumento <ArrowUpRight size={11} />
            </a>
          </small>
        </li>
      ))}
    </ul>
  );
}

export function FinanceAutomationStatus({
  automation,
  demo,
}: {
  automation?: AutomationWorkspace;
  demo: boolean;
}) {
  const status = automation?.status ?? "pending";
  const report = automation?.current;
  return (
    <div className={`fi-auto-status fi-auto-status-${status}`} role="status">
      <span className="fi-auto-status-dot" aria-hidden="true" />
      <div>
        <strong>
          {demo
            ? "Vista de ejemplo · sin informe privado"
            : status === "ready"
              ? "Informe automático disponible"
              : status === "stale"
                ? "Informe anterior · pendiente de actualizar"
                : status === "error"
                  ? "La última actualización no se completó"
                  : status === "not-configured"
                    ? "Perfil privado pendiente de configuración"
                    : "Informe automático en preparación"}
        </strong>
        <p>
          {demo
            ? "Aquí aparecerá tu propuesta calculada. Esta vista no contiene inversiones ni importes personales."
            : (automation?.message ??
              "El cálculo diario se prepara en segundo plano. No necesitas completar tareas de investigación.")}
        </p>
        {automation?.staleReason ? <p>{automation.staleReason}</p> : null}
        {report ? (
          <small>
            Informe del {date(report.asOf)} ·{" "}
            {automation?.lastSuccess
              ? `Último cálculo ${date(automation.lastSuccess)}`
              : `Motor ${report.engineVersion}`}
          </small>
        ) : null}
        {report && status !== "ready" ? (
          <p>
            Los importes de este informe son una referencia anterior, pendiente
            de validación con los datos actuales.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function FinanceAutomaticPortfolio({ data }: { data: FinanceData }) {
  const report = data.automation?.current;
  const hasMovements = (data.counts?.movements ?? data.movements.length) > 0;
  return (
    <div className="fi-auto-portfolio">
      {hasMovements ? (
        <>
          <div className="fi-overview" aria-label="Cartera real registrada">
            <div>
              <span>
                {data.summary.complete
                  ? "Valor real registrado"
                  : "Valor conocido · parcial"}
              </span>
              <strong>
                {money(
                  data.summary.complete
                    ? data.summary.valueMxn
                    : data.summary.knownValueMxn,
                )}
              </strong>
              <small>MXN · referencias al {date(data.summary.asOf)}</small>
            </div>
            <div>
              <span>Dinero aportado</span>
              <strong>{money(data.summary.contributionsMxn)}</strong>
              <small>Los depósitos no son ganancias</small>
            </div>
            <div>
              <span>Resultado acumulado</span>
              <strong>{money(data.summary.pnlMxn)}</strong>
              <small>Con costos y retenciones registrados</small>
            </div>
          </div>
          <details className="fi-disclosure">
            <summary>
              Distribución actual registrada <ChevronRight size={14} />
            </summary>
            <ul className="fi-distribution">
              {data.summary.allocation.map((item, i) => (
                <li key={`${item.label}-${i}`}>
                  <span>{item.label}</span>
                  <strong>{money(item.valueMxn)}</strong>
                  <small>
                    {item.weight === undefined
                      ? "Peso pendiente"
                      : `${item.weight.toFixed(2)} %`}
                  </small>
                </li>
              ))}
            </ul>
            <p className="fi-footnote">
              Solo incluye movimientos reales conservados en tu historial.
            </p>
          </details>
        </>
      ) : null}
      {report ? (
        <article className="fi-auto-proposal" aria-label="Cartera propuesta">
          <div className="fi-auto-proposal-heading">
            <div>
              <span className="fi-eyebrow">
                {hasMovements
                  ? "DISTRIBUCIÓN PROPUESTA · SEPARADA DE TU CARTERA REAL"
                  : "TU CARTERA PROPUESTA"}
              </span>
              <h2>
                {hasMovements
                  ? "Pesos objetivo para comparar."
                  : report.status === "provisional"
                    ? "Un punto de partida para revisar."
                    : "Una distribución con propósito."}
              </h2>
            </div>
            {!hasMovements ? (
              <div className="fi-auto-budget">
                <span>Capital de la propuesta</span>
                <strong>{money(report.initial.budgetMxn)}</strong>
                <small>MXN · aún no es una inversión ejecutada</small>
              </div>
            ) : null}
          </div>
          {report.status === "insufficient-data" ? (
            <p className="fi-auto-caution">
              Distribución preliminar con datos insuficientes. Revisa los
              límites del informe antes de aprobar o ejecutar una operación.
            </p>
          ) : null}
          {report.status === "provisional" ? (
            <p className="fi-auto-caution">
              Propuesta provisional: falta confirmar tu tolerancia al riesgo.
              Esta distribución no está aprobada.
            </p>
          ) : null}
          <Allocation
            items={report.initial.items}
            showAmounts={!hasMovements}
          />
          <p className="fi-footnote">
            {hasMovements
              ? "Estos pesos son una referencia para comparar con tu distribución actual; no implican vender ni reinvertir tu cartera. La siguiente aportación se calcula por separado con dinero nuevo previsto."
              : `Remanente para costos o redondeo: ${money(report.initial.cashRemainderMxn)}. Los precios y cantidades son referencias; no se crean compras ni posiciones con esta propuesta.`}
          </p>
        </article>
      ) : (
        <div className="fi-auto-awaiting">
          <span className="fi-eyebrow">LA PROPUESTA APARECERÁ AQUÍ</span>
          <h2>
            {hasMovements
              ? "Tu cartera real ya tiene contexto."
              : "Una distribución antes de la primera compra."}
          </h2>
          <p>
            El informe calculará importes, pesos y la siguiente aportación con
            el perfil privado y los datos disponibles. Los saldos reales
            aparecen únicamente cuando hay operaciones registradas.
          </p>
        </div>
      )}
      {data.policy?.targets.length ? (
        <details className="fi-disclosure">
          <summary>
            Objetivo guardado anteriormente <ChevronRight size={14} />
          </summary>
          <ul>
            {data.policy.targets.map((target) => (
              <li key={target.instrumentId}>
                {data.instruments.find(
                  (item) => item.id === target.instrumentId,
                )?.symbol ?? target.instrumentId}
                : {target.weight.toFixed(2)} %
              </li>
            ))}
          </ul>
          <p className="fi-footnote">
            {data.policy.approved
              ? "Política aprobada"
              : "Política guardada sin aprobación"}{" "}
            · {date(data.policy.updatedAt)}. El informe automático no modifica
            esta política.
          </p>
        </details>
      ) : null}
      {data.summary.warnings.length ? (
        <details className="fi-disclosure">
          <summary>
            Datos de la cartera por revisar{" "}
            <span>{data.summary.warnings.length}</span>
            <ChevronRight size={14} />
          </summary>
          <ul>
            {data.summary.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function ReportDetails({ report }: { report: AutomationReport }) {
  return (
    <>
      <article className="fi-auto-conclusion">
        <span className="fi-eyebrow">QUÉ HACER HOY</span>
        <h2>{report.headline}</h2>
        <p>{report.conclusion}</p>
        <span className="fi-auto-action">
          {
            {
              prepare: "Preparar la propuesta",
              maintain: "Mantener",
              contribute: "Revisar la aportación",
              "review-risk": "Revisar el riesgo",
              wait: "Esperar mejores datos",
            }[report.action]
          }
        </span>
        <ol>
          {report.reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ol>
      </article>
      <article className="fi-panel fi-auto-contribution">
        <div className="fi-auto-proposal-heading">
          <div>
            <span className="fi-eyebrow">LA SIGUIENTE APORTACIÓN</span>
            <h2>Repartir {money(report.contribution.budgetMxn)}</h2>
            <p>{report.contribution.reason}</p>
          </div>
          <small>Revisión {date(report.nextReview.contribution)}</small>
        </div>
        <Allocation items={report.contribution.items} />
        <p className="fi-footnote">
          Remanente: {money(report.contribution.cashRemainderMxn)}. Es dinero
          nuevo previsto, sujeto a que esté disponible; no reutiliza
          automáticamente el efectivo registrado. Confirma moneda, comisiones y
          cambio real con tu intermediario antes de ejecutar.
        </p>
      </article>
      <section
        className="fi-auto-news"
        aria-label="Impacto de noticias en la cartera"
      >
        <details className="fi-disclosure fi-auto-news-disclosure">
          <summary>
            <div>
              <h2>Contexto para la decisión.</h2>
              <p>
                {report.news.length
                  ? `${report.news.length} ${report.news.length === 1 ? "noticia relevante" : "noticias relevantes"} · fuentes y mecanismos`
                  : "Sin noticias relevantes para este informe"}
              </p>
            </div>
            <ChevronRight size={14} />
          </summary>
          <div className="fi-auto-news-content">
            {report.news.length ? (
              report.news.map((news) => (
                <article key={news.id}>
                  <h3>{news.title}</h3>
                  <p>{news.mechanism}</p>
                  <p>{news.implication}</p>
                  <a href={news.url} target="_blank" rel="noopener noreferrer">
                    {news.sourceName} <ArrowUpRight size={11} />
                  </a>
                  <small> · {date(news.publishedAt)}</small>
                </article>
              ))
            ) : (
              <p>
                No se identificó una noticia con un mecanismo relevante para
                este informe.
              </p>
            )}
            <p className="fi-footnote">
              El impacto es una hipótesis condicional. Una noticia no prueba
              causalidad ni predice rendimientos. El feed completo está en Mi
              briefing.
            </p>
          </div>
        </details>
      </section>
      <section
        className="fi-auto-risk"
        aria-label="Riesgo y escenarios condicionales"
      >
        <span className="fi-eyebrow">RIESGO Y ESCENARIOS</span>
        <h2>Qué podría pasar.</h2>
        <p>
          Escenarios condicionales, no pronósticos. La inversión puede perder
          valor y una caída puede prolongarse. Las métricas describen una
          distribución hipotética con los pesos propuestos; no son el
          rendimiento de tus movimientos reales.
        </p>
        <div className="fi-auto-metrics">
          <div>
            <span>Volatilidad histórica anualizada</span>
            <strong>{fraction(report.risk.annualizedVolatility)}</strong>
          </div>
          <div>
            <span>Caída máxima histórica</span>
            <strong>{fraction(report.risk.maximumDrawdown)}</strong>
          </div>
          <div>
            <span>Rendimiento acumulado de la muestra</span>
            <strong>{fraction(report.risk.historicalReturn)}</strong>
          </div>
        </div>
        <p className="fi-footnote">
          {report.risk.observations} observaciones semanales
          {report.risk.from && report.risk.to
            ? ` · ${date(report.risk.from)} a ${date(report.risk.to)}`
            : ""}
          . Los resultados históricos no garantizan resultados futuros.
        </p>
        <div className="fi-auto-scenarios">
          {report.scenarios.map((scenario) => (
            <article key={scenario.label}>
              <h3>{scenario.label}</h3>
              <strong>{money(scenario.endValueMxn)}</strong>
              <small>
                {scenario.returnPercent.toFixed(1)} % en este supuesto
              </small>
              <p>{scenario.assumption}</p>
            </article>
          ))}
        </div>
        {report.projections.length ? (
          <details className="fi-disclosure">
            <summary>
              Proyecciones condicionales a largo plazo{" "}
              <ChevronRight size={14} />
            </summary>
            <p className="fi-footnote">
              Rangos sujetos a los supuestos del método, no promesas de
              recuperación ni rendimientos esperados seguros.
            </p>
            {report.projections.map((projection) => (
              <article className="fi-auto-projection" key={projection.years}>
                <h3>A {projection.years} años</h3>
                <dl>
                  <div>
                    <dt>Rango inferior</dt>
                    <dd>{money(projection.lowerMxn)}</dd>
                  </div>
                  <div>
                    <dt>Mediana del escenario</dt>
                    <dd>{money(projection.medianMxn)}</dd>
                  </div>
                  <div>
                    <dt>Rango superior</dt>
                    <dd>{money(projection.upperMxn)}</dd>
                  </div>
                </dl>
                <p>{projection.method}</p>
                <p className="fi-footnote">{projection.caveat}</p>
              </article>
            ))}
          </details>
        ) : null}
        <ul>
          {[...report.risk.caveats, ...report.warnings].map((warning, i) => (
            <li key={i}>{warning}</li>
          ))}
        </ul>
      </section>
      <div className="fi-auto-review">
        <strong>Próxima revisión</strong>
        <p>
          Datos: {date(report.nextReview.daily)} · Aportación:{" "}
          {date(report.nextReview.contribution)} · Estrategia:{" "}
          {date(report.nextReview.strategy)}
        </p>
        <ul>
          {report.nextReview.triggers.map((trigger, i) => (
            <li key={i}>{trigger}</li>
          ))}
        </ul>
      </div>
      <details className="fi-disclosure">
        <summary>
          Método, datos y alternativas <ChevronRight size={14} />
        </summary>
        <p className="fi-footnote">
          Informe {report.id} · Motor {report.engineVersion} ·{" "}
          {date(report.asOf)}
        </p>
        <ul>
          {report.methodology.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p className="fi-footnote">
          Covarianza: {report.risk.covarianceMethod}. Concentración:{" "}
          {fraction(report.risk.concentration)}.
        </p>
        {report.risk.riskContributions.length ? (
          <ul>
            {report.risk.riskContributions.map((item) => (
              <li key={item.symbol}>
                {item.symbol}: {fraction(item.share)} del riesgo estimado
              </li>
            ))}
          </ul>
        ) : null}
        {report.alternatives.map((alternative, i) => (
          <article key={i}>
            <h3>{alternative.label}</h3>
            <p>{alternative.rationale}</p>
            <p>
              {alternative.weights
                .map((item) => `${item.symbol} ${fraction(item.weight)}`)
                .join(" · ")}
            </p>
          </article>
        ))}
      </details>
    </>
  );
}

export function FinanceAutomaticAnalysis({
  automation,
}: {
  automation?: AutomationWorkspace;
}) {
  return (
    <div className="fi-auto-analysis">
      {automation?.current ? (
        <ReportDetails report={automation.current} />
      ) : (
        <div className="fi-auto-awaiting">
          <h2>El análisis diario se conserva automáticamente.</h2>
          <p>
            Cuando el informe esté disponible, aquí verás la acción propuesta,
            sus razones, la siguiente aportación y los riesgos. No hace falta
            escribir una tesis ni completar un diario.
          </p>
        </div>
      )}
      <details className="fi-disclosure">
        <summary>
          Historial automático de análisis{" "}
          <span>{automation?.totalReports ?? 0}</span>
          <ChevronRight size={14} />
        </summary>
        {automation?.history.some(
          (report) => report.id !== automation.current?.id,
        ) ? (
          automation.history
            .filter((report) => report.id !== automation.current?.id)
            .map((report) => (
              <details className="fi-compact" key={report.id}>
                <summary>
                  {date(report.asOf)} · {report.headline}
                </summary>
                <p className="fi-footnote">
                  Informe histórico; conserva la información conocida al
                  calcularlo.
                </p>
                <ReportDetails report={report} />
              </details>
            ))
        ) : (
          <p className="fi-hint">
            El informe más reciente aparece arriba. Aquí se conservarán los
            cálculos anteriores.
          </p>
        )}
      </details>
      <details className="fi-disclosure">
        <summary>
          Cómo funciona la revisión <ChevronRight size={14} />
        </summary>
        <p className="fi-hint">
          Los datos y el informe se revisan diariamente; la aportación, cada
          mes; la estrategia, cada trimestre o ante un cambio relevante. Leer el
          informe no exige operar. Noticiero no importa movimientos del broker
          ni ejecuta órdenes. Solo una operación real debe entrar en
          Movimientos.
        </p>
      </details>
    </div>
  );
}
