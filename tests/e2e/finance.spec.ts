import { expect, test, type Page } from "@playwright/test";
import { fixture, report } from "../fixtures/finance-automatic";

async function openFinance(page: Page, mobile: boolean) {
  if (mobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  await page
    .getByRole("button", { name: "Mi portafolio", exact: true })
    .click();
  const portfolio = page.getByRole("region", { name: "Portafolio personal" });
  await expect(portfolio.getByRole("heading", { level: 1 })).toHaveText(
    "Mi portafolio.",
  );
  return portfolio;
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("demo: tres vistas, sin consultas privadas ni cartera ficticia", async ({
  page,
  isMobile,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/finance|alphavantage|frankfurter/.test(request.url()))
      requests.push(request.url());
  });
  await page.goto("/?demo=1");
  const portfolio = await openFinance(page, isMobile);
  const tabs = portfolio.getByRole("group", { name: "Vistas del portafolio" });
  await expect(tabs.getByRole("button")).toHaveText([
    "Mi cartera",
    "Qué hacer y por qué",
    "Movimientos",
  ]);
  await expect(portfolio.locator(".fi-overview")).toHaveCount(0);
  await expect(
    portfolio.getByRole("region", { name: "Cartera propuesta" }),
  ).toHaveCount(0);
  await expect(
    portfolio.getByText("Vista de ejemplo sin saldos personales.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(portfolio.locator("form")).toHaveCount(0);
  await tabs.getByRole("button", { name: "Qué hacer y por qué" }).click();
  await expect(portfolio).toContainText(
    "No hace falta escribir una tesis ni completar un diario.",
  );
  await expect(portfolio.locator("form")).toHaveCount(0);
  await tabs.getByRole("button", { name: "Movimientos" }).click();
  await portfolio
    .getByText("Registrar una operación real", { exact: true })
    .click();
  await expect(
    portfolio.getByRole("button", {
      name: "Registrar movimiento",
      exact: true,
    }),
  ).toBeDisabled();
  expect(requests).toEqual([]);
  await noOverflow(page);
});

test("propuesta automática sin posiciones: importes, fracciones, motivos y escenarios", async ({
  page,
  isMobile,
}) => {
  const requests: string[] = [];
  const providers: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/finance"))
      requests.push(request.method());
    if (/alphavantage|frankfurter/.test(url.hostname))
      providers.push(url.hostname);
  });
  await page.route("**/api/finance", (route) =>
    route.fulfill({ json: fixture() }),
  );
  await page.goto("/");
  const portfolio = await openFinance(page, isMobile);
  await expect(
    portfolio.getByRole("article", { name: "Cartera propuesta" }),
  ).toContainText("$12,000.00");
  await expect(portfolio.locator(".fi-auto-allocation")).toContainText("70 %");
  await expect(portfolio.locator(".fi-auto-allocation")).toContainText(
    "$8,400.00",
  );
  await expect(portfolio).toContainText("Esta distribución no está aprobada.");
  await expect(portfolio.locator(".fi-overview")).toHaveCount(0);
  await expect(portfolio.locator("form")).toHaveCount(0);
  await portfolio
    .getByRole("button", { name: "Qué hacer y por qué", exact: true })
    .click();
  await expect(
    portfolio.getByRole("heading", { name: report.headline, exact: true }),
  ).toBeVisible();
  await expect(portfolio.locator(".fi-auto-contribution")).toContainText(
    "$1,200.00",
  );
  const newsContext = portfolio.getByRole("region", {
    name: "Impacto de noticias en la cartera",
  });
  await expect(
    newsContext.getByText("1 noticia relevante · fuentes y mecanismos", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    newsContext.getByRole("heading", {
      name: report.news[0].title,
      exact: true,
    }),
  ).not.toBeVisible();
  await newsContext
    .getByRole("heading", { name: "Contexto para la decisión.", exact: true })
    .click();
  await expect(
    newsContext.getByRole("heading", {
      name: report.news[0].title,
      exact: true,
    }),
  ).toBeVisible();
  await expect(newsContext).toContainText(report.news[0].mechanism);
  await expect(
    portfolio.getByRole("link", { name: "Fuente de prueba" }),
  ).toHaveAttribute("href", report.news[0].url);
  await expect(portfolio.locator(".fi-auto-metrics")).toContainText("12 %");
  await expect(portfolio.locator(".fi-auto-scenarios")).toContainText(
    "-30.0 %",
  );
  await expect(portfolio).toContainText(
    "Escenarios condicionales, no pronósticos.",
  );
  await expect(portfolio.locator("form")).toHaveCount(0);
  await portfolio
    .getByText("Proyecciones condicionales a largo plazo", { exact: true })
    .click();
  await expect(portfolio).toContainText(
    "Los supuestos pueden fallar; no es una predicción.",
  );
  await expect(
    portfolio.getByText("Método, datos y alternativas", { exact: true }),
  ).toBeVisible();
  expect(requests).toEqual(["GET"]);
  expect(providers).toEqual([]);
  expect(errors).toEqual([]);
  await noOverflow(page);
});

test("investigación relacionada es automática, desplegable y mantiene tres pestañas", async ({
  page,
  isMobile,
}) => {
  const data = structuredClone(fixture());
  data.automation!.current!.stockResearch = {
    context: {
      version: 1,
      asOf: "2026-11-01T12:00:00Z",
      warnings: [],
      candidates: [
        {
          symbol: "SUPPLIER",
          name: "Proveedor de prueba",
          cik: "0000000001",
          exchange: "NASDAQ",
          origin: "related",
          events: [
            {
              id: "synthetic",
              title: "Inversión sintética en infraestructura",
              url: "https://example.com/source",
              sourceName: "Fuente de prueba",
              publishedAt: "2026-10-31T12:00:00Z",
            },
          ],
          links: [
            {
              id: "synthetic-link",
              fromSymbol: "SAMPLE",
              fromName: "Cliente de prueba",
              kind: "supplier",
              description: "Relación documentada de prueba.",
              mechanism:
                "Si se confirma el pedido, podrían variar los ingresos.",
              counterpoint: "La expansión puede retrasarse.",
              sourceUrl: "https://example.com/relation",
              sourceDate: "2026-10-01",
            },
          ],
        },
      ],
    },
    caveat: "No es una incorporación a tu cartera.",
    analyses: [
      {
        symbol: "SUPPLIER",
        status: "partial",
        metrics: [
          {
            key: "synthetic-margin",
            label: "Margen de prueba",
            value: 0.2,
            unit: "ratio",
            period: "2026-04-01 / 2026-06-30",
            factIndexes: [0, 1],
          },
        ],
        findings: ["Balance y valoración pendientes."],
        questions: ["¿Qué dato invalidaría la hipótesis?"],
      },
    ],
  };
  await page.route("**/api/finance", (route) => route.fulfill({ json: data }));
  await page.goto("/");
  const portfolio = await openFinance(page, isMobile);
  await portfolio
    .getByRole("button", { name: "Qué hacer y por qué", exact: true })
    .click();
  const research = portfolio.getByRole("region", {
    name: "Investigación automática de empresas relacionadas",
  });
  await expect(
    research.getByText("Proveedor de prueba", { exact: false }).first(),
  ).not.toBeVisible();
  await research.getByText("Más allá del titular.", { exact: true }).click();
  await expect(research).toContainText("20 %");
  await expect(
    research.getByText("Relación documentada de prueba."),
  ).toBeVisible();
  await expect(research).toContainText("La expansión puede retrasarse.");
  await expect(portfolio.locator("form")).toHaveCount(0);
  await expect(
    portfolio
      .getByRole("group", { name: "Vistas del portafolio" })
      .getByRole("button"),
  ).toHaveCount(3);
  await noOverflow(page);
});

test("cartera real y propuesta se muestran separadas y datos desactualizados son explícitos", async ({
  page,
  isMobile,
}) => {
  const data = fixture();
  data.movements = [
    {
      id: "synthetic-deposit",
      kind: "deposit",
      date: "2026-10-30",
      currency: "MXN",
      amount: "1000",
      fee: "0",
      note: "Aportación sintética",
      createdAt: "2026-10-30T18:00:00Z",
    },
  ];
  data.summary = {
    ...data.summary,
    contributionsMxn: "1000",
    valueMxn: "1030",
    knownValueMxn: "1030",
    pnlMxn: "30",
    cash: { MXN: "1030", USD: "0" },
    allocation: [{ label: "Efectivo MXN", valueMxn: "1030", weight: 100 }],
  };
  data.automation = {
    ...data.automation!,
    status: "stale",
    message: "Hay movimientos posteriores al cálculo.",
    staleReason: "La huella de los movimientos cambió.",
  };
  await page.route("**/api/finance", (route) => route.fulfill({ json: data }));
  await page.goto("/");
  const portfolio = await openFinance(page, isMobile);
  await expect(portfolio.locator(".fi-overview")).toContainText("$1,030.00");
  await expect(portfolio.locator(".fi-overview")).toContainText("$1,000.00");
  await expect(portfolio.locator(".fi-overview")).toContainText("$30.00");
  await expect(
    portfolio.getByRole("article", { name: "Cartera propuesta" }),
  ).not.toContainText("$12,000.00");
  await expect(
    portfolio.getByRole("article", { name: "Cartera propuesta" }),
  ).toContainText("70 %");
  await expect(portfolio).toContainText(
    "Informe anterior · pendiente de actualizar",
  );
  await expect(portfolio).toContainText(
    "Los importes de este informe son una referencia anterior",
  );
  await portfolio
    .getByText("Rendimiento y límites del análisis", { exact: true })
    .click();
  await expect(portfolio.locator(".fi-performance")).toContainText("12.50 %");
  await expect(portfolio.locator(".fi-performance")).toContainText("-3.25 %");
  await noOverflow(page);
});

test("error o perfil pendiente no inventan un informe ni piden formularios", async ({
  page,
  isMobile,
}) => {
  const data = fixture();
  data.automation = {
    status: "error",
    message:
      "No se completó la lectura de históricos; se reintentará en el trabajo privado.",
    history: [],
    totalReports: 0,
  };
  await page.route("**/api/finance", (route) => route.fulfill({ json: data }));
  await page.goto("/");
  const portfolio = await openFinance(page, isMobile);
  await expect(portfolio).toContainText(
    "La última actualización no se completó",
  );
  await expect(portfolio.locator(".fi-auto-allocation")).toHaveCount(0);
  await expect(portfolio.locator(".fi-overview")).toHaveCount(0);
  await portfolio
    .getByRole("button", { name: "Qué hacer y por qué", exact: true })
    .click();
  await expect(portfolio.locator("form")).toHaveCount(0);
  await expect(portfolio).toContainText("Cuando el informe esté disponible");
  await noOverflow(page);
});

test("archivo conserva la tesis de la captura y la fecha de registro", async ({
  page,
  isMobile,
}) => {
  const data = fixture();
  const archivedThesis = {
    id: "archive-thesis",
    instrumentId: "archive-etf",
    statement: "Tesis histórica guardada antes de nueva información.",
    risks: "Cambio de mercado.",
    invalidators: "Falla el supuesto.",
    horizon: "Largo plazo",
    sources: [
      { title: "Fuente histórica", url: "https://example.com/archive-old" },
    ],
    createdAt: "2026-10-25T18:00:00Z",
  };
  data.viewLimited = true;
  data.theses = [
    {
      ...archivedThesis,
      id: "current-thesis",
      statement: "Tesis actual distinta.",
    },
  ];
  data.decisions = [
    {
      id: "synthetic-decision",
      date: "2026-10-20",
      createdAt: "2026-10-31T02:00:00Z",
      action: "Decisión histórica de prueba",
      reason: "Se documentó después de la decisión original.",
      alternatives: "Esperar.",
      revisitWhen: "Con nueva evidencia.",
      snapshot: {
        summary: data.summary,
        marks: [],
        instruments: [],
        theses: [archivedThesis],
        research: [],
      },
    },
  ];
  await page.route("**/api/finance", (route) => route.fulfill({ json: data }));
  await page.goto("/");
  const portfolio = await openFinance(page, isMobile);
  await portfolio
    .getByRole("button", { name: "Movimientos", exact: true })
    .click();
  await expect(portfolio).toContainText(
    "los totales usan todos los movimientos",
  );
  await portfolio
    .getByText("Archivo de notas, tesis y decisiones anteriores", {
      exact: true,
    })
    .click();
  await portfolio
    .getByRole("heading", { name: "Decisión histórica de prueba", exact: true })
    .click();
  const capture = portfolio.locator(".fi-decision");
  await expect(capture).toContainText("DECISIÓN DEL 20 oct 2026");
  await expect(capture).toContainText("Captura registrada el 30 oct 2026");
  await capture
    .getByText("Tesis y fuentes conservadas en la captura", { exact: true })
    .click();
  await expect(capture).toContainText(archivedThesis.statement);
  await expect(
    capture.getByRole("link", { name: "Fuente histórica" }),
  ).toHaveAttribute("href", "https://example.com/archive-old");
  await expect(capture).not.toContainText("Tesis actual distinta.");
  await noOverflow(page);
});

test("movimientos reales: captura opcional, compra, referencia y reverso auditable", async ({
  page,
  isMobile,
}, testInfo) => {
  const marker = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const symbol = `F${Date.now().toString(36).toUpperCase()}${isMobile ? "M" : "D"}`;
  await page.goto("/");
  let portfolio = await openFinance(page, isMobile);
  await portfolio
    .getByRole("button", { name: "Movimientos", exact: true })
    .click();
  await portfolio
    .getByText("Registrar instrumento para operaciones", { exact: true })
    .click();
  await portfolio
    .getByLabel("Símbolo del instrumento", { exact: true })
    .fill(symbol);
  await portfolio
    .getByLabel("Nombre del instrumento", { exact: true })
    .fill(`ETF sintético ${marker}`);
  await portfolio
    .getByLabel("Mercado del instrumento", { exact: true })
    .fill("TEST");
  await portfolio
    .getByRole("button", { name: "Guardar instrumento", exact: true })
    .click();
  await expect(
    portfolio.getByRole("status").filter({ hasText: "Instrumento registrado" }),
  ).toBeVisible();
  await portfolio
    .getByText("Registrar una operación real", { exact: true })
    .click();
  async function movement(kind: "deposit" | "buy") {
    await portfolio
      .getByRole("button", { name: "Registrar movimiento", exact: true })
      .click();
    await portfolio
      .getByLabel("Tipo de movimiento", { exact: true })
      .selectOption(kind);
    if (kind === "deposit")
      await portfolio
        .getByLabel("Importe del movimiento", { exact: true })
        .fill("1000");
    else {
      await portfolio
        .getByLabel("Instrumento del movimiento", { exact: true })
        .selectOption({ label: `${symbol} · TEST · MXN` });
      await portfolio
        .getByLabel("Cantidad de títulos", { exact: true })
        .fill("2");
      await portfolio
        .getByLabel("Precio de ejecución", { exact: true })
        .fill("100");
    }
    await portfolio
      .getByLabel("Nota del movimiento", { exact: true })
      .fill(marker);
    await portfolio
      .getByRole("button", { name: "Guardar movimiento", exact: true })
      .click();
    await expect(
      portfolio.getByRole("form", {
        name: "Registrar movimiento",
        exact: true,
      }),
    ).toHaveCount(0);
  }
  await movement("deposit");
  await movement("buy");
  await portfolio
    .getByText("Posiciones y precios de referencia", { exact: true })
    .click();
  await portfolio
    .getByText("Registrar precio o tipo de cambio", { exact: true })
    .click();
  await portfolio
    .getByLabel("Instrumento del precio", { exact: true })
    .selectOption({ label: `${symbol} · TEST · MXN` });
  await portfolio.getByLabel("Precio por título", { exact: true }).fill("110");
  await portfolio
    .getByLabel("Fuente de la referencia", { exact: true })
    .fill("Referencia sintética E2E");
  await portfolio
    .getByRole("button", { name: "Guardar referencia", exact: true })
    .click();
  await expect(
    portfolio.locator(".fi-position").filter({ hasText: symbol }),
  ).toContainText("$220.00");
  await page.reload();
  portfolio = await openFinance(page, isMobile);
  await portfolio
    .getByRole("button", { name: "Movimientos", exact: true })
    .click();
  const purchase = portfolio
    .locator(".fi-movement")
    .filter({ hasText: symbol });
  await purchase.locator(":scope > summary").click();
  await expect(purchase).toContainText(marker);
  await purchase
    .getByLabel(/^Motivo de corrección/)
    .fill(`Corrección sintética ${marker}`);
  await purchase
    .getByRole("button", { name: "Crear reverso", exact: true })
    .click();
  await expect(
    portfolio.locator(".fi-movement").filter({ hasText: symbol }),
  ).toHaveCount(2);
  await noOverflow(page);
});
