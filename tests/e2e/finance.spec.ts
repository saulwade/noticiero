import { expect, test, type Page } from "@playwright/test";

async function openFinance(page: Page, mobile: boolean) {
  if (mobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  await page
    .getByRole("button", { name: "Mi portafolio", exact: true })
    .click();
  const portfolio = page.getByRole("region", { name: "Portafolio personal" });
  await expect(portfolio.getByRole("heading", { level: 1 })).toContainText(
    "Tu dinero.",
  );
  return portfolio;
}

test("portafolio demo honesto, sin movimientos ni consultas privadas", async ({
  page,
  isMobile,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/finance"))
      requests.push(request.method());
  });
  await page.goto("/?demo=1");
  const portfolio = await openFinance(page, isMobile);
  await expect(
    portfolio.getByText("Vista de ejemplo sin saldos personales.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    portfolio.getByRole("button", {
      name: "Registrar movimiento",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    portfolio.getByRole("heading", {
      name: "Primero diseñamos tu portafolio.",
    }),
  ).toBeVisible();
  await portfolio
    .getByRole("button", { name: "Investigar", exact: true })
    .click();
  await portfolio
    .getByText("Agregar instrumento a seguimiento", { exact: true })
    .click();
  await expect(
    portfolio.getByRole("button", { name: "Guardar instrumento", exact: true }),
  ).toBeDisabled();
  expect(requests).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("rendimiento porcentual y fecha real de captura sin reinterpretar el pasado", async ({
  page,
  isMobile,
}) => {
  const summary = {
    asOf: "2026-10-30",
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
      label: "Sin política aprobada",
      reason: "Fixture sintética.",
      amountMxn: "0",
      items: [],
      missing: [],
    },
    performance: {
      twr: 12.5,
      mwr: -3.25,
      reason: "Porcentajes calculados por el motor; no fracciones.",
    },
  };
  const archivedInstrument = {
    id: "historical-etf",
    symbol: "HIST",
    name: "Fondo sintético de archivo",
    kind: "etf",
    currency: "MXN",
    exchange: "TEST",
    fractional: false,
    createdAt: "2026-10-01T18:00:00Z",
  };
  const archivedThesis = {
    id: "thesis-archived",
    instrumentId: archivedInstrument.id,
    statement: "Tesis histórica guardada antes de nueva información.",
    risks: "Pérdidas por cambio de mercado.",
    invalidators: "Que falle el supuesto original.",
    horizon: "Largo plazo",
    sources: [
      { title: "Fuente histórica", url: "https://example.com/archive-old" },
    ],
    createdAt: "2026-10-25T18:00:00Z",
  };
  await page.route("**/api/finance", (route) =>
    route.fulfill({
      json: {
        instruments: [archivedInstrument],
        movements: [],
        theses: [
          {
            ...archivedThesis,
            id: "thesis-current",
            statement:
              "Tesis actual diferente que no debe reemplazar la captura.",
            createdAt: "2026-10-31T18:00:00Z",
          },
        ],
        relatedNews: [
          {
            instrumentId: archivedInstrument.id,
            title: "Mención sintética en noticias",
            url: "https://example.com/news",
            sourceName: "Fuente sintética",
            publishedAt: "2026-10-30T20:00:00Z",
          },
        ],
        research: [],
        summary,
        viewLimited: true,
        marks: [
          {
            id: "fx-synthetic",
            kind: "fx",
            value: "20",
            asOf: "2026-10-29",
            capturedAt: "2026-10-31T02:00:00.000Z",
            source: "Fuente de prueba",
          },
        ],
        decisions: [
          {
            id: "decision-synthetic",
            date: "2026-10-20",
            createdAt: "2026-10-31T02:00:00.000Z",
            action: "Decisión histórica de prueba",
            reason: "Se documentó después de la decisión original.",
            alternatives: "Esperar.",
            revisitWhen: "Con nueva evidencia.",
            snapshot: {
              summary,
              marks: [],
              instruments: [archivedInstrument],
              theses: [archivedThesis],
              research: [],
            },
          },
        ],
      },
    }),
  );
  await page.goto("/");
  const portfolio = await openFinance(page, isMobile);
  await portfolio
    .getByText("Rendimiento y límites del análisis", { exact: true })
    .click();
  await expect(portfolio.locator(".fi-performance")).toContainText("12.50 %");
  await expect(portfolio.locator(".fi-performance")).toContainText("-3.25 %");
  await expect(
    portfolio.getByText("Los totales usan todos los movimientos", {
      exact: false,
    }),
  ).toBeVisible();
  await portfolio
    .getByRole("button", { name: "Investigar", exact: true })
    .click();
  await portfolio
    .getByRole("heading", { name: archivedInstrument.name, exact: true })
    .click();
  await portfolio.getByText("Menciones en noticias", { exact: true }).click();
  await expect(
    portfolio.getByRole("link", { name: "Mención sintética en noticias" }),
  ).toHaveAttribute("href", "https://example.com/news");
  await expect(
    portfolio.getByText("Una mención no demuestra impacto financiero.", {
      exact: false,
    }),
  ).toBeVisible();
  await portfolio.getByRole("button", { name: "Diario", exact: true }).click();
  await portfolio
    .getByRole("heading", { name: "Decisión histórica de prueba", exact: true })
    .click();
  await expect(
    portfolio.getByText("Aportado en la captura", { exact: false }),
  ).toBeVisible();
  await expect(portfolio.locator(".fi-decision")).toContainText(
    /DECISIÓN DEL 20 oct 2026/,
  );
  await expect(portfolio.locator(".fi-decision")).toContainText(
    /Captura registrada el 30 oct 2026/,
  );
  await portfolio
    .getByText("Tesis y fuentes conservadas en la captura", { exact: true })
    .click();
  await expect(
    portfolio.getByText(archivedThesis.statement, { exact: true }),
  ).toBeVisible();
  await expect(
    portfolio.getByRole("link", { name: "Fuente histórica" }),
  ).toHaveAttribute("href", "https://example.com/archive-old");
  await expect(
    portfolio.getByText(
      "Tesis actual diferente que no debe reemplazar la captura.",
      { exact: true },
    ),
  ).toHaveCount(0);
});

test("portafolio: aportación, conversión, compra, referencias y diario persistentes", async ({
  page,
  isMobile,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const marker = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const symbol = `F${Date.now().toString(36).toUpperCase()}${isMobile ? "M" : "D"}`;
  const name = `ETF sintético ${marker}`;
  await page.goto("/");
  let portfolio = await openFinance(page, isMobile);
  await expect(
    portfolio.getByRole("button", { name: "Movimientos", exact: true }),
  ).toBeVisible();

  await portfolio
    .getByRole("button", { name: "Investigar", exact: true })
    .click();
  await portfolio
    .getByText("Agregar instrumento a seguimiento", { exact: true })
    .click();
  await portfolio
    .getByLabel("Símbolo del instrumento", { exact: true })
    .fill(symbol);
  await portfolio
    .getByLabel("Nombre del instrumento", { exact: true })
    .fill(name);
  await portfolio
    .getByLabel("Moneda de cotización", { exact: true })
    .selectOption("USD");
  await portfolio
    .getByLabel("Mercado del instrumento", { exact: true })
    .fill("TEST");
  await portfolio
    .getByLabel("Fuente oficial del instrumento", { exact: true })
    .fill("https://example.com/synthetic-fund");
  await portfolio
    .getByRole("button", { name: "Guardar instrumento", exact: true })
    .click();
  await expect(portfolio.getByRole("status")).toContainText(
    "Instrumento registrado",
  );
  await expect(
    portfolio.getByRole("heading", { name, exact: true }),
  ).toBeVisible();

  async function movement(
    kind: string,
    values: {
      amount?: string;
      quantity?: string;
      price?: string;
      fee?: string;
      fxRate?: string;
    },
  ) {
    await portfolio
      .getByRole("button", { name: "Registrar movimiento", exact: true })
      .click();
    await portfolio
      .getByLabel("Tipo de movimiento", { exact: true })
      .selectOption(kind);
    await portfolio
      .getByLabel("Moneda del movimiento", { exact: true })
      .selectOption("MXN");
    if (kind === "buy") {
      await portfolio
        .getByLabel("Instrumento del movimiento", { exact: true })
        .selectOption({ label: `${symbol} · TEST · USD` });
    }
    if (values.amount)
      await portfolio
        .getByLabel("Importe del movimiento", { exact: true })
        .fill(values.amount);
    if (values.quantity)
      await portfolio
        .getByLabel("Cantidad de títulos", { exact: true })
        .fill(values.quantity);
    if (values.price)
      await portfolio
        .getByLabel("Precio de ejecución", { exact: true })
        .fill(values.price);
    if (values.fee)
      await portfolio
        .getByLabel("Comisión adicional", { exact: true })
        .fill(values.fee);
    if (values.fxRate)
      await portfolio
        .getByLabel("Tipo de cambio ejecutado MXN por USD", { exact: true })
        .fill(values.fxRate);
    await portfolio
      .getByLabel("Nota del movimiento", { exact: true })
      .fill(marker);
    await portfolio
      .getByRole("button", { name: "Guardar movimiento", exact: true })
      .click();
    await expect(portfolio.getByRole("status")).toContainText(
      /movimientos guardados/,
    );
    await expect(
      portfolio.getByRole("form", {
        name: "Registrar movimiento",
        exact: true,
      }),
    ).toHaveCount(0);
  }
  await movement("deposit", { amount: "5000" });
  await movement("exchange", { amount: "1000", fxRate: "20" });
  await movement("buy", { quantity: "2", price: "10", fee: "1", fxRate: "20" });
  await portfolio.getByRole("button", { name: "Resumen", exact: true }).click();
  await portfolio
    .getByText("Posiciones y precios de referencia", { exact: true })
    .click();
  await expect(
    portfolio.locator(".fi-position").filter({ hasText: symbol }),
  ).toContainText("2 títulos");
  await portfolio
    .getByText("Registrar precio o tipo de cambio", { exact: true })
    .click();
  await portfolio
    .getByLabel("Instrumento del precio", { exact: true })
    .selectOption({ label: `${symbol} · TEST · USD` });
  await portfolio.getByLabel("Precio por título", { exact: true }).fill("12");
  await portfolio
    .getByLabel("Fuente de la referencia", { exact: true })
    .fill("Referencia sintética E2E");
  await portfolio
    .getByRole("button", { name: "Guardar referencia", exact: true })
    .click();
  await expect(portfolio.getByRole("status")).toContainText(
    "Valoración fechada guardada",
  );
  await portfolio
    .getByLabel("Tipo de referencia", { exact: true })
    .selectOption("fx");
  await portfolio.getByLabel("MXN por USD", { exact: true }).fill("20");
  await portfolio
    .getByRole("button", { name: "Guardar referencia", exact: true })
    .click();
  await expect(portfolio.getByRole("status")).toContainText(
    "Valoración fechada guardada",
  );
  await expect(
    portfolio.locator(".fi-position").filter({ hasText: symbol }),
  ).toContainText("$480.00");

  await portfolio.getByRole("button", { name: "Diario", exact: true }).click();
  await portfolio.getByText("Registrar una decisión", { exact: true }).click();
  await portfolio
    .getByLabel("Decisión", { exact: true })
    .fill(`Mantener sin cambios ${marker}`);
  await portfolio
    .getByLabel("Por qué tomé esta decisión", { exact: true })
    .fill("Ejemplo sintético para comprobar la conservación del razonamiento.");
  await portfolio
    .getByLabel("Alternativas consideradas", { exact: true })
    .fill("Esperar información adicional y conservar efectivo.");
  await portfolio
    .getByLabel("Cuándo volvería a revisarla", { exact: true })
    .fill("Al recibir un nuevo reporte verificable.");
  await portfolio
    .getByRole("button", { name: "Guardar decisión", exact: true })
    .click();
  await expect(
    portfolio.getByRole("heading", {
      name: `Mantener sin cambios ${marker}`,
      exact: true,
    }),
  ).toBeVisible();

  await page.reload();
  portfolio = await openFinance(page, isMobile);
  await portfolio.getByRole("button", { name: "Diario", exact: true }).click();
  await portfolio
    .getByRole("heading", {
      name: `Mantener sin cambios ${marker}`,
      exact: true,
    })
    .click();
  const savedDecision = portfolio.locator(".fi-decision").filter({
    hasText: `Mantener sin cambios ${marker}`,
  });
  await expect(
    savedDecision.getByText(
      "Ejemplo sintético para comprobar la conservación del razonamiento.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    savedDecision.getByText("Captura registrada el", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("referencias diarias y guía sin registrar operaciones ni consultar proveedores al abrir", async ({
  page,
  isMobile,
}) => {
  const financeRequests: string[] = [];
  const providerRequests: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/finance"))
      financeRequests.push(request.method());
    if (
      url.hostname.includes("alphavantage.co") ||
      url.hostname.includes("frankfurter.dev")
    )
      providerRequests.push(url.hostname);
  });
  await page.route("**/api/finance", (route) =>
    route.fulfill({
      json: {
        instruments: [],
        movements: [],
        marks: [],
        theses: [],
        decisions: [],
        research: [],
        market: {
          alphaVantageConfigured: false,
          expectedPriceSession: "2026-10-30",
          sources: [
            {
              id: "fx:USD/MXN",
              label: "USD/MXN",
              provider: "Frankfurter",
              status: "error",
              message:
                "La última consulta falló; se conserva la referencia anterior.",
              lastAttempt: "2026-10-31T02:00:00Z",
              lastSuccess: "2026-10-29T18:00:00Z",
              asOf: "2026-10-29",
              value: "20.1234",
            },
          ],
        },
        summary: {
          asOf: "2026-10-30",
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
            label: "Sin política aprobada",
            reason: "Definir la distribución antes de operar.",
            amountMxn: "0",
            items: [],
            missing: [],
          },
          performance: { reason: "Todavía no hay movimientos." },
        },
      },
    }),
  );
  await page.goto("/");
  const portfolio = await openFinance(page, isMobile);
  await expect(
    portfolio.getByRole("heading", {
      name: "Primero diseñamos tu portafolio.",
      exact: true,
    }),
  ).toBeVisible();
  const references = portfolio.getByRole("article", {
    name: "Referencias financieras diarias",
  });
  await expect(references).toContainText("20.1234");
  await expect(references).toContainText("Referencia del 29 oct 2026");
  await expect(references).toContainText(
    "falta configurar una clave gratuita de Alpha Vantage",
  );
  await references
    .getByText("Fuentes, fechas y cobertura", { exact: true })
    .click();
  await expect(references).toContainText("Por revisar");
  await expect(references).toContainText("último intento 30 oct 2026");
  await expect(references).toContainText(
    "La última consulta falló; se conserva la referencia anterior.",
  );
  await expect(references).toContainText(
    "Última sesión de cierre esperada: 30 oct 2026",
  );
  await expect(references).toContainText("BMV/SIC");
  await expect(references).toContainText("No es el FIX de Banxico");
  await portfolio.getByText("Cómo usar tu portafolio", { exact: true }).click();
  await expect(portfolio).toContainText(
    "Leer noticias no exige comprar o vender cada día.",
  );
  await expect(portfolio).toContainText(
    "Noticiero no importa movimientos del broker ni ejecuta órdenes",
  );
  await expect(portfolio).toContainText(
    "Cada mes revisamos tu nueva aportación",
  );
  await expect(portfolio).toContainText(
    "Una revisión trimestral de la estrategia",
  );
  expect(financeRequests.length).toBeGreaterThan(0);
  expect(financeRequests.every((method) => method === "GET")).toBe(true);
  expect(providerRequests).toEqual([]);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("noticias financieras sin cartera: investigar, guardar versiones y revisar el informe", async ({
  page,
  isMobile,
}) => {
  const now = new Date();
  const recent = new Date(now.getTime() - 3600000).toISOString();
  const old = new Date(now.getTime() - 10 * 86400000).toISOString();
  const event = {
    id: "financial-news-fixture",
    storyId: "story-financial-fixture",
    contentHash: "fixture-hash",
    engineVersion: "fixture-v1",
    title: "Microsoft reports a change in infrastructure spending",
    url: "https://example.com/financial-fixture",
    sourceId: "synthetic",
    sourceName: "Fuente sintética de prueba",
    publishedAt: recent,
    capturedAt: now.toISOString(),
    category: "Negocios",
    coverage: "excerpt",
    excerpt:
      "Microsoft reported spending changes. The financial effect remains uncertain.",
    summary:
      "Microsoft reported spending changes. The financial effect remains uncertain.",
    summaryLanguage: "en",
    companies: [{ symbol: "MSFT", name: "Microsoft", private: false }],
    eventKind: "infrastructure",
    topic: "Infraestructura",
    keywords: ["spending"],
    mechanismHypothesis:
      "Si cambia el gasto, conviene contrastar sus efectos en costos y caja.",
    questions: ["¿Qué cambió en la inversión y en qué periodo?"],
    missingEvidence: ["Confirmar cifras y comparar periodos homogéneos."],
    tone: {
      label: "unclassified",
      positiveTerms: [],
      negativeTerms: [],
      method: "Diccionario de prueba",
      caveat:
        "El lenguaje del texto no predice el rendimiento de una inversión.",
    },
  };
  const older = {
    ...event,
    id: "older-financial-fixture",
    storyId: "older-story-fixture",
    title: "A bank publishes a previous financial update",
    url: "https://example.com/older-financial-fixture",
    publishedAt: old,
    companies: [{ symbol: "JPM", name: "JPMorgan Chase", private: false }],
    topic: "Resultados",
  };
  const archivedOnly = {
    ...event,
    id: "archived-only-fixture",
    storyId: "archived-only-story",
    title: "Noticia archivada fuera de la ventana de treinta días",
    url: "https://example.com/archived-note-only",
    publishedAt: new Date(now.getTime() - 45 * 86400000).toISOString(),
    companies: [{ symbol: "JPM", name: "JPMorgan Chase", private: false }],
  };
  const reviews: Array<{
    id: string;
    eventId: string;
    storyId: string;
    status: string;
    note: string;
    openQuestions: string;
    createdAt: string;
    snapshot: typeof event;
  }> = [
    {
      id: "archived-note-only",
      eventId: archivedOnly.id,
      storyId: archivedOnly.storyId,
      status: "monitor",
      note: "Razón conservada aunque la noticia ya no aparezca en el feed.",
      openQuestions: "Contrastar el siguiente reporte.",
      createdAt: recent,
      snapshot: archivedOnly,
    },
  ];
  const posts: Array<Record<string, unknown>> = [];
  const providers: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (/alphavantage|frankfurter/.test(url.hostname))
      providers.push(url.hostname);
  });
  const brief = {
    id: "brief-fixture",
    date: now.toISOString().slice(0, 10),
    createdAt: now.toISOString(),
    engineVersion: "fixture-v1",
    eventIds: [event.id],
    eventCount: 1,
    companyCounts: [
      { symbol: "MSFT", name: "Microsoft", count: 1, private: false },
    ],
    themes: [{ label: "Infraestructura", count: 1 }],
    questions: ["¿Qué cifras faltan para confirmar el mecanismo?"],
    quoteContext: [
      {
        symbol: "MSFT",
        price: 100,
        change: 1,
        percent: 1.01,
        currency: "USD",
        tradingDay: now.toISOString().slice(0, 10),
        fetchedAt: now.toISOString(),
        provider: "Proveedor sintético",
      },
    ],
    caveat: "Una cotización es contexto, no prueba de causalidad.",
  };
  const summary = {
    asOf: now.toISOString().slice(0, 10),
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
      label: "Sin política aprobada",
      reason: "No hay cartera real.",
      amountMxn: "0",
      items: [],
      missing: [],
    },
    performance: { reason: "Sin movimientos." },
  };
  await page.route("**/api/finance", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      posts.push(body);
      const version = posts.length;
      reviews.unshift({
        id: `review-${version}`,
        eventId: body.eventId,
        storyId: event.storyId,
        status: body.status,
        note: body.note,
        openQuestions: body.openQuestions,
        createdAt: new Date(now.getTime() + version * 1000).toISOString(),
        snapshot: { ...event },
      });
      await route.fulfill({
        json: { message: "Nota de investigación guardada con su ficha." },
      });
    } else
      await route.fulfill({
        json: {
          instruments: [],
          movements: [],
          marks: [],
          theses: [],
          decisions: [],
          research: [],
          summary,
          newsResearch: {
            events: [event, older],
            reviews,
            briefs: [brief],
            totalEvents: 2,
            totalVersions: 2,
            totalReviews: reviews.length,
            totalBriefs: 1,
            viewLimited: false,
            lastUpdatedAt: now.toISOString(),
            message: "Fichas sintéticas para pruebas de interfaz.",
          },
        },
      });
  });
  await page.goto("/");
  let portfolio = await openFinance(page, isMobile);
  await expect(
    portfolio.getByText("Cartera sin iniciar", { exact: false }),
  ).toBeVisible();
  await expect(portfolio.locator(".fi-overview")).toHaveCount(0);
  await expect(
    portfolio.getByRole("heading", {
      name: "Qué pasó. Qué investigar.",
      exact: true,
    }),
  ).toBeVisible();
  const compact = portfolio.getByRole("region", {
    name: "Panorama financiero",
  });
  await expect(
    compact.getByRole("heading", { name: event.title, exact: true }),
  ).toBeVisible();
  await expect(
    compact.getByRole("article", {
      name: `Noticia financiera: ${event.title}`,
    }),
  ).toContainText(event.summary);
  await portfolio
    .getByRole("button", { name: "Investigar noticias", exact: true })
    .click();
  let investigation = portfolio.getByRole("region", {
    name: "Investigación de noticias financieras",
  });
  await expect(
    investigation.getByRole("heading", { name: event.title, exact: true }),
  ).toBeVisible();
  await expect(
    investigation.getByRole("heading", { name: older.title, exact: true }),
  ).toHaveCount(0);
  await investigation
    .getByLabel("Periodo de noticias", { exact: true })
    .selectOption("30");
  await expect(
    investigation.getByRole("heading", { name: older.title, exact: true }),
  ).toBeVisible();
  await investigation
    .getByLabel("Empresa o tema", { exact: true })
    .selectOption("company:MSFT");
  await expect(
    investigation.getByRole("heading", { name: older.title, exact: true }),
  ).toHaveCount(0);
  let card = investigation.getByRole("article", {
    name: `Noticia financiera: ${event.title}`,
  });
  await expect(card.getByRole("link", { name: "Leer fuente" })).toHaveAttribute(
    "href",
    event.url,
  );
  await card.getByText("Investigar noticia", { exact: true }).click();
  await expect(card).toContainText(event.mechanismHypothesis);
  await expect(card).toContainText(event.questions[0]);
  await expect(card).toContainText(
    "Una mención no demuestra impacto financiero.",
  );
  let form = card.getByRole("form", { name: `Nota para ${event.title}` });
  await form
    .getByLabel("Mi conclusión provisional", { exact: true })
    .selectOption("monitor");
  await form
    .getByLabel("Mi nota de investigación", { exact: true })
    .fill("Primera interpretación sintética; falta contrastar cifras.");
  await form
    .getByLabel("Qué quiero contrastar", { exact: true })
    .fill("Buscar la publicación primaria y el periodo comparable.");
  await form
    .getByRole("button", { name: "Guardar nota de investigación", exact: true })
    .click();
  await expect(portfolio.getByRole("status")).toContainText(
    "Nota de investigación guardada",
  );
  await expect(
    card.getByText("Mis notas guardadas", { exact: false }),
  ).toBeVisible();
  form = card.getByRole("form", { name: `Nota para ${event.title}` });
  await form
    .getByLabel("Mi nota de investigación", { exact: true })
    .fill("Segunda interpretación sintética con una pregunta más precisa.");
  await form
    .getByRole("button", { name: "Guardar nota de investigación", exact: true })
    .click();
  await expect(
    card.getByText("Mis notas guardadas", { exact: false }),
  ).toContainText("2");
  await page.reload();
  portfolio = await openFinance(page, isMobile);
  await portfolio
    .getByRole("button", { name: "Investigar", exact: true })
    .click();
  investigation = portfolio.getByRole("region", {
    name: "Investigación de noticias financieras",
  });
  card = investigation.getByRole("article", {
    name: `Noticia financiera: ${event.title}`,
  });
  await card.getByText("Investigar noticia", { exact: true }).click();
  await card.getByText("Mis notas guardadas", { exact: false }).click();
  await expect(card.locator(".fi-news-history")).toContainText(
    "Primera interpretación sintética",
  );
  await expect(card.locator(".fi-news-history")).toContainText(
    "Segunda interpretación sintética",
  );
  await investigation
    .getByText("Informes financieros guardados", { exact: false })
    .click();
  await investigation.locator(".fi-news-brief > summary").click();
  await expect(investigation.locator(".fi-news-brief")).toContainText(
    "Infraestructura (1)",
  );
  await investigation
    .getByText("Cotizaciones de contexto al preparar este informe", {
      exact: true,
    })
    .click();
  await expect(investigation.locator(".fi-news-brief")).toContainText(
    "no indica qué se sabía entonces ni demuestra que la noticia causara el movimiento",
  );
  await investigation
    .getByText("Mis notas de investigación", { exact: false })
    .click();
  const notebook = investigation.locator(".fi-news-notebook");
  await expect(
    notebook.getByRole("heading", { name: archivedOnly.title, exact: true }),
  ).toBeVisible();
  await expect(notebook).toContainText(
    "Razón conservada aunque la noticia ya no aparezca en el feed.",
  );
  const archivedNote = notebook
    .locator(".fi-news-saved-note")
    .filter({ hasText: archivedOnly.title });
  await expect(
    archivedNote.getByRole("link", { name: "Fuente conservada", exact: true }),
  ).toHaveAttribute("href", archivedOnly.url);
  expect(posts).toHaveLength(2);
  expect(posts.every((post) => post.action === "news-review")).toBe(true);
  expect(providers).toEqual([]);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
