import { ChevronRight } from "lucide-react";
import type {
  FinanceMarketStatus,
  FinanceSyncState,
} from "@/features/finance/types";

const stateNames: Record<FinanceSyncState["status"], string> = {
  running: "Consultando",
  ok: "Referencia guardada",
  error: "Por revisar",
  configuration: "Falta configurar",
  manual: "Registro manual",
};
function day(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(value) ? "UTC" : "America/Mexico_City",
  }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
}
function rate(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0
    ? new Intl.NumberFormat("es-MX", {
        maximumFractionDigits: 4,
        minimumFractionDigits: 2,
      }).format(n)
    : "Pendiente";
}

export function FinanceDailyStatus({
  market,
  demo,
}: {
  market?: FinanceMarketStatus;
  demo: boolean;
}) {
  const fx = market?.sources.find((source) => source.id === "fx:USD/MXN");
  return (
    <article className="fi-daily" aria-label="Referencias financieras diarias">
      <div className="fi-daily-heading">
        <div>
          <span className="fi-eyebrow">DATOS PARA OBSERVAR</span>
          <h2>Referencias diarias</h2>
        </div>
        <div className="fi-daily-fx">
          <span>USD/MXN · pesos por dólar</span>
          <strong>{fx?.value ? rate(fx.value) : "Pendiente"}</strong>
          <small>
            {fx?.asOf
              ? `Referencia del ${day(fx.asOf)}`
              : "Sin referencia guardada"}
          </small>
          {fx?.status === "error" ? (
            <span className="fi-daily-pending">
              Última consulta por revisar
            </span>
          ) : fx?.status === "running" ? (
            <span>Consulta en curso</span>
          ) : null}
        </div>
      </div>
      <p className="fi-hint">
        {demo
          ? "La vista de ejemplo no consulta precios ni tipos de cambio."
          : "Las tareas programadas guardan referencias de cierre y tipo de cambio. Abrir esta pantalla solo lee lo guardado."}
      </p>
      {!demo && !market?.alphaVantageConfigured ? (
        <p className="fi-daily-pending">
          Cotizaciones pendientes de conexión: falta configurar una clave
          gratuita de Alpha Vantage. El tipo de cambio usa Frankfurter y no
          necesita clave.
        </p>
      ) : !demo ? (
        <p className="fi-hint">
          Clave de cotizaciones configurada. Cada instrumento muestra abajo el
          resultado de su consulta; configurar la clave no confirma su
          cobertura.
        </p>
      ) : null}
      <details className="fi-compact">
        <summary>
          Fuentes, fechas y cobertura <ChevronRight size={13} />
        </summary>
        <p className="fi-hint">
          Alpha Vantage: cierres de acciones y ETFs en USD de los mercados
          estadounidenses admitidos. BMV/SIC, instrumentos en MXN y bonos
          conservan referencias manuales. Son datos diarios para seguimiento; el
          precio de una operación se confirma con tu intermediario.
        </p>
        {market?.expectedPriceSession ? (
          <p className="fi-hint">
            Última sesión de cierre esperada: {day(market.expectedPriceSession)}
            . Festivos y fines de semana pueden conservar el cierre anterior.
          </p>
        ) : null}
        {market?.sources.length ? (
          <ul className="fi-daily-sources">
            {market.sources.map((source) => (
              <li key={source.id}>
                <div>
                  <strong>{source.label}</strong>
                  <span
                    className={
                      source.status === "error" ? "fi-daily-pending" : ""
                    }
                  >
                    {stateNames[source.status]}
                  </span>
                </div>
                <small>
                  {source.provider}
                  {source.asOf ? ` · dato del ${day(source.asOf)}` : ""}
                  {source.lastSuccess
                    ? ` · última confirmación ${day(source.lastSuccess)}`
                    : ""}
                  {source.lastAttempt
                    ? ` · último intento ${day(source.lastAttempt)}`
                    : ""}
                </small>
                <p>{source.message}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="fi-hint">
            Aún no hay un ciclo financiero registrado. Los instrumentos se
            consultarán cuando los agregues a seguimiento, sin crear compras.
          </p>
        )}
        <p className="fi-footnote">
          Frankfurter publica una referencia diaria combinada. No es el FIX de
          Banxico ni el tipo de cambio que ejecuta tu intermediario. Una
          referencia guardada se conserva si falla la siguiente consulta; revisa
          su fecha y estado antes de usarla.
        </p>
      </details>
    </article>
  );
}

export function FinanceProcessGuide() {
  return (
    <details className="fi-disclosure fi-process">
      <summary>
        Cómo usar tu portafolio <ChevronRight size={14} />
      </summary>
      <ol>
        <li>
          <strong>Primero, el diseño.</strong>
          <p>
            Acordamos tu objetivo, horizonte, liquidez necesaria y cuánto riesgo
            puedes asumir. Después comparamos instrumentos y definimos una
            distribución. Puedes explorar este espacio antes de registrar
            dinero.
          </p>
        </li>
        <li>
          <strong>Después, las operaciones reales.</strong>
          <p>
            Tú haces la transferencia y las compras con tu intermediario.
            Registras o importas el comprobante con títulos, precio, cambio y
            costos reales. Noticiero no importa movimientos del broker ni
            ejecuta órdenes; los precios de referencia se actualizan por
            separado.
          </p>
        </li>
        <li>
          <strong>Una rutina de seguimiento.</strong>
          <p>
            Los datos diarios sirven para observar. Cada mes revisamos tu nueva
            aportación, los pesos objetivo y los costos antes de decidir su
            destino. Una revisión trimestral de la estrategia puede ser un punto
            de partida; se adelanta si cambian tus necesidades o los supuestos
            de inversión. Leer noticias no exige comprar o vender cada día.
          </p>
        </li>
      </ol>
    </details>
  );
}
