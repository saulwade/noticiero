import { describe, expect, it } from "vitest";
import {
  buildFinanceNewsEvent,
  buildFinanceNewsBrief,
  selectLatestFinanceEvents,
  FINANCE_NEWS_ENGINE_VERSION,
} from "@/features/finance/news-research";
import type { Story, Quote } from "@/lib/types";
const now = new Date("2026-10-31T23:00:00Z");
function story(fields: Partial<Story> = {}): Story {
  return {
    id: "a",
    url: "https://example.com/news/a",
    title: "NVIDIA reports revenue growth",
    sourceId: "source",
    sourceName: "Published source",
    publishedAt: "2026-10-31T18:00:00Z",
    detectedAt: now.toISOString(),
    excerpt:
      "NVIDIA reported revenue growth of 12 percent for the quarter. The company said costs also increased and did not provide a new forecast.",
    coverage: "excerpt",
    analysis: "ready",
    category: "Chips",
    companies: ["NVDA"],
    references: [],
    score: 1,
    contentHash: "source-hash",
    kind: "news",
    ...fields,
  };
}
const event = (fields: Partial<Story> = {}) =>
  buildFinanceNewsEvent(story(fields), now)!;
const quote: Quote = {
  symbol: "NVDA",
  price: 150,
  change: -2,
  percent: -1.32,
  currency: "USD",
  tradingDay: "2026-10-30",
  fetchedAt: "2026-10-31T20:00:00Z",
  provider: "Alpha Vantage",
};
describe("fichas financieras sin cartera ni llamadas externas", () => {
  it("produce una ficha con fuente, cifras y preguntas sin posiciones", () => {
    const e = event();
    expect(e.eventKind).toBe("earnings");
    expect(e.companies[0].symbol).toBe("NVDA");
    expect(e.summary).toContain("12 percent");
    expect(e.mechanismHypothesis).toMatch(/podría|conviene|si /i);
    expect(e.questions.length).toBeGreaterThan(1);
    expect(e.engineVersion).toBe(FINANCE_NEWS_ENGINE_VERSION);
  });
  it("preserva el titular original y no utiliza una traducción generada como evidencia", () => {
    const e = event({
      originalTitle: "NVIDIA reports revenue growth",
      title: "NVIDIA garantiza rendimientos",
      summary: "Esta acción subirá mañana.",
    });
    expect(e.title).toBe("NVIDIA reports revenue growth");
    expect(e.summary).not.toContain("subirá");
  });
  it("no transforma el solo titular en un artículo o afirmación adicional", () => {
    const e = event({
      coverage: "headline",
      excerpt: "",
      title: "NVIDIA may report a loss",
    });
    expect(e.coverage).toBe("headline");
    expect(e.summary).toBe(e.title);
    expect(e.missingEvidence.join(" ")).toMatch(/titular|completo/i);
  });
  it("conserva negaciones en el resumen y suprime la señal negada", () => {
    const e = event({
      title: "NVIDIA reports results",
      excerpt:
        "NVIDIA said the business was not profitable this quarter. It did not report losses or layoffs and has not issued a new forecast.",
    });
    expect(e.summary).toContain("not profitable");
    expect(e.tone.positiveTerms).not.toContain("profitable");
    expect(e.tone.negativeTerms).not.toContain("losses");
  });
  it("identifica lenguaje favorable sin llamarlo rentabilidad", () => {
    const e = event({
      excerpt:
        "NVIDIA reported profitable growth and gains for its business. The revenue figure increased compared with the prior quarter.",
    });
    expect(e.tone.label).toBe("favorable");
    expect(e.tone.caveat).toMatch(/rentabilidad|recomendación/i);
  });
  it("identifica lenguaje adverso sin añadir una orden", () => {
    const e = event({
      title: "Microsoft discloses breach and losses",
      excerpt:
        "Microsoft disclosed a breach that caused losses for its business. The published article did not quantify the affected contracts.",
      companies: ["MSFT"],
    });
    expect(e.tone.label).toBe("adverse");
    expect(e.mechanismHypothesis).not.toMatch(/vende|compra|subirá|bajará/i);
  });
  it("mantiene señal mixta cuando hay lenguaje en ambas direcciones", () => {
    const e = event({
      excerpt:
        "NVIDIA reported revenue growth and profits for the quarter. It also reported losses and layoffs in a separate unit.",
    });
    expect(e.tone.label).toBe("mixed");
  });
  it("admite noticias financieras globales sin empresa de catálogo", () => {
    const e = event({
      title: "Banco regional reduce tasas de sus créditos",
      excerpt:
        "El banco regional anunció cambios en sus créditos para empresas. El nuevo esquema modifica las tasas y las comisiones de contratación.",
      category: "Finanzas",
      companies: [],
    });
    expect(e).toBeDefined();
    expect(e.companies).toEqual([]);
  });
  it("clasifica regulación como un tema de investigación", () => {
    expect(
      event({
        title: "Court allows antitrust lawsuit against Apple",
        excerpt:
          "A court allowed the antitrust lawsuit against Apple to proceed. The article does not establish a final ruling or a financial penalty.",
      }).eventKind,
    ).toBe("regulation");
  });
  it("mantiene Apple en litigios y Amazon en inversión sin exigir un alias de producto", () => {
    const apple = event({
      title: "Court allows antitrust lawsuit against Apple",
      excerpt:
        "A court allowed an antitrust lawsuit against Apple to proceed. No final ruling or financial penalty was announced.",
    });
    expect(apple.companies.some((c) => c.symbol === "AAPL")).toBe(true);
    const amazon = event({
      title: "Amazon invests billions in data centers",
      excerpt:
        "Amazon announced capital spending on data centers. The project remains subject to permits and financing.",
    });
    expect(amazon.companies.some((c) => c.symbol === "AMZN")).toBe(true);
  });
  it("clasifica financiación sin asumir que una empresa privada cotiza", () => {
    const e = event({
      title: "OpenAI raises new funding",
      excerpt:
        "OpenAI raised a new financing round to fund operations. The company did not disclose all of the investment terms.",
      companies: ["OPENAI"],
    });
    expect(e.eventKind).toBe("funding");
    expect(e.companies.find((c) => c.symbol === "OPENAI")?.private).toBe(true);
  });
  it("clasifica adquisición sin afirmar que el acuerdo se consumó", () => {
    const e = event({
      title: "Microsoft denies acquisition talks",
      excerpt:
        "Microsoft denied acquisition talks with the smaller company. There is no announced transaction or confirmed purchase price.",
    });
    expect(e.eventKind).toBe("acquisition");
    expect(e.summary).toContain("denied");
    expect(e.mechanismHypothesis).not.toContain("adquirió");
  });
  it("clasifica infraestructura y macroeconomía", () => {
    expect(
      event({
        title: "NVIDIA announces data center investment",
        excerpt:
          "NVIDIA announced capital spending for data centers and power capacity. The proposal remains subject to permits and financing.",
      }).eventKind,
    ).toBe("infrastructure");
    expect(
      event({
        title: "Federal Reserve changes interest rates",
        excerpt:
          "The Federal Reserve announced a new interest rate decision. The central bank published its monetary policy statement.",
        companies: [],
        category: "Finanzas",
      }).eventKind,
    ).toBe("macro");
  });
  it("no usa palabras de una promoción como una tesis de inversión", () => {
    expect(
      buildFinanceNewsEvent(
        story({
          title: "4 days left: Register now for our investor summit",
          excerpt:
            "Get tickets for our funding and revenue conference. Subscribe to the newsletter for special discounts.",
        }),
        now,
      ),
    ).toBeUndefined();
  });
  it("excluye comentarios, preguntas, investigación editorial y proyectos hobby de HN", () => {
    for (const kind of ["comment", "question", "research", "launch"] as const)
      expect(buildFinanceNewsEvent(story({ kind }), now)).toBeUndefined();
    expect(
      buildFinanceNewsEvent(
        story({
          sourceId: "show-hn",
          title: "Show HN: I built a stock tracker",
        }),
        now,
      ),
    ).toBeUndefined();
  });
  it("excluye noticias tecnológicas sin relación financiera concreta", () => {
    expect(
      buildFinanceNewsEvent(
        story({
          title: "A keyboard shortcut for my desktop",
          excerpt:
            "A new keyboard combination changes the background color. This tutorial explains how to configure a desktop shortcut.",
          companies: [],
          category: "Software",
        }),
        now,
      ),
    ).toBeUndefined();
  });
  it("no convierte Apple fruta, Amazon río o meta análisis en empresas", () => {
    const e = event({
      title: "Regional farming revenues and apple harvest",
      excerpt:
        "The apple harvest brought revenue growth for local farms. Researchers conducted a meta analysis near the Amazon river.",
      category: "Finanzas",
      companies: ["AAPL", "META", "AMZN"],
    });
    expect(e.companies).toEqual([]);
  });
  it("rechaza enlaces peligrosos, credenciales embebidas y fechas futuras o inválidas", () => {
    for (const fields of [
      { url: "javascript:alert(1)" },
      { url: "https://user:pass@example.com/news" },
      { publishedAt: "2026-11-01T20:00:00Z" },
      { publishedAt: "not-a-date" },
      { publishedAt: "2026-02-30T18:00:00Z" },
    ])
      expect(buildFinanceNewsEvent(story(fields), now)).toBeUndefined();
  });
  it("sanea HTML e imágenes sin descargar contenido", () => {
    const e = event({
      excerpt:
        "<script>bad()</script><p>NVIDIA reported revenue growth of 12 percent for the quarter.</p>",
      imageUrl: "javascript:alert(1)",
    });
    expect(e.excerpt).not.toMatch(/script|bad\(\)|<p>/);
    expect(e.imageUrl).toBeUndefined();
  });
  it("genera ID estable, versiona cambios reales incluso si el hash de origen no cambia", () => {
    expect(event().id).toBe(event().id);
    expect(
      event({
        excerpt:
          "NVIDIA reported a revenue decline of 8 percent for the quarter. The company published a revised statement.",
      }).id,
    ).not.toBe(event().id);
    expect(event().contentHash).toBe("source-hash");
  });
  it("versiona correcciones de metadatos conservados y excluye la hora de captura de la identidad", () => {
    const original = event();
    const corrections: Partial<Story>[] = [
      { publishedAt: "2026-10-31T19:00:00Z" },
      { sourceId: "corrected" },
      { sourceName: "Corrected source" },
      { imageUrl: "https://images.example.com/image.png" },
      { relatedIds: ["related"] },
      {
        references: [
          {
            name: "Related source",
            url: "https://another.com/articles/long-article",
          },
        ],
      },
    ];
    for (const correction of corrections)
      expect(event(correction).id).not.toBe(original.id);
    const later = buildFinanceNewsEvent(
      story(),
      new Date(now.getTime() + 60000),
    );
    expect(later?.id).toBe(original.id);
    expect(later?.capturedAt).not.toBe(original.capturedAt);
  });
  it("la revisión más reciente prevalece sin mutar las copias", () => {
    const old = event();
    const latest = {
      ...event({ title: "NVIDIA revises earnings report" }),
      capturedAt: "2026-10-31T23:01:00Z",
    };
    const copies = structuredClone([old, latest]);
    const result = selectLatestFinanceEvents([old, latest]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(latest.id);
    expect([old, latest]).toEqual(copies);
  });
  it("deduplica URL canónica y titulares exactos de la misma fecha", () => {
    const a = event();
    const b = event({
      id: "b",
      url: "https://example.com/news/a?utm_source=rss",
    });
    const c = event({
      id: "c",
      url: "https://publisher.com/story",
      sourceName: "Syndicated",
    });
    expect(selectLatestFinanceEvents([a, b, c])).toHaveLength(1);
  });
  it("deduplica relaciones explícitas transitivas aunque el puente sea la captura más antigua", () => {
    const a = event();
    const b = event({
      id: "b",
      url: "https://example.com/news/b",
      title: "Microsoft announces a contract",
      excerpt:
        "Microsoft announced a new cloud contract with customers. Its financial terms were not disclosed.",
    });
    const bridge = {
      ...event({
        id: "bridge",
        url: "https://example.com/news/c",
        title: "Alphabet changes pricing",
        excerpt:
          "Alphabet changed its subscription prices for cloud customers. The published terms apply to new contracts.",
      }),
      capturedAt: "2026-10-31T21:00:00Z",
      relatedStoryIds: [a.storyId, b.storyId],
    };
    expect(selectLatestFinanceEvents([a, b, bridge])).toHaveLength(1);
  });
  it("no agrupa por referencias genéricas compartidas", () => {
    const a = {
      ...event(),
      relatedUrls: [
        "https://example.com/",
        "https://www.sec.gov/Archives/edgar",
      ],
    };
    const b = {
      ...event({
        id: "b",
        url: "https://example.com/news/b",
        title: "Microsoft announces a contract",
        excerpt:
          "Microsoft announced a cloud contract with a business customer. Its financial conditions were not disclosed.",
      }),
      relatedUrls: [
        "https://example.com/",
        "https://www.sec.gov/Archives/edgar",
      ],
    };
    expect(selectLatestFinanceEvents([a, b])).toHaveLength(2);
  });
  it("limita relaciones de origen y distingue negación antes de una conjunción", () => {
    const e = event({
      excerpt:
        "NVIDIA did not report losses but reported growth for its business. The company has not provided a new forecast.",
      relatedIds: Array.from({ length: 20 }, (_, i) => `story-${i}`),
    });
    expect(e.relatedStoryIds).toHaveLength(10);
    expect(e.tone.label).toBe("favorable");
  });
  it("no mezcla titulares iguales de fechas distintas", () => {
    const a = event();
    const b = event({
      id: "b",
      url: "https://example.com/news/b",
      publishedAt: "2026-10-30T18:00:00Z",
    });
    expect(selectLatestFinanceEvents([a, b])).toHaveLength(2);
  });
});
describe("informes financieros por observación CDMX", () => {
  it("cuenta fichas observadas hoy aunque el artículo sea anterior y declara esa diferencia", () => {
    const e = event({ publishedAt: "2026-10-29T18:00:00Z" });
    const b = buildFinanceNewsBrief([e], [quote], now);
    expect(b.date).toBe("2026-10-31");
    expect(b.eventCount).toBe(1);
    expect(b.eventIds).toEqual([e.id]);
    expect(b.caveat).toMatch(/observad|capturad/i);
    expect(b.caveat).toMatch(/publicad|publicación/i);
  });
  it("no cuenta capturas de otro día o del futuro", () => {
    const e = event();
    const result = buildFinanceNewsBrief(
      [
        { ...e, capturedAt: "2026-10-30T20:00:00Z" },
        { ...e, id: "future", capturedAt: "2026-11-01T20:00:00Z" },
      ],
      [],
      now,
    );
    expect(result.eventCount).toBe(0);
  });
  it("agrupa empresas y temas después de deduplicar, sin inventar independencia de fuentes", () => {
    const a = event();
    const b = event({ id: "b", url: "https://another.com/x" });
    const result = buildFinanceNewsBrief([a, b], [quote], now);
    expect(result.eventCount).toBe(1);
    expect(result.companyCounts[0]).toMatchObject({ symbol: "NVDA", count: 1 });
    expect(result.themes[0].count).toBe(1);
  });
  it("conserva cotizaciones como contexto capturado y excluye datos privados/futuros/incorrectos", () => {
    const e = event();
    const result = buildFinanceNewsBrief(
      [e],
      [
        quote,
        { ...quote, symbol: "OPENAI" },
        { ...quote, price: Number.NaN },
        { ...quote, tradingDay: "2026-11-02" },
        { ...quote, fetchedAt: "2026-11-01T20:00:00Z" },
        { ...quote, currency: "MXN" },
        { ...quote, tradingDay: "2026-99-99" },
      ],
      now,
    );
    expect(result.quoteContext).toEqual([quote]);
    expect(result.caveat).toMatch(/causalidad|causal/i);
    expect(result.caveat).toMatch(/cotizacion|cotización/i);
  });
  it("el ID del informe no depende del orden de entrada y cambia con evidencia o contexto", () => {
    const a = event();
    const b = event({
      id: "b",
      url: "https://example.com/b",
      title: "Microsoft announces a new subscription price",
      excerpt:
        "Microsoft announced new subscription pricing for its cloud products. The announced prices apply to the next contract period.",
    });
    expect(buildFinanceNewsBrief([a, b], [quote], now).id).toBe(
      buildFinanceNewsBrief([b, a], [quote], now).id,
    );
    expect(buildFinanceNewsBrief([a], [quote], now).id).not.toBe(
      buildFinanceNewsBrief([a], [{ ...quote, price: 151 }], now).id,
    );
  });
});

describe("revision observada en el mismo instante", () => {
  it("elige la revisión nueva antes del ID cuando las capturas coinciden", () => {
    const base = buildFinanceNewsEvent(
      {
        id: "same-story",
        url: "https://example.com/same",
        title: "Microsoft reports earnings growth",
        sourceId: "fixture",
        sourceName: "Fuente sintética",
        publishedAt: "2026-10-31T14:00:00Z",
        detectedAt: "2026-10-31T22:00:00Z",
        excerpt:
          "Microsoft reported revenue growth in its earnings release for the quarter.",
        category: "Finanzas",
        companies: ["MSFT"],
        coverage: "excerpt",
        analysis: "pending",
        references: [],
        score: 1,
        contentHash: "same",
      },
      new Date("2026-10-31T22:00:00Z"),
    )!;
    const old = {
      ...base,
      id: "z-old",
      revision: 1,
      title: "Previous version",
    };
    const latest = {
      ...base,
      id: "a-new",
      revision: 2,
      title: "Restored version",
    };
    expect(selectLatestFinanceEvents([old, latest])[0].id).toBe("a-new");
    expect(selectLatestFinanceEvents([latest, old])[0].id).toBe("a-new");
  });
});

describe("selección financiera v2 frente a guías promocionales", () => {
  const guideTitle = "7 Top Lead Scoring Software Solutions";
  const guideExcerpt =
    "Discover the top 7 lead scoring software solutions to enhance your sales strategy. Learn how these powerful tools can help you prioritize leads, boost conversions, and drive revenue growth.";
  it("excluye la lista promocional real aunque su extracto diga revenue growth", () => {
    expect(
      buildFinanceNewsEvent(
        story({
          title: guideTitle,
          excerpt: guideExcerpt,
          companies: [],
          category: "Operaciones",
          sourceId: "smallbiz",
          sourceName: "Small Business Trends",
        }),
        now,
      ),
    ).toBeUndefined();
  });
  it("no muestra ni cuenta en un informe nuevo la ficha v1 ya archivada de esa lista", () => {
    const legacy = {
      ...event(),
      title: guideTitle,
      excerpt: guideExcerpt,
      summary: guideExcerpt,
      engineVersion: "finance-news-v1",
      companies: [],
      category: "Operaciones" as const,
    };
    const retained = structuredClone(legacy);
    expect(selectLatestFinanceEvents([legacy])).toEqual([]);
    expect(buildFinanceNewsBrief([legacy], [], now).eventCount).toBe(0);
    expect(legacy).toEqual(retained);
  });
  it("no resucita una versión anterior si la última del mismo artículo es una guía excluida", () => {
    const previous = event();
    const latest = {
      ...previous,
      id: "latest-guide",
      title: guideTitle,
      excerpt: guideExcerpt,
      capturedAt: "2026-10-31T23:01:00Z",
      engineVersion: "finance-news-v1",
    };
    expect(selectLatestFinanceEvents([previous, latest])).toEqual([]);
  });
  it("excluye una guía evergreen de marketing sin convertir sus objetivos en resultados publicados", () => {
    expect(
      buildFinanceNewsEvent(
        story({
          title: "How to Use Lead Scoring Software to Increase Revenue",
          excerpt:
            "Learn how lead scoring software can help your sales team prioritize prospects. Discover the best tools to boost conversions and drive revenue growth.",
          companies: [],
          category: "Operaciones",
        }),
        now,
      ),
    ).toBeUndefined();
  });
  it("preserva el análisis de los resultados reales de ventas de Microsoft", () => {
    const result = buildFinanceNewsEvent(
      story({
        title: "How Microsoft’s cloud sales doubled in the latest quarter",
        excerpt:
          "The quarterly filing shows cloud revenue of $20 billion and operating profit of $5 billion. Cloud sales doubled compared with the same quarter last year, while costs increased.",
        companies: ["MSFT"],
        category: "Finanzas",
      }),
      now,
    );
    expect(result?.eventKind).toBe("earnings");
    expect(result?.companies.some((c) => c.symbol === "MSFT")).toBe(true);
  });
  it("preserva el análisis de crecimiento de ventas de Amazon en Q3", () => {
    const result = buildFinanceNewsEvent(
      story({
        title: "How Amazon’s sales grew 12 percent in Q3",
        excerpt:
          "Amazon's quarterly filing lists revenue growth of 12 percent in Q3 and operating profit of $8 billion. The filing also includes the costs of its retail and cloud businesses.",
        companies: ["AMZN"],
        category: "Finanzas",
      }),
      now,
    );
    expect(result?.eventKind).toBe("earnings");
    expect(result?.companies.some((c) => c.symbol === "AMZN")).toBe(true);
  });
  it("trata el robo de criptoactivos y su reposición como seguridad, no como adquisición", () => {
    const crypto = event({
      title:
        "Binance CEO says 90 percent of stolen assets have been ‘replenished’",
      excerpt:
        "After hackers stole a shocking $6.3 billion from Binance customers in a record-breaking crypto heist, the company said most assets have been replenished. The remaining 10 percent consists of less liquid tokens which may take longer to acquire.",
      companies: [],
      category: "Finanzas",
    });
    expect(crypto.eventKind).toBe("security");
  });
  it("preserva noticias numeradas de resultados y explicadores financieros con contenido", () => {
    const earnings = buildFinanceNewsEvent(
      story({
        title: "5 companies report earnings as cloud revenue grows",
        excerpt:
          "Microsoft and four other companies reported earnings for the quarter. Microsoft disclosed revenue growth of 12 percent and published the financial report.",
        companies: ["MSFT"],
      }),
      now,
    );
    expect(earnings?.eventKind).toBe("earnings");
    const explainer = buildFinanceNewsEvent(
      story({
        title: "How to Evaluate Bond ETF Duration and Fees",
        excerpt:
          "Learn how duration and fees affect a bond ETF. A fund with duration of 5 years may lose approximately 5 percent in price when yields rise by one percentage point, before other effects. The expense ratio reduces the amount retained by investors.",
        companies: [],
        category: "Finanzas",
      }),
      now,
    );
    expect(explainer).toBeDefined();
  });
});
