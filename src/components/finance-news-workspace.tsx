"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, ChevronRight, FileText, Search } from "lucide-react";
import type {
  FinanceNewsEvent,
  FinanceNewsReview,
  FinanceNewsWorkspace as NewsData,
} from "@/features/finance/research-types";

const toneNames = {
  favorable: "Lenguaje favorable",
  adverse: "Lenguaje adverso",
  mixed: "Lenguaje mixto",
  unclassified: "Sin señal textual clara",
};
const reviewNames = {
  investigate: "Por investigar",
  monitor: "En seguimiento",
  discard: "Descartada por ahora",
};
function day(value: string) {
  const isDay = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: isDay ? "UTC" : "America/Mexico_City",
  }).format(new Date(isDay ? `${value}T12:00:00Z` : value));
}
function safeLink(value: string | undefined) {
  try {
    const url = new URL(value ?? "");
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
function ReviewHistory({
  reviews,
  expanded = false,
}: {
  reviews: FinanceNewsReview[];
  expanded?: boolean;
}) {
  if (!reviews.length) return null;
  return (
    <details className="fi-news-history" open={expanded}>
      <summary>
        Mis notas guardadas · {reviews.length}
        <ChevronRight size={12} />
      </summary>
      {reviews.map((review, index) => (
        <article key={review.id}>
          <small>
            {index === 0 ? "Última versión" : "Versión anterior"} ·{" "}
            {day(review.createdAt)} · {reviewNames[review.status]}
          </small>
          <p>{review.note}</p>
          {review.openQuestions ? (
            <p>
              <strong>Por contrastar:</strong> {review.openQuestions}
            </p>
          ) : null}
          <span className="fi-footnote">
            Conservada con la ficha «{review.snapshot.title}», capturada el{" "}
            {day(review.snapshot.capturedAt)}.
          </span>
        </article>
      ))}
    </details>
  );
}
function SavedNewsNotes({
  reviews,
  total,
  limited,
}: {
  reviews: FinanceNewsReview[];
  total: number;
  limited: boolean;
}) {
  const groups = new Map<string, FinanceNewsReview[]>();
  for (const review of [...reviews].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )) {
    const existing = groups.get(review.storyId) ?? [];
    existing.push(review);
    groups.set(review.storyId, existing);
  }
  return (
    <details className="fi-disclosure fi-news-notebook">
      <summary>
        Mis notas de investigación {total ? `· ${total} versiones` : ""}
        <ChevronRight size={14} />
      </summary>
      <p className="fi-hint">
        Tus notas se conservan aunque la noticia deje de aparecer en el periodo
        o en la vista reciente. Los filtros de noticias no cambian este
        cuaderno.
      </p>
      {groups.size ? (
        [...groups.values()].slice(0, 10).map((group) => {
          const latest = group[0];
          const source = safeLink(latest.snapshot.url);
          return (
            <article className="fi-news-saved-note" key={latest.storyId}>
              <h3>{latest.snapshot.title}</h3>
              <p className="fi-footnote">
                {latest.snapshot.sourceName} · noticia publicada{" "}
                {day(latest.snapshot.publishedAt)} · nota guardada{" "}
                {day(latest.createdAt)}
              </p>
              {source ? (
                <a href={source} target="_blank" rel="noopener noreferrer">
                  Fuente conservada <ArrowUpRight size={11} />
                </a>
              ) : null}
              <ReviewHistory reviews={group} expanded />
            </article>
          );
        })
      ) : (
        <p className="fi-hint">
          Aún no has guardado una conclusión. Abre «Investigar noticia» en una
          ficha y pulsa «Guardar nota de investigación» cuando quieras conservar
          tus razones.
        </p>
      )}
      {limited || total > reviews.length || groups.size > 10 ? (
        <p className="fi-footnote">
          Este cuaderno muestra las versiones recientes disponibles de hasta
          diez noticias. Exportar incluye las notas y copias anteriores del
          archivo completo.
        </p>
      ) : null}
    </details>
  );
}
export function FinanceCapturedNews({
  events = [],
  reviews = [],
}: {
  events?: FinanceNewsEvent[];
  reviews?: FinanceNewsReview[];
}) {
  if (!events.length && !reviews.length) return null;
  return (
    <details className="fi-compact fi-news-captured">
      <summary>Noticias y notas conservadas en esta decisión</summary>
      <p className="fi-footnote">
        Estas copias pertenecen a la captura de la decisión. Las noticias y
        notas nuevas no sustituyen la información guardada.
      </p>
      {events.map((event) => {
        const source = safeLink(event.url);
        return (
          <article key={event.id}>
            <h4>{event.title}</h4>
            <p className="fi-footnote">
              {event.sourceName} · publicada {day(event.publishedAt)} ·
              capturada {day(event.capturedAt)}
            </p>
            <p>{event.summary || event.excerpt}</p>
            {source ? (
              <a href={source} target="_blank" rel="noopener noreferrer">
                Fuente de la noticia <ArrowUpRight size={11} />
              </a>
            ) : null}
          </article>
        );
      })}
      {reviews.map((review) => (
        <article key={review.id}>
          <h4>Nota: {review.snapshot.title}</h4>
          <small>
            {day(review.createdAt)} · {reviewNames[review.status]}
          </small>
          <p>{review.note}</p>
          {review.openQuestions ? (
            <p>
              <strong>Por contrastar:</strong> {review.openQuestions}
            </p>
          ) : null}
        </article>
      ))}
    </details>
  );
}
function NewsCard({
  event,
  reviews,
  disabled,
  compact,
  onSave,
}: {
  event: FinanceNewsEvent;
  reviews: FinanceNewsReview[];
  disabled: boolean;
  compact: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const source = safeLink(event.url);
  const latest = reviews[0];
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = new FormData(form);
    await onSave({
      eventId: event.id,
      status: fields.get("status"),
      note: fields.get("note"),
      openQuestions: fields.get("openQuestions"),
    });
  }
  return (
    <article
      className="fi-news-card"
      aria-label={`Noticia financiera: ${event.title}`}
    >
      <div className="fi-news-meta">
        <span>{event.topic}</span>
        <time dateTime={event.publishedAt}>{day(event.publishedAt)}</time>
      </div>
      <h3>{event.title}</h3>
      <p className="fi-news-summary">
        {event.summary ||
          event.excerpt ||
          "Solo titular disponible; consulta la fuente antes de sacar conclusiones."}
      </p>
      <div className="fi-news-source">
        <span>
          {event.sourceName} ·{" "}
          {event.coverage === "headline"
            ? "Solo titular"
            : event.summaryLanguage === "es"
              ? "Resumen extractivo"
              : "Resumen · idioma original"}
        </span>
        {source ? (
          <a href={source} target="_blank" rel="noopener noreferrer">
            Leer fuente <ArrowUpRight size={11} />
          </a>
        ) : null}
      </div>
      {event.companies.length ? (
        <p className="fi-news-companies">
          {event.companies
            .map(
              (company) =>
                `${company.name}${company.private ? " (privada)" : ""}`,
            )
            .join(" · ")}
        </p>
      ) : null}
      {!compact ? (
        <details className="fi-news-detail">
          <summary>
            Investigar noticia <ChevronRight size={13} />
          </summary>
          <div className="fi-news-analysis">
            <span className="fi-eyebrow">HIPÓTESIS PARA CONTRASTAR</span>
            <p>{event.mechanismHypothesis}</p>
            <h4>Preguntas para investigar</h4>
            <ul>
              {event.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
            <h4>Qué evidencia falta</h4>
            <ul>
              {event.missingEvidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <details className="fi-compact">
              <summary>Cómo se leyó el lenguaje del texto</summary>
              <p>
                <strong>{toneNames[event.tone.label]}</strong> ·{" "}
                {event.tone.method}
              </p>
              <p className="fi-footnote">{event.tone.caveat}</p>
              {event.tone.positiveTerms.length ? (
                <p className="fi-footnote">
                  Términos favorables: {event.tone.positiveTerms.join(", ")}
                </p>
              ) : null}
              {event.tone.negativeTerms.length ? (
                <p className="fi-footnote">
                  Términos adversos: {event.tone.negativeTerms.join(", ")}
                </p>
              ) : null}
            </details>
            <p className="fi-footnote">
              Una mención no demuestra impacto financiero. Estas preguntas no
              indican comprar o vender; hay que contrastarlas con datos y
              fuentes.
            </p>
            <ReviewHistory reviews={reviews} />
            <form
              key={`${event.id}:${latest?.id ?? "new"}`}
              aria-label={`Nota para ${event.title}`}
              onSubmit={submit}
            >
              <fieldset disabled={disabled}>
                <label className="fi-field">
                  <span>Mi conclusión provisional</span>
                  <select
                    aria-label="Mi conclusión provisional"
                    name="status"
                    defaultValue={latest?.status ?? "investigate"}
                  >
                    <option value="investigate">Por investigar</option>
                    <option value="monitor">En seguimiento</option>
                    <option value="discard">Descartada por ahora</option>
                  </select>
                </label>
                <label className="fi-field">
                  <span>Mi nota de investigación</span>
                  <textarea
                    aria-label="Mi nota de investigación"
                    name="note"
                    required
                    maxLength={6000}
                    rows={3}
                    defaultValue={latest?.note ?? ""}
                    placeholder="Qué entendí, qué me preocupa y por qué merece o no más investigación."
                  />
                </label>
                <label className="fi-field">
                  <span>Qué quiero contrastar</span>
                  <textarea
                    aria-label="Qué quiero contrastar"
                    name="openQuestions"
                    maxLength={6000}
                    rows={2}
                    defaultValue={latest?.openQuestions ?? ""}
                  />
                </label>
                <button className="fi-button" type="submit">
                  Guardar nota de investigación
                </button>
                <p className="fi-footnote">
                  Se guarda al pulsar el botón. Una nueva versión conserva las
                  notas y la ficha anteriores; no crea una inversión.
                </p>
              </fieldset>
            </form>
          </div>
        </details>
      ) : null}
    </article>
  );
}

export function FinanceNewsWorkspace({
  data,
  compact = false,
  disabled,
  demo,
  onSave,
  onInvestigate,
}: {
  data?: NewsData;
  compact?: boolean;
  disabled: boolean;
  demo: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
  onInvestigate?: () => void;
}) {
  const [period, setPeriod] = useState("7");
  const [focus, setFocus] = useState("all");
  const [openedAt] = useState(() => Date.now());
  const events = data?.events ?? [];
  const reference = Date.parse(data?.asOf ?? "") || openedAt;
  const cutoff = reference - Number(period) * 86400000;
  const companies = [
    ...new Map(
      events.flatMap((event) =>
        event.companies.map((company) => [company.symbol, company] as const),
      ),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const topics = [...new Set(events.map((event) => event.topic))].sort();
  const filtered = events.filter(
    (event) =>
      Date.parse(event.publishedAt) >= cutoff &&
      (focus === "all" ||
        (focus.startsWith("company:")
          ? event.companies.some((company) => company.symbol === focus.slice(8))
          : event.topic === focus.slice(6))),
  );
  const shown = compact ? events.slice(0, 3) : filtered.slice(0, 12);
  const latestBrief = data?.briefs[0];
  return (
    <section
      className={`fi-news-workspace ${compact ? "fi-news-compact" : ""}`}
      aria-label={
        compact
          ? "Panorama financiero"
          : "Investigación de noticias financieras"
      }
    >
      <div className="fi-news-heading">
        <div>
          <span className="fi-eyebrow">LEER · CONTRASTAR · CONSERVAR</span>
          <h2>
            {compact
              ? "Qué pasó. Qué investigar."
              : "Noticias para entender antes de invertir."}
          </h2>
          <p>
            {compact
              ? "Empieza por las noticias. No necesitas tener una cartera para investigar."
              : "Las noticias y fichas se guardan automáticamente; tus conclusiones se guardan cuando pulsas Guardar nota."}
          </p>
        </div>
        {compact && onInvestigate ? (
          <button className="fi-button fi-primary" onClick={onInvestigate}>
            Investigar noticias <ChevronRight size={13} />
          </button>
        ) : null}
      </div>
      {!compact ? (
        <div className="fi-news-filters">
          <label>
            <span>Periodo de noticias</span>
            <select
              aria-label="Periodo de noticias"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="3">Últimos 3 días</option>
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
            </select>
          </label>
          <label>
            <span>Empresa o tema</span>
            <select
              aria-label="Empresa o tema"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
            >
              <option value="all">Todas las empresas y temas</option>
              <optgroup label="Empresas">
                {companies.map((company) => (
                  <option
                    key={company.symbol}
                    value={`company:${company.symbol}`}
                  >
                    {company.name}
                    {company.private ? " · privada" : ""}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Temas">
                {topics.map((topic) => (
                  <option key={topic} value={`topic:${topic}`}>
                    {topic}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <small>{filtered.length} fichas en esta vista</small>
        </div>
      ) : null}
      {shown.length ? (
        <div className="fi-news-grid">
          {shown.map((event) => (
            <NewsCard
              key={event.id}
              event={event}
              reviews={(data?.reviews ?? [])
                .filter((review) => review.storyId === event.storyId)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
              compact={compact}
              disabled={disabled}
              onSave={onSave}
            />
          ))}
        </div>
      ) : (
        <div className="fi-news-empty">
          <Search size={23} strokeWidth={1.3} />
          <div>
            <h3>
              {events.length
                ? "No hay fichas con estos filtros."
                : "Este espacio se llena con las noticias."}
            </h3>
            <p>
              {events.length
                ? "Amplía el periodo o selecciona todas las empresas y temas."
                : demo
                  ? "La demo no consulta ni guarda datos privados. En tu espacio, las actualizaciones preparan noticias y preguntas sin crear compras."
                  : "El siguiente ciclo preparará las fichas financieras con las noticias recopiladas. No hace falta agregar un instrumento ni registrar dinero."}
            </p>
          </div>
        </div>
      )}
      {!compact && filtered.length > shown.length ? (
        <p className="fi-footnote">
          Ves las {shown.length} fichas más recientes de esta selección.
          Exportar conserva el archivo financiero disponible completo.
        </p>
      ) : null}
      {data?.viewLimited ? (
        <p className="fi-footnote">
          Esta pantalla muestra una parte reciente del archivo. Los informes
          conservan su propio corte; Exportar incluye el archivo completo.
        </p>
      ) : null}
      {data?.lastUpdatedAt ? (
        <p className="fi-news-updated">
          Fichas preparadas {day(data.lastUpdatedAt)} · {data.totalEvents}{" "}
          noticias únicas archivadas
          {data.totalVersions > data.totalEvents
            ? ` · ${data.totalVersions} versiones`
            : ""}
          .
        </p>
      ) : null}
      {!compact ? (
        <SavedNewsNotes
          reviews={data?.reviews ?? []}
          total={data?.totalReviews ?? 0}
          limited={Boolean(data?.viewLimited)}
        />
      ) : null}
      {!compact ? (
        <details className="fi-disclosure fi-news-reports">
          <summary>
            <FileText size={14} /> Informes financieros guardados{" "}
            {data?.briefs.length ? `· ${data.totalBriefs}` : ""}
            <ChevronRight size={14} />
          </summary>
          <p className="fi-hint">
            Cada informe conserva las fichas y el contexto disponibles al
            prepararlo. Usa «Exportar», arriba, para descargar las fichas,
            informes y tus notas y revisarlos conmigo.
          </p>
          {latestBrief ? (
            <div className="fi-news-briefs">
              {data!.briefs.map((brief) => (
                <details key={brief.id} className="fi-news-brief">
                  <summary>
                    <strong>Informe del {day(brief.date)}</strong>
                    <span>
                      {brief.eventCount} noticias · captura{" "}
                      {day(brief.createdAt)}
                    </span>
                    <ChevronRight size={13} />
                  </summary>
                  <div>
                    <h4>Temas observados</h4>
                    <p>
                      {brief.themes
                        .map((theme) => `${theme.label} (${theme.count})`)
                        .join(" · ") || "Sin agrupación suficiente."}
                    </p>
                    <h4>Empresas mencionadas</h4>
                    <p>
                      {brief.companyCounts
                        .map(
                          (company) =>
                            `${company.name} (${company.count})${company.private ? " · privada" : ""}`,
                        )
                        .join("; ") || "Sin empresas identificadas."}
                    </p>
                    <h4>Preguntas abiertas</h4>
                    <ul>
                      {brief.questions.map((question) => (
                        <li key={question}>{question}</li>
                      ))}
                    </ul>
                    {brief.quoteContext.length ? (
                      <details className="fi-compact">
                        <summary>
                          Cotizaciones de contexto al preparar este informe
                        </summary>
                        <ul>
                          {brief.quoteContext.map((quote) => (
                            <li key={quote.symbol}>
                              <strong>{quote.symbol}</strong> ·{" "}
                              {Number.isFinite(quote.price)
                                ? new Intl.NumberFormat("es-MX", {
                                    style: "currency",
                                    currency: quote.currency,
                                  }).format(quote.price)
                                : "Pendiente"}{" "}
                              · sesión {day(quote.tradingDay)} ·{" "}
                              {quote.provider}
                              <small>
                                Consultada {day(quote.fetchedAt)}. Variación de
                                la sesión{" "}
                                {Number.isFinite(quote.percent)
                                  ? `${quote.percent.toFixed(2)} %`
                                  : "pendiente"}
                                .
                              </small>
                            </li>
                          ))}
                        </ul>
                        <p className="fi-footnote">
                          Es contexto guardado al preparar el informe. Una
                          cotización posterior a la publicación no indica qué se
                          sabía entonces ni demuestra que la noticia causara el
                          movimiento.
                        </p>
                      </details>
                    ) : null}
                    <p className="fi-footnote">{brief.caveat}</p>
                    <details className="fi-compact">
                      <summary>Fuentes de este corte</summary>
                      <ul>
                        {brief.eventIds.map((id) => {
                          const event =
                            events.find((item) => item.id === id) ??
                            data!.reviews.find(
                              (review) => review.snapshot.id === id,
                            )?.snapshot;
                          const url = safeLink(event?.url);
                          return (
                            <li key={id}>
                              {event && url ? (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {event.title} <ArrowUpRight size={11} />
                                </a>
                              ) : (
                                <span>
                                  Fuente conservada en el archivo completo; usa
                                  Exportar para consultar ese corte.
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <p className="fi-hint">
              Aún no hay un informe financiero guardado. Se preparará durante la
              actualización; las noticias no necesitan una cartera registrada.
            </p>
          )}
        </details>
      ) : null}
      {data?.message && !compact ? (
        <p className="fi-footnote">{data.message}</p>
      ) : null}
    </section>
  );
}
