"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Plus,
  Wallet,
} from "lucide-react";
import type {
  FinanceData,
  Instrument,
  MovementKind,
} from "@/features/finance/types";
import { editionFor } from "@/lib/time";
import {
  FinanceDailyStatus,
  FinanceProcessGuide,
} from "./finance-daily-status";
import "./finance-workspace.css";

const movementNames: Record<MovementKind, string> = {
  deposit: "Aportación",
  withdrawal: "Retiro",
  buy: "Compra",
  sell: "Venta",
  dividend: "Dividendo",
  interest: "Interés",
  fee: "Comisión",
  tax: "Retención",
  exchange: "Conversión de moneda",
  split: "Split",
};
const kindNames = { stock: "Acción", etf: "ETF", bond: "Deuda" };
const csvHeader =
  "date,kind,symbol,exchange,currency,quantity,price,amount,fee,fxRate,note,reference";

function money(value: string | undefined, currency = "MXN") {
  if (value === undefined) return "Pendiente";
  const n = Number(value);
  return Number.isFinite(n)
    ? new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(n)
    : "Pendiente";
}
function percent(value: number | undefined) {
  return value === undefined ? "—" : `${value.toFixed(2)} %`;
}
function date(value: string) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : editionFor(new Date(value)).date;
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${day}T12:00:00Z`));
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="fi-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}
function Text({
  label,
  name,
  required = false,
  type = "text",
  defaultValue,
  hint,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        aria-label={label}
        name={name}
        required={required}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={type === "url" ? 2000 : 500}
      />
    </Field>
  );
}
function Decimal({
  label,
  name,
  required = false,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        aria-label={label}
        name={name}
        inputMode="decimal"
        pattern="[0-9]+([.][0-9]{1,8})?"
        required={required}
        defaultValue={defaultValue}
        placeholder="0.00"
        maxLength={28}
      />
    </Field>
  );
}
function LongText({
  label,
  name,
  required = false,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <textarea
        aria-label={label}
        name={name}
        required={required}
        defaultValue={defaultValue}
        rows={3}
        maxLength={12000}
      />
    </Field>
  );
}
function InstrumentSelect({
  instruments,
  required = true,
  label = "Instrumento",
  empty = "Selecciona un instrumento",
  onChange,
}: {
  instruments: Instrument[];
  required?: boolean;
  label?: string;
  empty?: string;
  onChange?: (id: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        aria-label={label}
        name="instrumentId"
        required={required}
        defaultValue=""
        onChange={(e) => onChange?.(e.target.value)}
      >
        <option value="">{empty}</option>
        {instruments.map((i) => (
          <option key={i.id} value={i.id}>
            {i.symbol} · {i.exchange} · {i.currency}
          </option>
        ))}
      </select>
    </Field>
  );
}
const emptyData = (): FinanceData => ({
  instruments: [],
  movements: [],
  marks: [],
  theses: [],
  decisions: [],
  research: [],
  summary: {
    asOf: editionFor().date,
    complete: true,
    cash: { MXN: "0", USD: "0" },
    knownValueMxn: "0",
    valueMxn: "0",
    contributionsMxn: "0",
    withdrawalsMxn: "0",
    pnlMxn: "0",
    positions: [],
    warnings: [],
    allocation: [],
    proposal: {
      status: "blocked",
      label: "Primero, una política",
      reason:
        "Define y aprueba una distribución antes de simular tu próxima aportación.",
      amountMxn: "0",
      items: [],
      missing: [],
    },
    performance: {
      reason: "El rendimiento aparecerá cuando haya historial suficiente.",
    },
  },
});

export function FinanceWorkspace({ demo }: { demo: boolean }) {
  const [data, setData] = useState<FinanceData | undefined>(
    demo ? emptyData : undefined,
  );
  const [tab, setTab] = useState<
    "summary" | "movements" | "research" | "journal"
  >("summary");
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const [busy, setBusy] = useState(false);
  const [showMovement, setShowMovement] = useState(false);
  const [movementKind, setMovementKind] = useState<MovementKind>("deposit");
  const [movementCurrency, setMovementCurrency] = useState("MXN");
  const [markKind, setMarkKind] = useState("price");
  const [csv, setCsv] = useState("");
  const [csvName, setCsvName] = useState("");
  const [readingCsv, setReadingCsv] = useState(false);
  const csvSelection = useRef(0);
  const [reference, setReference] = useState("");

  const reload = useCallback(async () => {
    if (demo) return;
    const response = await fetch("/api/finance", { cache: "no-store" });
    if (!response.ok)
      throw new Error("No pudimos consultar tu portafolio. Intenta de nuevo.");
    setData(await response.json());
  }, [demo]);
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    void fetch("/api/finance", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "No pudimos consultar tu portafolio. Intenta de nuevo.",
          );
        const result: FinanceData = await response.json();
        if (!controller.signal.aborted) setData(result);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setNotice({ text: error.message, error: true });
      });
    return () => controller.abort();
  }, [demo]);

  async function post(action: string, payload: Record<string, unknown>) {
    if (demo || busy) return false;
    setBusy(true);
    setNotice(undefined);
    try {
      const response = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(
            Object.entries(payload).filter(([, value]) => value !== ""),
          ),
          action,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "No se pudo guardar. Revisa los campos.",
        );
      await reload();
      setNotice({ text: result.message ?? "Guardado." });
      return true;
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : "No se pudo guardar.",
        error: true,
      });
      return false;
    } finally {
      setBusy(false);
    }
  }
  function fields(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    ) as Record<string, string>;
  }
  async function download() {
    if (demo || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/finance/export", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("No pudimos exportar el portafolio.");
      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = href;
      link.download = "noticiero-portafolio.md";
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      setNotice({
        text: "Portafolio exportado. El archivo contiene información privada.",
      });
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : "No se pudo exportar.",
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }
  const disabled = demo || busy;
  const instruments = data?.instruments ?? [];
  const instrument = (id: string) => instruments.find((i) => i.id === id);

  return (
    <section className="finance-workspace" aria-label="Portafolio personal">
      <div className="fi-heading">
        <div>
          <span className="fi-eyebrow">OBSERVAR · ENTENDER · DECIDIR</span>
          <h1>
            Tu dinero.
            <br />
            <em>Con perspectiva.</em>
          </h1>
          <p>
            Lo que aportas, lo que cambia y las razones detrás de cada decisión.
          </p>
        </div>
        <div className="fi-heading-actions">
          <button
            className="fi-button"
            disabled={disabled || !data}
            onClick={() => void download()}
          >
            <ArrowDownToLine size={13} /> Exportar
          </button>
          <button
            className="fi-button fi-primary"
            disabled={disabled || !data}
            onClick={() => {
              setTab("movements");
              setShowMovement(true);
              setReference(crypto.randomUUID());
            }}
          >
            <Plus size={14} /> Registrar movimiento
          </button>
        </div>
      </div>
      {demo ? (
        <p className="fi-hint">
          Vista de ejemplo sin saldos personales. El registro y las consultas
          externas están desactivados.
        </p>
      ) : null}
      {notice ? (
        <p
          role={notice.error ? "alert" : "status"}
          className={`fi-notice ${notice.error ? "fi-error" : ""}`}
        >
          {notice.text}
        </p>
      ) : null}
      {!data ? (
        <div className="fi-empty">
          <Wallet size={28} strokeWidth={1.2} />
          <h2>
            {notice?.error
              ? "El portafolio está pendiente."
              : "Preparando tu espacio…"}
          </h2>
          {notice?.error ? (
            <button
              className="fi-button"
              onClick={() =>
                void reload().catch((error) =>
                  setNotice({ text: error.message, error: true }),
                )
              }
            >
              Reintentar
            </button>
          ) : (
            <p>Consultando registros privados.</p>
          )}
        </div>
      ) : (
        <>
          <div className="fi-overview">
            <div>
              <span>
                {data.summary.complete
                  ? "Valor del portafolio"
                  : "Valor conocido · parcial"}
              </span>
              <strong>
                {money(
                  data.summary.complete
                    ? data.summary.valueMxn
                    : data.summary.knownValueMxn,
                )}
              </strong>
              <small>MXN · {date(data.summary.asOf)}</small>
            </div>
            <div>
              <span>Dinero aportado</span>
              <strong>{money(data.summary.contributionsMxn)}</strong>
              <small>Los depósitos no son ganancias</small>
            </div>
            <div>
              <span>Resultado acumulado</span>
              <strong>{money(data.summary.pnlMxn)}</strong>
              <small>Con los costos y retenciones registrados</small>
            </div>
          </div>
          <div
            className="fi-tabs"
            role="group"
            aria-label="Vistas del portafolio"
          >
            {(
              [
                ["summary", "Resumen"],
                ["movements", "Movimientos"],
                ["research", "Investigar"],
                ["journal", "Diario"],
              ] as const
            ).map(([id, title]) => (
              <button
                key={id}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                {title}
              </button>
            ))}
          </div>
          {"viewLimited" in data && data.viewLimited ? (
            <p className="fi-hint">
              Ves una muestra del archivo. Los totales usan todos los
              movimientos; Exportar incluye el historial completo.
            </p>
          ) : null}
          {tab === "summary" ? (
            <>
              {data.summary.warnings.length ? (
                <details className="fi-disclosure fi-warning">
                  <summary>
                    Datos por revisar{" "}
                    <span>{data.summary.warnings.length}</span>
                    <ChevronRight size={14} />
                  </summary>
                  <ul>
                    {data.summary.warnings.map((text, i) => (
                      <li key={i}>{text}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {!data.movements.length ? (
                <div className="fi-welcome">
                  <Wallet size={28} strokeWidth={1.2} />
                  <div>
                    <h2>Primero diseñamos tu portafolio.</h2>
                    <p>
                      Puedes explorar la herramienta sin registrar dinero.
                      Cuando acordemos una distribución, registraremos solo tus
                      aportaciones y compras reales. Tu reserva externa queda
                      fuera del portafolio.
                    </p>
                  </div>
                </div>
              ) : null}
              <FinanceDailyStatus market={data.market} demo={demo} />
              <FinanceProcessGuide />
              <div className="fi-two-columns">
                <article className="fi-panel">
                  <span className="fi-eyebrow">LA SIGUIENTE APORTACIÓN</span>
                  <h2>{data.summary.proposal.label}</h2>
                  <p>{data.summary.proposal.reason}</p>
                  <strong className="fi-amount">
                    {money(data.summary.proposal.amountMxn)}
                  </strong>
                  {data.summary.proposal.items.length ? (
                    <ul className="fi-proposals">
                      {data.summary.proposal.items.map((item) => (
                        <li key={item.instrumentId}>
                          <span>
                            {instrument(item.instrumentId)?.symbol ??
                              (item.instrumentId === "CASH_MXN"
                                ? "Efectivo MXN"
                                : item.instrumentId === "CASH_USD"
                                  ? "Efectivo USD"
                                  : item.instrumentId)}
                          </span>
                          <strong>{money(item.amountMxn)}</strong>
                          <small>
                            Peso posterior {percent(item.afterWeight)}
                          </small>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {data.summary.proposal.missing.length ? (
                    <details className="fi-compact">
                      <summary>Qué falta confirmar</summary>
                      <ul>
                        {data.summary.proposal.missing.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  <p className="fi-footnote">
                    Una simulación para revisar. Precios de referencia,
                    disponibilidad y costos finales se confirman en el
                    intermediario; Noticiero no ejecuta operaciones.
                  </p>
                </article>
                <article className="fi-panel">
                  <span className="fi-eyebrow">DISTRIBUCIÓN ACTUAL</span>
                  <h2>Dónde está tu dinero</h2>
                  {data.summary.allocation.length ? (
                    <ul className="fi-distribution">
                      {data.summary.allocation.map((item, i) => (
                        <li key={`${item.label}-${i}`}>
                          <span>{item.label}</span>
                          <strong>{money(item.valueMxn)}</strong>
                          <small>{percent(item.weight)}</small>
                          {item.weight !== undefined ? (
                            <div className="fi-bar">
                              <i
                                style={{
                                  width: `${Math.min(100, Math.max(0, item.weight))}%`,
                                }}
                              />
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Aún no hay una distribución para comparar.</p>
                  )}
                  <div className="fi-cash">
                    <span>Efectivo disponible</span>
                    <strong>{money(data.summary.cash.MXN)} MXN</strong>
                    <strong>{money(data.summary.cash.USD, "USD")} USD</strong>
                  </div>
                  <p className="fi-footnote">
                    Moneda de cotización y exposición económica son diferentes.
                    La composición por país o sector requiere fuentes fechadas.
                  </p>
                </article>
              </div>
              <details className="fi-disclosure">
                <summary>
                  Posiciones y precios de referencia <ChevronRight size={14} />
                </summary>
                {data.summary.positions.length ? (
                  <div className="fi-positions">
                    {data.summary.positions.map((position) => (
                      <article
                        className="fi-position"
                        key={position.instrumentId}
                      >
                        <div>
                          <strong>
                            {instrument(position.instrumentId)?.symbol ??
                              position.instrumentId}
                          </strong>
                          <span>{instrument(position.instrumentId)?.name}</span>
                          <small>
                            {position.quantity} títulos ·{" "}
                            {instrument(position.instrumentId)?.exchange}
                          </small>
                        </div>
                        <div>
                          <strong>{money(position.valueMxn)}</strong>
                          <span>{percent(position.weight)}</span>
                          <small>
                            {position.asOf
                              ? `Referencia ${date(position.asOf)}`
                              : "Falta precio verificable"}
                          </small>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p>Las compras y ventas determinan tus posiciones.</p>
                )}
                <details className="fi-compact">
                  <summary>Registrar precio o tipo de cambio</summary>
                  <form
                    onSubmit={(e) => {
                      const f = fields(e);
                      void post("mark", { ...f, kind: markKind });
                    }}
                  >
                    <fieldset disabled={disabled}>
                      <div className="fi-form-grid">
                        <Field label="Tipo de referencia">
                          <select
                            aria-label="Tipo de referencia"
                            value={markKind}
                            onChange={(e) => setMarkKind(e.target.value)}
                          >
                            <option value="price">
                              Precio de un instrumento
                            </option>
                            <option value="fx">USD/MXN</option>
                          </select>
                        </Field>
                        {markKind === "price" ? (
                          <InstrumentSelect
                            instruments={instruments}
                            label="Instrumento del precio"
                          />
                        ) : (
                          <p className="fi-hint">
                            Pesos por un dólar. Referencia para valorar, no el
                            cambio ejecutado de una operación.
                          </p>
                        )}
                        <Decimal
                          label={
                            markKind === "price"
                              ? "Precio por título"
                              : "MXN por USD"
                          }
                          name="value"
                          required
                        />
                        <Text
                          label="Fecha de la referencia"
                          name="asOf"
                          type="date"
                          defaultValue={editionFor().date}
                          required
                        />
                        <Text
                          label="Fuente de la referencia"
                          name="source"
                          required
                          placeholder="Estado de cuenta o fuente pública"
                        />
                        <Text
                          label="Enlace de la referencia"
                          name="sourceUrl"
                          type="url"
                        />
                      </div>
                      <button className="fi-button fi-primary" type="submit">
                        Guardar referencia
                      </button>
                    </fieldset>
                  </form>
                </details>
                {data.marks.length ? (
                  <details className="fi-compact">
                    <summary>Ver referencias guardadas</summary>
                    <div className="fi-facts">
                      {[...data.marks]
                        .sort((a, b) =>
                          b.capturedAt.localeCompare(a.capturedAt),
                        )
                        .map((mark) => (
                          <article key={mark.id}>
                            <strong>
                              {mark.kind === "fx"
                                ? "USD/MXN"
                                : (instrument(mark.instrumentId ?? "")
                                    ?.symbol ?? "Precio")}
                            </strong>
                            <span>
                              {mark.value}{" "}
                              {mark.kind === "fx"
                                ? "MXN por USD"
                                : instrument(mark.instrumentId ?? "")?.currency}
                            </span>
                            <small>
                              Referencia {date(mark.asOf)} · Capturada{" "}
                              {date(mark.capturedAt)}
                            </small>
                            {mark.sourceUrl ? (
                              <a
                                href={mark.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {mark.source} <ArrowUpRight size={11} />
                              </a>
                            ) : (
                              <small>{mark.source}</small>
                            )}
                          </article>
                        ))}
                    </div>
                  </details>
                ) : null}
              </details>
              <details className="fi-disclosure">
                <summary>
                  Mi política y distribución objetivo{" "}
                  <span>
                    {data.policy?.approved ? "Aprobada" : "Por definir"}
                  </span>
                  <ChevronRight size={14} />
                </summary>
                <p>
                  Elige tu propia distribución. No se presume una asignación ni
                  una rentabilidad garantizada. Los pesos deben sumar 100 %.
                </p>
                <form
                  key={data.policy?.updatedAt ?? "new-policy"}
                  onSubmit={(e) => {
                    const f = fields(e);
                    const targets = [
                      ...instruments.map((i) => i.id),
                      "CASH_MXN",
                      "CASH_USD",
                    ]
                      .map((id) => ({
                        instrumentId: id,
                        weight: Number(f[`target-${id}`] || 0),
                      }))
                      .filter((target) => target.weight > 0);
                    void post("policy", {
                      monthlyContributionMxn: f.monthlyContributionMxn,
                      targets,
                      approved: f.approved === "on",
                    });
                  }}
                >
                  <fieldset disabled={disabled}>
                    <div className="fi-form-grid">
                      <Decimal
                        label="Aportación mensual prevista en MXN"
                        name="monthlyContributionMxn"
                        required
                        defaultValue={data.policy?.monthlyContributionMxn}
                      />
                      {[
                        ...instruments.map((i) => ({
                          id: i.id,
                          label: `${i.symbol} · ${i.exchange}`,
                        })),
                        { id: "CASH_MXN", label: "Efectivo MXN" },
                        { id: "CASH_USD", label: "Efectivo USD" },
                      ].map((i) => (
                        <Field key={i.id} label={`Objetivo ${i.label} (%)`}>
                          <input
                            aria-label={`Objetivo ${i.label} (%)`}
                            name={`target-${i.id}`}
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            defaultValue={
                              data.policy?.targets.find(
                                (t) => t.instrumentId === i.id,
                              )?.weight ?? 0
                            }
                          />
                        </Field>
                      ))}
                    </div>
                    <label className="fi-check">
                      <input
                        name="approved"
                        type="checkbox"
                        defaultChecked={data.policy?.approved ?? false}
                      />{" "}
                      He revisado y apruebo esta distribución como mi objetivo.
                    </label>
                    <button className="fi-button fi-primary" type="submit">
                      Guardar política
                    </button>
                  </fieldset>
                </form>
              </details>
              <details className="fi-disclosure">
                <summary>
                  Rendimiento y límites del análisis <ChevronRight size={14} />
                </summary>
                <p>{data.summary.performance.reason}</p>
                <div className="fi-performance">
                  <span>
                    TWR · sin efecto de aportaciones{" "}
                    <strong>{percent(data.summary.performance.twr)}</strong>
                  </span>
                  <span>
                    MWR · resultado del dinero por fecha{" "}
                    <strong>{percent(data.summary.performance.mwr)}</strong>
                  </span>
                </div>
                <p className="fi-footnote">
                  Historial insuficiente se muestra como pendiente. Una caída
                  puede prolongarse y una inversión puede no recuperarse. El
                  análisis no garantiza un rendimiento futuro.
                </p>
              </details>
            </>
          ) : null}
          {tab === "movements" ? (
            <>
              <div className="fi-section-heading">
                <div>
                  <h2>Tu historial, sin perder el contexto.</h2>
                  <p>
                    Los movimientos se conservan. Una corrección crea un reverso
                    auditable.
                  </p>
                </div>
              </div>
              {showMovement ? (
                <form
                  className="fi-editor"
                  aria-label="Registrar movimiento"
                  onSubmit={(e) => {
                    const f = fields(e);
                    void post("movement", {
                      ...f,
                      kind: movementKind,
                      currency: movementCurrency,
                      amount: f.amount || "0",
                      fee: f.fee || "0",
                      note: f.note || "",
                      reference: reference || crypto.randomUUID(),
                    }).then((ok) => {
                      if (ok) {
                        setShowMovement(false);
                        setReference(crypto.randomUUID());
                      }
                    });
                  }}
                >
                  <fieldset disabled={disabled}>
                    <div className="fi-editor-heading">
                      <h3>Nuevo movimiento</h3>
                      <button
                        className="fi-text-button"
                        type="button"
                        onClick={() => setShowMovement(false)}
                      >
                        Cerrar
                      </button>
                    </div>
                    <div className="fi-form-grid">
                      <Field label="Tipo de movimiento">
                        <select
                          aria-label="Tipo de movimiento"
                          value={movementKind}
                          onChange={(e) =>
                            setMovementKind(e.target.value as MovementKind)
                          }
                        >
                          {Object.entries(movementNames).map(([id, name]) => (
                            <option key={id} value={id}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Text
                        label="Fecha del movimiento"
                        name="date"
                        type="date"
                        defaultValue={editionFor().date}
                        required
                      />
                      <Field label="Moneda del movimiento">
                        <select
                          aria-label="Moneda del movimiento"
                          value={movementCurrency}
                          onChange={(e) => setMovementCurrency(e.target.value)}
                        >
                          <option value="MXN">MXN</option>
                          <option value="USD">USD</option>
                        </select>
                      </Field>
                      {["buy", "sell", "dividend", "split"].includes(
                        movementKind,
                      ) ? (
                        <InstrumentSelect
                          instruments={instruments}
                          label="Instrumento del movimiento"
                          required={movementKind !== "dividend"}
                          onChange={(id) => {
                            const i = instrument(id);
                            if (i) setMovementCurrency(i.currency);
                          }}
                        />
                      ) : null}
                      {["buy", "sell", "split"].includes(movementKind) ? (
                        <Decimal
                          label={
                            movementKind === "split"
                              ? "Factor del split"
                              : "Cantidad de títulos"
                          }
                          name="quantity"
                          required
                          hint={
                            movementKind === "split"
                              ? "Un split 2:1 se registra como 2."
                              : undefined
                          }
                        />
                      ) : null}
                      {["buy", "sell"].includes(movementKind) ? (
                        <Decimal
                          label="Precio de ejecución"
                          name="price"
                          required
                        />
                      ) : movementKind !== "split" ? (
                        <Decimal
                          label="Importe del movimiento"
                          name="amount"
                          required
                        />
                      ) : null}
                      {movementKind !== "split" ? (
                        <Decimal
                          label="Comisión adicional"
                          name="fee"
                          defaultValue="0"
                          hint="En la misma moneda del movimiento; no la dupliques en el importe."
                        />
                      ) : null}
                      {movementKind === "exchange" ||
                      movementCurrency === "USD" ? (
                        <Decimal
                          label="Tipo de cambio ejecutado MXN por USD"
                          name="fxRate"
                          required={
                            movementKind === "exchange" ||
                            ["deposit", "withdrawal"].includes(movementKind)
                          }
                          hint="Conserva el tipo de cambio real; no uses una cotización estimada."
                        />
                      ) : null}
                      <Text label="Nota del movimiento" name="note" />
                    </div>
                    <p className="fi-footnote">
                      La conversión descuenta la moneda de origen y acredita la
                      otra. Compras, ventas y conversiones no son aportaciones.
                    </p>
                    <button className="fi-button fi-primary" type="submit">
                      Guardar movimiento
                    </button>
                  </fieldset>
                </form>
              ) : null}
              {data.movements.length ? (
                <div className="fi-movements">
                  {[...data.movements].reverse().map((m) => (
                    <details className="fi-movement" key={m.id}>
                      <summary>
                        <span className="fi-movement-type">
                          {movementNames[m.kind]}
                          {m.reversesId ? " · Reverso" : ""}
                          <small>
                            {date(m.date)}
                            {m.instrumentId
                              ? ` · ${instrument(m.instrumentId)?.symbol ?? m.instrumentId}`
                              : ""}
                          </small>
                        </span>
                        <strong>
                          {["buy", "sell", "split"].includes(m.kind)
                            ? `${m.quantity ?? "—"} títulos`
                            : money(m.amount, m.currency)}
                          <small>{m.currency}</small>
                        </strong>
                        <ChevronRight size={13} />
                      </summary>
                      <div className="fi-movement-detail">
                        <p>{m.note || "Sin nota adicional."}</p>
                        {m.price ? (
                          <p>
                            Precio de ejecución: {money(m.price, m.currency)}
                          </p>
                        ) : null}
                        <p>
                          Comisión adicional: {money(m.fee, m.currency)}
                          {m.fxRate
                            ? ` · Cambio ejecutado: ${m.fxRate} MXN/USD`
                            : ""}
                        </p>
                        {!m.reversesId &&
                        !data.movements.some(
                          (other) => other.reversesId === m.id,
                        ) ? (
                          <form
                            onSubmit={(e) => {
                              const f = fields(e);
                              void post("reverse", {
                                movementId: m.id,
                                note: f.note,
                              });
                            }}
                          >
                            <fieldset disabled={disabled}>
                              <Text
                                label={`Motivo de corrección ${m.id}`}
                                name="note"
                                required
                              />
                              <button className="fi-button" type="submit">
                                Crear reverso
                              </button>
                            </fieldset>
                          </form>
                        ) : (
                          <p>
                            Se conserva para auditoría; no se vuelve a
                            contabilizar.
                          </p>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="fi-empty">
                  <h3>Aún no hay movimientos.</h3>
                  <p>
                    Usa «Registrar movimiento» para comenzar con una aportación
                    real.
                  </p>
                </div>
              )}
              <details className="fi-disclosure">
                <summary>
                  Importar movimientos CSV <ChevronRight size={14} />
                </summary>
                <p>
                  Primero registra los instrumentos en Investigar. La selección
                  del archivo no envía datos; revisa el formato y pulsa
                  Importar.
                </p>
                <code className="fi-csv-schema">{csvHeader}</code>
                <p className="fi-footnote">
                  Fechas YYYY-MM-DD, números con punto decimal y tipos deposit,
                  withdrawal, buy, sell, dividend, interest, fee, tax, exchange,
                  split. Máximo 1 MB. Conserva una referencia única por
                  operación.
                </p>
                <fieldset disabled={disabled}>
                  <Field label="Archivo CSV de movimientos">
                    <input
                      aria-label="Archivo CSV de movimientos"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => {
                        const selected = ++csvSelection.current;
                        setCsv("");
                        setCsvName("");
                        setReadingCsv(false);
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 1_000_000) {
                          setNotice({
                            text: "El CSV supera 1 MB.",
                            error: true,
                          });
                          return;
                        }
                        setReadingCsv(true);
                        void file
                          .text()
                          .then((text) => {
                            if (selected !== csvSelection.current) return;
                            setCsv(text);
                            setCsvName(file.name);
                          })
                          .catch(() => {
                            if (selected === csvSelection.current)
                              setNotice({
                                text: "No pudimos leer ese archivo CSV.",
                                error: true,
                              });
                          })
                          .finally(() => {
                            if (selected === csvSelection.current)
                              setReadingCsv(false);
                          });
                      }}
                    />
                  </Field>
                  {csvName ? (
                    <p className="fi-hint">
                      Listo para validar: {csvName}. Aún no se ha enviado.
                    </p>
                  ) : null}
                  <button
                    className="fi-button fi-primary"
                    disabled={!csv || disabled || readingCsv}
                    onClick={() =>
                      void post("import", { csv }).then((ok) => {
                        if (ok) {
                          setCsv("");
                          setCsvName("");
                        }
                      })
                    }
                  >
                    Importar movimientos
                  </button>
                </fieldset>
              </details>
            </>
          ) : null}
          {tab === "research" ? (
            <>
              <div className="fi-section-heading">
                <div>
                  <h2>Investigar antes de decidir.</h2>
                  <p>
                    Una lista breve, fuentes verificables y supuestos que puedas
                    revisar.
                  </p>
                </div>
              </div>
              <details className="fi-disclosure">
                <summary>
                  Agregar instrumento a seguimiento <Plus size={14} />
                </summary>
                <form
                  onSubmit={(e) => {
                    const form = e.currentTarget;
                    const f = fields(e);
                    void post("instrument", {
                      ...f,
                      fractional: f.fractional === "on",
                    }).then((ok) => {
                      if (ok) form.reset();
                    });
                  }}
                >
                  <fieldset disabled={disabled}>
                    <div className="fi-form-grid">
                      <Text
                        label="Símbolo del instrumento"
                        name="symbol"
                        required
                        placeholder="Símbolo confirmado en tu mercado"
                      />
                      <Text
                        label="Nombre del instrumento"
                        name="name"
                        required
                      />
                      <Field label="Tipo de instrumento">
                        <select aria-label="Tipo de instrumento" name="kind">
                          <option value="etf">ETF</option>
                          <option value="stock">Acción</option>
                          <option value="bond">Deuda</option>
                        </select>
                      </Field>
                      <Field label="Moneda de cotización">
                        <select
                          aria-label="Moneda de cotización"
                          name="currency"
                        >
                          <option value="MXN">MXN</option>
                          <option value="USD">USD</option>
                        </select>
                      </Field>
                      <Text
                        label="Mercado del instrumento"
                        name="exchange"
                        required
                        placeholder="Mercado confirmado, por ejemplo NYSE"
                      />
                      <Text
                        label="País sustentado"
                        name="country"
                        hint="Opcional. El mercado de cotización no demuestra exposición económica."
                      />
                      <Text label="Sector sustentado" name="sector" />
                      <Text
                        label="Fuente oficial del instrumento"
                        name="sourceUrl"
                        type="url"
                      />
                      <Text
                        label="CIK de SEC"
                        name="cik"
                        hint="Opcional. Identificador oficial del emisor estadounidense."
                      />
                    </div>
                    <label className="fi-check">
                      <input type="checkbox" name="fractional" /> Confirmé que
                      mi intermediario permite fracciones de este instrumento.
                    </label>
                    <button className="fi-button fi-primary" type="submit">
                      Guardar instrumento
                    </button>
                  </fieldset>
                </form>
              </details>
              {!instruments.length ? (
                <div className="fi-empty">
                  <BookOpen size={27} strokeWidth={1.2} />
                  <h3>Una buena tesis empieza con una pregunta.</h3>
                  <p>
                    Agrega un instrumento sin convertirlo en una compra.
                    Registrar seguimiento no crea una posición.
                  </p>
                </div>
              ) : (
                <div className="fi-research-list">
                  {instruments.map((i) => {
                    const thesis = data.theses
                      .filter((t) => t.instrumentId === i.id)
                      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
                    const research = data.research
                      .filter((r) => r.instrumentId === i.id)
                      .sort((a, b) =>
                        b.capturedAt.localeCompare(a.capturedAt),
                      )[0];
                    return (
                      <details className="fi-instrument" key={i.id}>
                        <summary>
                          <div>
                            <span className="fi-eyebrow">
                              {kindNames[i.kind]} · {i.exchange} · {i.currency}
                            </span>
                            <h3>{i.name}</h3>
                            <span>
                              {i.symbol} ·{" "}
                              {thesis.length
                                ? `${thesis.length} versiones de tesis`
                                : "Tesis por escribir"}
                            </span>
                          </div>
                          <ChevronRight size={16} />
                        </summary>
                        <div className="fi-instrument-body">
                          <p className="fi-hint">
                            {i.fractional
                              ? "Fracciones confirmadas por el usuario."
                              : "Sin confirmación de fracciones."}
                            {i.country
                              ? ` País registrado: ${i.country}.`
                              : " País no documentado."}
                            {i.sector ? ` Sector: ${i.sector}.` : ""}
                          </p>
                          {i.sourceUrl ? (
                            <a
                              href={i.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Consultar fuente oficial{" "}
                              <ArrowUpRight size={12} />
                            </a>
                          ) : (
                            <p className="fi-footnote">
                              Falta agregar una fuente oficial del instrumento.
                            </p>
                          )}
                          {data.relatedNews?.some(
                            (item) => item.instrumentId === i.id,
                          ) ? (
                            <details className="fi-compact">
                              <summary>Menciones en noticias</summary>
                              <p className="fi-footnote">
                                Una mención no demuestra impacto financiero.
                                Contrasta el hecho y su mecanismo antes de
                                cambiar la tesis.
                              </p>
                              <ul>
                                {data.relatedNews
                                  .filter((item) => item.instrumentId === i.id)
                                  .map((item) => (
                                    <li key={item.url}>
                                      <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        {item.title} <ArrowUpRight size={11} />
                                      </a>
                                      <p className="fi-footnote">
                                        {item.sourceName} · Publicada{" "}
                                        {date(item.publishedAt)}
                                      </p>
                                    </li>
                                  ))}
                              </ul>
                            </details>
                          ) : null}
                          <div className="fi-research-note">
                            <h4>
                              {i.kind === "etf"
                                ? "Qué revisar en este ETF"
                                : i.kind === "bond"
                                  ? "Qué revisar en esta deuda"
                                  : /banc|bank|financ/i.test(i.sector ?? "")
                                    ? "Una lectura para bancos"
                                    : "Qué revisar en este negocio"}
                            </h4>
                            <p>
                              {i.kind === "etf"
                                ? "Índice, composición fechada, concentración, superposición, gastos, domicilio y liquidez. El ETF no se analiza como una empresa única."
                                : i.kind === "bond"
                                  ? "Emisor, vencimiento, moneda, liquidez y precio. Una tasa de referencia no equivale al precio ni al rendimiento de tu posición."
                                  : /banc|bank|financ/i.test(i.sector ?? "")
                                    ? "Depósitos, costo de crédito, margen financiero, rentabilidad del patrimonio y capital regulatorio. EV/EBITDA no sustituye este análisis."
                                    : "Ingresos, márgenes, caja, deuda, vencimientos y dilución; contrasta el ciclo del sector antes de extrapolar crecimiento."}
                            </p>
                          </div>
                          {i.cik && i.kind === "stock" ? (
                            <button
                              className="fi-button"
                              disabled={disabled}
                              onClick={() =>
                                void post("research", { instrumentId: i.id })
                              }
                            >
                              Consultar publicación SEC
                            </button>
                          ) : null}
                          {research ? (
                            <div className="fi-facts">
                              <h4>Datos publicados · {research.source}</h4>
                              <p className="fi-footnote">
                                Capturados {date(research.capturedAt)}. Período
                                y fecha de publicación pueden ser distintos.
                              </p>
                              {research.facts.map((fact, n) => (
                                <article key={`${fact.label}-${fact.end}-${n}`}>
                                  <strong>{fact.label}</strong>
                                  <span>
                                    {new Intl.NumberFormat("es-MX", {
                                      maximumFractionDigits: 2,
                                    }).format(fact.value)}{" "}
                                    {fact.unit}
                                  </span>
                                  <small>
                                    {fact.start ? `${fact.start} a ` : ""}
                                    {fact.end} · Publicado {fact.filed}
                                  </small>
                                  <a
                                    href={fact.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {fact.form} · Ver reporte{" "}
                                    <ArrowUpRight size={11} />
                                  </a>
                                </article>
                              ))}
                              {research.warnings.map((w, n) => (
                                <p className="fi-footnote" key={n}>
                                  {w}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="fi-footnote">
                              Los datos fundamentales verificados aparecerán
                              aquí. Ausencia significa pendiente, no cero.
                            </p>
                          )}
                          <details className="fi-compact">
                            <summary>Escribir una tesis con fuentes</summary>
                            <form
                              onSubmit={(e) => {
                                const form = e.currentTarget;
                                const f = fields(e);
                                void post("thesis", {
                                  instrumentId: i.id,
                                  statement: f.statement,
                                  risks: f.risks,
                                  invalidators: f.invalidators,
                                  horizon: f.horizon,
                                  sources: f.sourceUrl
                                    ? [
                                        {
                                          title:
                                            f.sourceTitle ||
                                            "Fuente de la tesis",
                                          url: f.sourceUrl,
                                        },
                                      ]
                                    : [],
                                }).then((ok) => {
                                  if (ok) form.reset();
                                });
                              }}
                            >
                              <fieldset disabled={disabled}>
                                <LongText
                                  label={`Tesis para ${i.symbol}`}
                                  name="statement"
                                  required
                                  hint="Distingue el hecho, el mecanismo de impacto, la variable financiera y lo que todavía es una hipótesis."
                                />
                                <LongText
                                  label={`Riesgos de ${i.symbol}`}
                                  name="risks"
                                  required
                                />
                                <LongText
                                  label={`Qué invalidaría la tesis de ${i.symbol}`}
                                  name="invalidators"
                                  required
                                />
                                <Text
                                  label={`Horizonte de ${i.symbol}`}
                                  name="horizon"
                                  required
                                />
                                <Text
                                  label={`Título de fuente para ${i.symbol}`}
                                  name="sourceTitle"
                                />
                                <Text
                                  label={`Enlace de fuente para ${i.symbol}`}
                                  name="sourceUrl"
                                  type="url"
                                  required
                                />
                                <button
                                  className="fi-button fi-primary"
                                  type="submit"
                                >
                                  Guardar versión de tesis
                                </button>
                              </fieldset>
                            </form>
                          </details>
                          {thesis.map((t, n) => (
                            <details
                              className="fi-thesis"
                              key={t.id}
                              open={n === 0}
                            >
                              <summary>
                                {n === 0 ? "Última tesis" : "Versión anterior"}{" "}
                                · {date(t.createdAt)}
                                <ChevronRight size={12} />
                              </summary>
                              <p>{t.statement}</p>
                              <h4>Riesgos</h4>
                              <p>{t.risks}</p>
                              <h4>Qué la invalidaría</h4>
                              <p>{t.invalidators}</p>
                              <p className="fi-footnote">
                                Horizonte: {t.horizon}
                              </p>
                              {t.sources.map((s, j) => (
                                <a
                                  key={j}
                                  href={s.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {s.title} <ArrowUpRight size={11} />
                                </a>
                              ))}
                            </details>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}
              <p className="fi-footnote">
                Seguimiento no es recomendación de compra. Los modelos
                predictivos y el entrenamiento automático requieren evaluación
                adicional; no se presentan como una ventaja demostrada.
              </p>
            </>
          ) : null}
          {tab === "journal" ? (
            <>
              <div className="fi-section-heading">
                <div>
                  <h2>Las razones también se guardan.</h2>
                  <p>
                    Conserva qué sabías al decidir. Una revisión nueva no
                    reescribe el pasado.
                  </p>
                </div>
              </div>
              <details className="fi-disclosure">
                <summary>
                  Registrar una decisión <Plus size={14} />
                </summary>
                <form
                  onSubmit={(e) => {
                    const form = e.currentTarget;
                    const f = fields(e);
                    void post("decision", f).then((ok) => {
                      if (ok) form.reset();
                    });
                  }}
                >
                  <fieldset disabled={disabled}>
                    <div className="fi-form-grid">
                      <Text
                        label="Fecha de la decisión"
                        name="date"
                        type="date"
                        defaultValue={editionFor().date}
                        required
                      />
                      <Text
                        label="Decisión"
                        name="decision"
                        required
                        placeholder="Por ejemplo: mantener sin cambios"
                      />
                    </div>
                    <LongText
                      label="Por qué tomé esta decisión"
                      name="reason"
                      required
                    />
                    <LongText
                      label="Alternativas consideradas"
                      name="alternatives"
                      required
                    />
                    <LongText
                      label="Cuándo volvería a revisarla"
                      name="revisitWhen"
                      required
                    />
                    <p className="fi-footnote">
                      Se guardará una captura de la valoración, política,
                      instrumentos y referencias disponibles ahora. Una fecha
                      anterior de decisión no reconstruye la información de ese
                      día.
                    </p>
                    <button className="fi-button fi-primary" type="submit">
                      Guardar decisión
                    </button>
                  </fieldset>
                </form>
              </details>
              {data.decisions.length ? (
                <div className="fi-decisions">
                  {[...data.decisions]
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .map((d) => (
                      <details className="fi-decision" key={d.id}>
                        <summary>
                          <div>
                            <span className="fi-eyebrow">
                              DECISIÓN DEL {date(d.date)}
                            </span>
                            <h3>{d.action}</h3>
                          </div>
                          <ChevronRight size={15} />
                        </summary>
                        <div>
                          <h4>Razonamiento</h4>
                          <p>{d.reason}</p>
                          <h4>Alternativas</h4>
                          <p>{d.alternatives}</p>
                          <h4>Volver a revisar si…</h4>
                          <p>{d.revisitWhen}</p>
                          <div className="fi-decision-snapshot">
                            <span>
                              Valor conocido al registrar
                              <strong>
                                {money(
                                  d.snapshot.summary.complete
                                    ? d.snapshot.summary.valueMxn
                                    : d.snapshot.summary.knownValueMxn,
                                )}
                              </strong>
                            </span>
                            <span>
                              Aportado en la captura
                              <strong>
                                {money(d.snapshot.summary.contributionsMxn)}
                              </strong>
                            </span>
                            <span>
                              Referencias conservadas
                              <strong>{d.snapshot.marks.length}</strong>
                            </span>
                          </div>
                          {d.snapshot.theses?.length ||
                          d.snapshot.research?.length ? (
                            <details className="fi-compact">
                              <summary>
                                Tesis y fuentes conservadas en la captura
                              </summary>
                              <p className="fi-footnote">
                                Estas versiones pertenecen a la captura y no se
                                sustituyen por las tesis o reportes actuales.
                              </p>
                              {[
                                ...new Map(
                                  [...(d.snapshot.theses ?? [])]
                                    .sort((a, b) =>
                                      a.createdAt.localeCompare(b.createdAt),
                                    )
                                    .map((thesis) => [
                                      thesis.instrumentId,
                                      thesis,
                                    ]),
                                ).values(),
                              ].map((thesis) => (
                                <article className="fi-thesis" key={thesis.id}>
                                  <h4>
                                    {d.snapshot.instruments.find(
                                      (item) => item.id === thesis.instrumentId,
                                    )?.symbol ?? "Instrumento"}{" "}
                                    · Tesis conservada
                                  </h4>
                                  <p>{thesis.statement}</p>
                                  <p className="fi-footnote">
                                    Escrita {date(thesis.createdAt)} ·
                                    Horizonte: {thesis.horizon}
                                  </p>
                                  <p>
                                    <strong>Riesgos:</strong> {thesis.risks}
                                  </p>
                                  <p>
                                    <strong>Invalidadores:</strong>{" "}
                                    {thesis.invalidators}
                                  </p>
                                  {thesis.sources.map((source, index) => (
                                    <a
                                      key={index}
                                      href={source.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {source.title} <ArrowUpRight size={11} />
                                    </a>
                                  ))}
                                </article>
                              ))}
                              {[
                                ...new Map(
                                  [...(d.snapshot.research ?? [])]
                                    .sort((a, b) =>
                                      a.capturedAt.localeCompare(b.capturedAt),
                                    )
                                    .map((research) => [
                                      research.instrumentId,
                                      research,
                                    ]),
                                ).values(),
                              ].map((research) => (
                                <article
                                  className="fi-thesis"
                                  key={research.id}
                                >
                                  <h4>{research.source} · Datos conservados</h4>
                                  <p className="fi-footnote">
                                    Capturados {date(research.capturedAt)}
                                  </p>
                                  {research.facts
                                    .slice(0, 6)
                                    .map((fact, index) => (
                                      <p key={index}>
                                        {fact.label}:{" "}
                                        {new Intl.NumberFormat("es-MX").format(
                                          fact.value,
                                        )}{" "}
                                        {fact.unit} · Período {fact.end} ·
                                        Publicado {fact.filed}{" "}
                                        <a
                                          href={fact.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          Ver reporte <ArrowUpRight size={11} />
                                        </a>
                                      </p>
                                    ))}
                                </article>
                              ))}
                            </details>
                          ) : null}
                          <p className="fi-footnote">
                            Captura registrada el {date(d.createdAt)} con la
                            información disponible al guardar. La captura no
                            cambia al ingresar nuevos precios o movimientos.
                          </p>
                        </div>
                      </details>
                    ))}
                </div>
              ) : (
                <div className="fi-empty">
                  <Check size={26} strokeWidth={1.2} />
                  <h3>«Sin cambios» también es una decisión.</h3>
                  <p>
                    El diario empieza con tus razones, no con una obligación de
                    operar.
                  </p>
                </div>
              )}
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
