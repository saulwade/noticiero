import {
  companies as catalog,
  findCompanies,
  getCompany,
} from "@/features/market/company-catalog";
import {
  canonicalUrl,
  hash,
  plainText,
  safePublicUrl,
} from "@/features/news/normalize";
import { extractiveDigest } from "@/features/analysis/local-summary";
import { validDay } from "./market-calendar";
import { editionFor } from "@/lib/time";
import type { Quote, Story } from "@/lib/types";
import type {
  FinanceNewsBrief,
  FinanceNewsEvent,
  FinancialEventKind,
} from "./research-types";

export const FINANCE_NEWS_ENGINE_VERSION = "finance-news-v1";
const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const kinds: {
  kind: FinancialEventKind;
  topic: string;
  pattern: RegExp;
  hypothesis: string;
  questions: string[];
  missing: string[];
}[] = [
  {
    kind: "regulation",
    topic: "Regulación y litigios",
    pattern:
      /\b(antitrust|lawsuits?|court|regulat\w*|tariffs?|charter|sanctions?|arancel\w*|sancion\w*|litigio\w*|demanda judicial|tribunal\w*)\b/,
    hypothesis:
      "Si el proceso descrito modifica permisos, obligaciones o competencia, podría cambiar costos o acceso al mercado; falta contrastar su alcance y vigencia.",
    questions: [
      "¿Qué resolución o documento oficial confirma el alcance y desde cuándo aplica?",
      "¿Qué ingresos o costos podrían verse expuestos, y qué evidencia contradice esa hipótesis?",
    ],
    missing: [
      "Documento oficial, estado del proceso y fecha efectiva.",
      "Exposición financiera cuantificada y alternativas de cumplimiento.",
    ],
  },
  {
    kind: "security",
    topic: "Seguridad y continuidad",
    pattern:
      /\b(breach\w*|hacked|ransomware|malware|fraud\w*|cyberattack\w*|ciberataque\w*|filtracion\w*|hackeo\w*)\b/,
    hypothesis:
      "Si el incidente afecta operaciones o contratos, podría generar costos o pérdida de clientes; la mención por sí sola no cuantifica daños ni demuestra impacto bursátil.",
    questions: [
      "¿Qué confirmó la organización y qué sigue siendo una alegación?",
      "¿Hay interrupciones, obligaciones o costos documentados, y cuál sería su duración?",
    ],
    missing: [
      "Confirmación del incidente y perímetro afectado.",
      "Costos, duración y contratos afectados con fuentes verificables.",
    ],
  },
  {
    kind: "earnings",
    topic: "Resultados y perspectivas",
    pattern:
      /\b(earnings|quarterly results|financial results|revenue|profits?|margins?|guidance|resultados financieros|ingresos|beneficios|utilidad\w*|margenes)\b/,
    hypothesis:
      "Conviene contrastar ingresos, márgenes, flujo de caja y expectativas del período; una cifra aislada podría ocultar cambios en costos o efectos extraordinarios.",
    questions: [
      "¿Qué período, unidad y documento sustentan la cifra, y con qué base se compara?",
      "¿El cambio se refleja en flujo de caja y márgenes o depende de partidas extraordinarias?",
    ],
    missing: [
      "Reporte oficial, período y comparación homogénea.",
      "Márgenes, flujo de caja y supuestos de las perspectivas.",
    ],
  },
  {
    kind: "acquisition",
    topic: "Adquisiciones y acuerdos",
    pattern:
      /\b(acquisit\w*|acquir\w*|merger\w*|takeover\w*|buyout\w*|adquisicion\w*|fusion\w*|compra de empresa\w*)\b/,
    hypothesis:
      "Si se confirma y concreta el acuerdo, conviene revisar precio, financiación y condiciones; rumores, propuestas y cierres consumados son etapas distintas.",
    questions: [
      "¿Se trata de rumor, negociación, acuerdo firmado o cierre, y qué fuente lo confirma?",
      "¿Cómo se financiaría y qué condiciones o riesgos podrían impedir su concreción?",
    ],
    missing: [
      "Etapa confirmada, términos y autorizaciones pendientes.",
      "Financiación, costos de integración y supuestos verificables.",
    ],
  },
  {
    kind: "funding",
    topic: "Financiación y capital",
    pattern:
      /\b(funding|financing|fundrais\w*|raises? (?:new |a |\$|capital)|ipo|valuation|debt issuance|financiacion|financiamiento|ronda de|recaud\w*|emision de deuda|salida a bolsa)\b/,
    hypothesis:
      "Si se confirman las condiciones de financiación, podrían cambiar la liquidez, las obligaciones o la dilución; el monto anunciado no equivale a ingresos ni a rentabilidad.",
    questions: [
      "¿Qué parte es capital, deuda o un compromiso condicionado y qué términos se conocen?",
      "¿Qué necesidades cubre, cuánto tiempo financiaría y qué información falta para evaluar dilución u obligaciones?",
    ],
    missing: [
      "Condiciones, instrumentos y desembolso efectivo.",
      "Liquidez, obligaciones y posible dilución documentadas.",
    ],
  },
  {
    kind: "infrastructure",
    topic: "Infraestructura e inversión",
    pattern:
      /\b(data centers?|data centres?|capital spending|capital expenditure|capex|power capacity|semiconductor plants?|chip factories|centros? de datos|infraestructura|gasto de capital|capacidad electrica)\b/,
    hypothesis:
      "Si la inversión se ejecuta, podría ampliar capacidad y comprometer caja; conviene contrastar demanda, financiación, permisos y plazo antes de inferir beneficios.",
    questions: [
      "¿Qué parte está aprobada, contratada o solo anunciada y en qué plazo se ejecutaría?",
      "¿Qué demanda y retorno esperado sustentan el gasto y qué restricciones podrían retrasarlo?",
    ],
    missing: [
      "Presupuesto, financiación y calendario verificables.",
      "Demanda contratada, costos operativos y restricciones de capacidad.",
    ],
  },
  {
    kind: "macro",
    topic: "Tasas y economía",
    pattern:
      /\b(interest rates?|federal reserve|central banks?|inflation|monetary policy|unemployment|gdp|bond yields?|tasas? de interes|bancos? centrales?|inflacion|politica monetaria|desempleo|pib|rendimientos? de bonos)\b/,
    hypothesis:
      "Un cambio macroeconómico podría alterar financiación, demanda o divisas de forma distinta por empresa; hace falta medir exposición y evitar extrapolar una noticia a todos los activos.",
    questions: [
      "¿Qué dato o decisión oficial se publicó, con qué período y revisiones?",
      "¿Qué empresas tienen exposición verificable a esa variable y qué otras explicaciones deben contrastarse?",
    ],
    missing: [
      "Serie o comunicado oficial, período y revisiones.",
      "Exposición específica y escenarios alternativos.",
    ],
  },
  {
    kind: "products",
    topic: "Productos, precios y contratos",
    pattern:
      /\b(launch\w*|subscription\w*|pricing|prices?|contracts?|customers?|new products?|introduc\w*|lanz\w*|suscrip\w*|precios?|contratos?|clientes?|nuevos? productos?)\b/,
    hypothesis:
      "Si cambian precios, contratos o adopción, podrían variar ingresos y costos; el anuncio de un producto no demuestra demanda ni beneficios futuros.",
    questions: [
      "¿Qué precio, disponibilidad o condiciones se confirmaron y qué clientes reales se conocen?",
      "¿Qué adopción, retención o margen permitirían evaluar la hipótesis y qué la invalidaría?",
    ],
    missing: [
      "Condiciones y disponibilidad publicadas.",
      "Adopción, retención y economía del producto verificables.",
    ],
  },
];
const businessPattern =
  /\b(stock\w*|shares?|bank\w*|loans?|credit|payments?|layoffs?|costs?|cash flow|debt|loss(?:es)?|business|bolsa|acciones|banc\w*|creditos?|prestamos?|pagos?|despidos?|costos?|flujo de caja|deuda|negocio\w*)\b/;
