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
    portfolio.getByText("Dinero aportado", { exact: true }),
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
