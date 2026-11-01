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
  ChevronRight,
  Plus,
} from "lucide-react";
import type {
  FinanceData,
  Instrument,
  MovementKind,
} from "@/features/finance/types";
import { editionFor } from "@/lib/time";
import { FinanceCapturedNews } from "./finance-news-workspace";
import {
  FinanceAutomaticPortfolio,
  FinanceAutomaticAnalysis,
  FinanceAutomationStatus,
} from "./finance-automatic-report";
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
  const [tab, setTab] = useState<"portfolio" | "analysis" | "movements">(
    "portfolio",
  );
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
          <span className="fi-eyebrow">TU PATRIMONIO · CON PERSPECTIVA</span>
          <h1>Mi portafolio.</h1>
          <p>
            Una propuesta calculada, sus razones y tu historial real. El
            análisis diario se prepara automáticamente.
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
      <div className="fi-tabs" role="group" aria-label="Vistas del portafolio">
        {(
          [
            ["portfolio", "Mi cartera"],
            ["analysis", "Qué hacer y por qué"],
            ["movements", "Movimientos"],
          ] as const
        ).map(([id, title]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {title}
          </button>
        ))}
      </div>
      {!data ? (
        <div className="fi-auto-awaiting">
          <h2>
            {notice?.error
              ? "No se pudo consultar el portafolio."
              : "Consultando tu informe…"}
          </h2>
          <p>Los registros privados se cargarán aquí.</p>
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
          ) : null}
        </div>
      ) : (
        <>
          <FinanceAutomationStatus automation={data.automation} demo={demo} />
          {data.viewLimited ? (
            <p className="fi-hint">
              Ves una muestra del archivo. Los totales usan todos los
              movimientos; Exportar incluye el historial completo.
            </p>
          ) : null}
          {tab === "portfolio" ? (
            <>
              <FinanceAutomaticPortfolio data={data} />{" "}
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
          {tab === "analysis" ? (
            <FinanceAutomaticAnalysis automation={data.automation} />
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
              <details className="fi-disclosure">
                <summary>
                  Registrar una operación real <Plus size={14} />
                </summary>
                <p className="fi-hint">
                  Herramienta opcional de registro. El informe diario no
                  requiere capturas manuales.
                </p>
                <button
                  className="fi-button"
                  disabled={disabled}
                  onClick={() => {
                    setShowMovement(true);
                    setReference(crypto.randomUUID());
                  }}
                >
                  Registrar movimiento
                </button>
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
                            onChange={(e) =>
                              setMovementCurrency(e.target.value)
                            }
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
                        La conversión descuenta la moneda de origen y acredita
                        la otra. Compras, ventas y conversiones no son
                        aportaciones.
                      </p>
                      <button className="fi-button fi-primary" type="submit">
                        Guardar movimiento
                      </button>
                    </fieldset>
                  </form>
                ) : null}
              </details>
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
                    El informe y la cartera propuesta no crean movimientos. Aquí
                    se conservarán únicamente las operaciones ejecutadas.
                  </p>
                </div>
              )}
              <details className="fi-disclosure">
                <summary>
                  Importar movimientos CSV <ChevronRight size={14} />
                </summary>
                <p>
                  Si el CSV incluye compras o ventas, registra sus instrumentos
                  en las herramientas de abajo. La selección del archivo no
                  envía datos; revisa el formato y pulsa Importar.
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
              <details className="fi-disclosure">
                <summary>
                  Registrar instrumento para operaciones <Plus size={14} />
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
            </>
          ) : null}

          {tab === "movements" ? (
            <details className="fi-disclosure fi-auto-archive">
              <summary>
                Archivo de notas, tesis y decisiones anteriores{" "}
                <ChevronRight size={14} />
              </summary>
              <p className="fi-hint">
                Se conservan las versiones guardadas y sus fuentes. Exportar
                incluye el archivo completo.
              </p>
              {data.theses.length ? (
                <details className="fi-compact">
                  <summary>Tesis guardadas · {data.theses.length}</summary>
                  {data.theses.map((thesis) => (
                    <article className="fi-thesis" key={thesis.id}>
                      <h3>
                        {instrument(thesis.instrumentId)?.symbol ??
                          thesis.instrumentId}
                      </h3>
                      <p>{thesis.statement}</p>
                      <p>Riesgos: {thesis.risks}</p>
                      <p>Invalidadores: {thesis.invalidators}</p>
                      <p className="fi-footnote">
                        {date(thesis.createdAt)} · Horizonte {thesis.horizon}
                      </p>
                      {thesis.sources.map((source, i) => (
                        <a
                          key={i}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {source.title} <ArrowUpRight size={11} />
                        </a>
                      ))}
                    </article>
                  ))}
                </details>
              ) : null}
              {data.newsResearch?.reviews.length ? (
                <details className="fi-compact">
                  <summary>
                    Notas de noticias guardadas ·{" "}
                    {data.newsResearch.reviews.length}
                  </summary>
                  {data.newsResearch.reviews.map((review) => (
                    <article className="fi-thesis" key={review.id}>
                      <h3>{review.snapshot?.title ?? "Nota conservada"}</h3>
                      <p>{review.note}</p>
                      <p>{review.openQuestions}</p>
                      <p className="fi-footnote">
                        {date(review.createdAt)} · {review.status}
                      </p>
                      {review.snapshot ? (
                        <a
                          href={review.snapshot.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Fuente conservada <ArrowUpRight size={11} />
                        </a>
                      ) : null}
                    </article>
                  ))}
                </details>
              ) : null}
              {data.research.length ? (
                <details className="fi-compact">
                  <summary>
                    Reportes de instrumentos guardados · {data.research.length}
                  </summary>
                  {data.research.map((research) => (
                    <article className="fi-thesis" key={research.id}>
                      <h3>
                        {instrument(research.instrumentId)?.symbol ??
                          research.instrumentId}{" "}
                        · {research.source}
                      </h3>
                      <p className="fi-footnote">
                        Capturado {date(research.capturedAt)}
                      </p>
                      {research.facts.map((fact, i) => (
                        <p key={i}>
                          {fact.label}: {fact.value} {fact.unit} · {fact.end} ·{" "}
                          <a
                            href={fact.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Reporte
                          </a>
                        </p>
                      ))}
                    </article>
                  ))}
                </details>
              ) : null}
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
                          <FinanceCapturedNews
                            events={d.snapshot.news}
                            reviews={d.snapshot.newsReviews}
                          />
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
                <p className="fi-hint">
                  No hay decisiones manuales archivadas.
                </p>
              )}
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