const promotional =
  /\b(register now|get tickets|days? left|gift cards?|best .{0,30}deals?|coupon\w*|subscribe to|sign up for|sponsored|registra\w* ahora|compra tus boletos|ultimos dias|suscribete|descuentos exclusivos)\b/;
const personalReview =
  /^(?:i (?:built|tried|made)|my .{0,30}(?:setup|keyboard)|keyboards of|staff picks|what i use|how i built)/;
function eventKind(title: string, text: string) {
  return (
    kinds.find((k) => k.pattern.test(title)) ??
    kinds.find((k) => k.pattern.test(text))
  );
}
function validInstant(value: string, now: Date) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) ||
    !validDay(value.slice(0, 10))
  )
    return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && time <= now.getTime();
}
function companyMentions(text: string): FinanceNewsEvent["companies"] {
  const normalized = normalize(text);
  const found = new Set(findCompanies(text));
  for (const company of catalog)
    if (
      company.symbol.length >= 3 &&
      new RegExp(`\\b${company.symbol}\\b`).test(text) &&
      businessPattern.test(normalized)
    )
      found.add(company.symbol);
  const corporateContext =
    businessPattern.test(normalized) ||
    kinds.some((k) => k.kind !== "products" && k.pattern.test(normalized));
  const explicitApple =
    /\b(iphone|macbook|ipad|macos|tim cook|apple inc|apple's|apple (?:ceo|announc\w*|reports?|earnings|shares?|stock|launch\w*|revenue))\b/.test(
      normalized,
    );
  const appleFruit =
    /\b(apple (?:harvest|fruit|farm|tree|orchard)|(?:harvest|fruit|farm|orchard)\w* (?:of |with )?apples?)\b/.test(
      normalized,
    );
  if (found.has("AAPL") && !explicitApple && (!corporateContext || appleFruit))
    found.delete("AAPL");
  if (
    found.has("META") &&
    /\bmeta analys\w*\b/.test(normalized) &&
    !/\b(facebook|instagram|whatsapp|zuckerberg)\b/.test(normalized)
  )
    found.delete("META");
  const explicitAmazon =
    /\b(amazon\.com|amazon web services|aws|amazon (?:ceo|announc\w*|reports?|earnings|shares?|stock|revenue))\b/.test(
      normalized,
    );
  const amazonGeography =
    /\b(amazon (?:river|rainforest|forest|basin)|(?:river|rainforest|forest|basin) (?:of |in |near )?(?:the )?amazon)\b/.test(
      normalized,
    );
  if (
    found.has("AMZN") &&
    !explicitAmazon &&
    (!corporateContext || amazonGeography)
  )
    found.delete("AMZN");
  return [...found].sort().flatMap((symbol) => {
    const company = getCompany(symbol);
    return company
      ? [{ symbol, name: company.name, private: Boolean(company.private) }]
      : [];
  });
}
const favorable = new Set(
  "growth grew grows gain gains profitable profit profits approved approval expansion improves improved crecimiento crecio ganancias rentable beneficio beneficios aprobado aprobada expansion mejora mejoro".split(
    " ",
  ),
);
const adverse = new Set(
  "decline declines declining loss losses layoffs breach breaches hacked fraud banned ban fined lawsuit deterioro perdidas perdida despidos fraude prohibido sancion multa filtracion caida cayo".split(
    " ",
  ),
);
const negators = new Set(
  "not no never without sin nunca niega denies denied cannot can't doesn't won't".split(
    " ",
  ),
);
function textualTone(text: string): FinanceNewsEvent["tone"] {
  const terms = normalize(text).match(/[\p{L}\p{N}']+|[.;!?]/gu) ?? [];
  const positive = new Set<string>(),
    negative = new Set<string>();
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    if (!favorable.has(term) && !adverse.has(term)) continue;
    const preceding = terms.slice(Math.max(0, i - 5), i);
    const lastBoundary = preceding.findLastIndex(
      (t) => /[.;!?]/.test(t) || /^(but|pero|however|aunque)$/.test(t),
    );
    const clause = preceding.slice(lastBoundary + 1);
    const negated = clause.some(
      (t, n) => negators.has(t) && !(t === "not" && clause[n + 1] === "only"),
    );
    if (negated) continue;
    if (favorable.has(term)) positive.add(term);
    else negative.add(term);
  }
  return {
    label:
      positive.size && negative.size
        ? "mixed"
        : positive.size
          ? "favorable"
          : negative.size
            ? "adverse"
            : "unclassified",
    positiveTerms: [...positive].sort().slice(0, 12),
    negativeTerms: [...negative].sort().slice(0, 12),
    method: "Diccionario bilingüe con negación local · v1",
    caveat:
      "Describe lenguaje del texto disponible; no mide rentabilidad, no verifica hechos ni es una recomendación de inversión. La negación distante, la ironía y el contexto pueden cambiar el sentido.",
  };
}
const keywordVocabulary =
  /^(revenue|earnings|profit\w*|margins?|guidance|funding|financing|debt|cash|growth|costs?|prices?|contracts?|inflation|rates?|regulat\w*|acquisit\w*|merger\w*|capex|breach\w*|layoffs?|ingresos|resultados|beneficios|utilidad\w*|margen\w*|financi\w*|deuda|costos?|precios?|contratos?|inflacion|tasas?|regulac\w*|adquisicion\w*|infraestructura|despidos?)$/;
function articleKey(input: string) {
  const safe = safePublicUrl(input);
  if (!safe) return;
  const url = new URL(safe),
    parts = url.pathname.split("/").filter(Boolean);
  const generic = new Set([
    "news",
    "newsroom",
    "press",
    "press-releases",
    "investors",
    "investor-relations",
    "docs",
    "documentation",
    "archives",
    "edgar",
    "data",
    "support",
    "research",
    "blog",
    "articles",
    "markets",
    "business",
    "finance",
    "about",
    "reports",
    "financials",
    "en",
    "es",
  ]);
  if (!parts.length || parts.every((part) => generic.has(part.toLowerCase())))
    return;
  if (parts.length < 2 && (parts[0]?.length ?? 0) < 16) return;
  return canonicalUrl(safe);
}
export function buildFinanceNewsEvent(
  story: Story,
  now = new Date(),
): FinanceNewsEvent | undefined {
  if (!Number.isFinite(now.getTime()) || !validInstant(story.publishedAt, now))
    return;
  const safe = safePublicUrl(story.url);
  if (!safe) return;
  if (
    ["comment", "question", "research", "launch"].includes(story.kind ?? "") ||
    /^(?:ask-hn|show-hn|yc-rfs)$/.test(story.sourceId)
  )
    return;
  const title = plainText(story.originalTitle ?? story.title).slice(0, 400),
    excerpt = plainText(story.excerpt).slice(0, 3000);
  if (!title) return;
  const titleText = normalize(title),
    text = normalize(`${title} ${excerpt}`);
  if (
    /^(?:ask hn|show hn|tell hn):/.test(titleText) ||
    promotional.test(titleText) ||
    personalReview.test(titleText)
  )
    return;
  const companies = companyMentions(`${title} ${excerpt}`),
    kind = eventKind(titleText, text);
  const hardFinance =
    Boolean(kind && kind.kind !== "products") || businessPattern.test(text);
  if (!(
    story.category === "Finanzas" ||
    hardFinance ||
    (companies.length && kind?.kind === "products")
  ))
    return;
  if (!companies.length && story.category !== "Finanzas" && !kind) return;
  const digest =
    story.coverage !== "headline"
      ? extractiveDigest(excerpt, title)
      : undefined;
  const sourceName = plainText(story.sourceName).slice(0, 200);
  const publishedAt = new Date(story.publishedAt).toISOString();
  const imageUrl = safePublicUrl(story.imageUrl);
  const relatedStoryIds = [
    ...new Set(
      (story.relatedIds ?? []).filter(
        (id) => typeof id === "string" && id.length > 0 && id.length <= 100,
      ),
    ),
  ]
    .sort()
    .slice(0, 10);
  const relatedUrls = [
    ...new Set(
      (story.references ?? []).flatMap((reference) => {
        const key = articleKey(reference.url);
        return key ? [key] : [];
      }),
    ),
  ]
    .sort()
    .slice(0, 10);
  // All retained source metadata participates in identity; capturedAt is deliberately
  // excluded so re-reading the same evidence cannot rewrite its first observation.
  const raw = JSON.stringify({
    title,
    excerpt,
    category: story.category,
    coverage: story.coverage,
    url: canonicalUrl(safe),
    companies,
    sourceId: story.sourceId,
    sourceName,
    publishedAt,
    imageUrl,
    relatedStoryIds,
    relatedUrls,
  });
  const event: FinanceNewsEvent = {
    id: hash(
      `${FINANCE_NEWS_ENGINE_VERSION}:${story.id}:${story.contentHash}:${hash(raw)}`,
    ),
    storyId: story.id,
    contentHash: story.contentHash,
    engineVersion: FINANCE_NEWS_ENGINE_VERSION,
    title,
    url: canonicalUrl(safe),
    sourceId: story.sourceId,
    sourceName,
    publishedAt,
    capturedAt: now.toISOString(),
    category: story.category,
    coverage: story.coverage,
    excerpt,
    summary: digest?.text ?? title,
    summaryLanguage: digest?.language ?? "unknown",
    imageUrl,
    companies,
    eventKind: kind?.kind ?? "business",
    topic: kind?.topic ?? "Actividad empresarial",
    keywords: [
      ...new Set(
        (text.match(/[\p{L}]{3,}/gu) ?? []).filter((t) =>
          keywordVocabulary.test(t),
        ),
      ),
    ].slice(0, 12),
    mechanismHypothesis:
      kind?.hypothesis ??
      "Conviene contrastar qué cambió en el negocio y qué variables financieras podrían verse expuestas; la publicación no determina por sí sola una decisión de inversión.",
    questions: kind?.questions ?? [
      "¿Qué hecho se confirmó y qué parte sigue siendo una interpretación?",
      "¿Qué ingresos, costos, caja o riesgos podrían verse expuestos y qué fuente permitiría comprobarlo?",
    ],
    missingEvidence: [
      ...(story.coverage === "headline"
        ? [
            "Solo hay un titular disponible; falta el contenido completo y su contexto.",
          ]
        : []),
      ...(kind?.missing ?? [
        "Documento o declaración original con su fecha.",
        "Variables financieras y evidencia que contradiga la hipótesis.",
      ]),
    ],
    tone: textualTone(`${title}. ${excerpt}`),
    relatedStoryIds,
    relatedUrls,
  };
  return event;
}
export function selectLatestFinanceEvents(
  events: FinanceNewsEvent[],
): FinanceNewsEvent[] {
  // Union first, then select, so a later-encountered bridge between two explicit
  // related groups does not leave two representatives in the result.
  const parent = events.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };
  const union = (left: number, right: number) => {
    const a = find(left),
      b = find(right);
    if (a !== b) parent[b] = a;
  };
  const seen = new Map<string, number>();
  events.forEach((event, index) => {
    const keys = [
      ...[event.storyId, ...(event.relatedStoryIds ?? [])].map(
        (id) => `story:${id}`,
      ),
      ...[event.url, ...(event.relatedUrls ?? [])].flatMap((url) => {
        const key = articleKey(url);
        return key ? [`url:${key}`] : [];
      }),
      `title:${event.publishedAt.slice(0, 10)}:${normalize(event.title)
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()}`,
    ];
    for (const key of keys) {
      const old = seen.get(key);
      if (old !== undefined) union(index, old);
      else seen.set(key, index);
    }
  });
  const latest = new Map<number, FinanceNewsEvent>();
  events.forEach((event, index) => {
    const group = find(index),
      old = latest.get(group);
    if (
      !old ||
      event.capturedAt > old.capturedAt ||
      (event.capturedAt === old.capturedAt &&
        ((event.revision ?? 0) > (old.revision ?? 0) ||
          ((event.revision ?? 0) === (old.revision ?? 0) && event.id > old.id)))
    )
      latest.set(group, event);
  });
  return [...latest.values()].sort(
    (a, b) =>
      b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id),
  );
}

function validQuote(quote: Quote, day: string, now: Date) {
  const company = getCompany(quote.symbol);
  return (
    company &&
    !company.private &&
    quote.currency === "USD" &&
    quote.provider === "Alpha Vantage" &&
    Number.isFinite(quote.price) &&
    quote.price > 0 &&
    Number.isFinite(quote.change) &&
    Number.isFinite(quote.percent) &&
    validDay(quote.tradingDay) &&
    quote.tradingDay <= day &&
    validInstant(quote.fetchedAt, now)
  );
}
export function buildFinanceNewsBrief(
  events: FinanceNewsEvent[],
  quotes: Quote[],
  now = new Date(),
): FinanceNewsBrief {
  const day = editionFor(now).date;
  const observed = selectLatestFinanceEvents(
    events.filter(
      (e) =>
        validInstant(e.publishedAt, now) &&
        validInstant(e.capturedAt, now) &&
        editionFor(new Date(e.capturedAt)).date === day,
    ),
  );
  const companyMap = new Map<
      string,
      FinanceNewsBrief["companyCounts"][number]
    >(),
    themes = new Map<string, number>();
  for (const event of observed) {
    for (const company of event.companies) {
      const old = companyMap.get(company.symbol);
      companyMap.set(company.symbol, {
        ...company,
        count: (old?.count ?? 0) + 1,
      });
    }
    themes.set(event.topic, (themes.get(event.topic) ?? 0) + 1);
  }
  const quoteMap = new Map<string, Quote>();
  for (const quote of quotes
    .filter((q) => q && typeof q.fetchedAt === "string")
    .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt)))
    if (
      companyMap.has(quote.symbol) &&
      validQuote(quote, day, now) &&
      !quoteMap.has(quote.symbol)
    )
      quoteMap.set(quote.symbol, {
        symbol: quote.symbol,
        price: quote.price,
        change: quote.change,
        percent: quote.percent,
        currency: quote.currency,
        tradingDay: quote.tradingDay,
        fetchedAt: quote.fetchedAt,
        provider: quote.provider,
      });
  const quoteContext = [...quoteMap.values()]
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
    .slice(0, 8);
  const eventIds = observed.map((e) => e.id).sort();
  return {
    id: hash(
      `${FINANCE_NEWS_ENGINE_VERSION}:${day}:${JSON.stringify(eventIds)}:${JSON.stringify(quoteContext)}`,
    ),
    date: day,
    createdAt: now.toISOString(),
    engineVersion: FINANCE_NEWS_ENGINE_VERSION,
    eventIds,
    eventCount: observed.length,
    companyCounts: [...companyMap.values()].sort(
      (a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol),
    ),
    themes: [...themes]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    questions: [...new Set(observed.flatMap((e) => e.questions))].slice(0, 5),
    quoteContext,
    caveat:
      "Cuenta fichas observadas y preparadas en esta fecha CDMX; sus artículos pueden haberse publicado antes. Frecuencia de menciones no demuestra rentabilidad ni fuentes independientes. Las cotizaciones son contexto disponible al preparar el informe, no información conocida necesariamente en la publicación de cada noticia, y no prueban causalidad bursátil.",
  };
}
