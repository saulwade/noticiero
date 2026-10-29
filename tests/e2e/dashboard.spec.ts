import { expect, test } from "@playwright/test";

test("briefing, búsqueda, contexto y guardados", async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?demo=1");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "El mundo se mueve",
  );
  await expect(
    page.getByText("Vista de ejemplo · Las historias"),
  ).toBeVisible();
  const search = page.getByRole("textbox", {
    name: "Buscar noticias, empresas o ideas",
  });
  await search.fill("infraestructura");
  await expect(page.locator(".news-card")).toHaveCount(1);
  await search.fill("no-existe-esta-señal");
  await expect(
    page.getByRole("heading", { name: "No encontramos esa señal" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Quitar filtros" }).click();
  await expect(page.locator(".news-card")).toHaveCount(3);
  await page
    .locator(".news-card")
    .first()
    .getByRole("button", { name: "Guardar noticia", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Historia guardada");
  await page.locator(".story-title").first().click();
  if (isMobile)
    await page.getByRole("button", { name: "Empresas", exact: true }).click();
  await expect(page.locator(".market-panel")).toContainText("Microsoft");
  if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /^Guardados/ }).click();
  await expect(page.locator(".news-card")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("ideas guardables, experimento y notas", async ({ page, isMobile }) => {
  await page.goto("/?demo=1");
  if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /^Oportunidades/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Qué vas a construir",
  );
  await expect(page.getByText("Cómo validarla", { exact: true })).toBeVisible();
  await page.getByLabel("Tu siguiente paso").fill("Probar un piloto pequeño.");
  await page.getByLabel("Estado de la idea").selectOption("validating");
  await page.getByRole("button", { name: "Guardar notas" }).click();
  await expect(page.getByRole("status")).toHaveText(/Notas guardadas/);
  if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /^Guardados/ }).click();
  await expect(page.locator(".saved-ideas .idea-card")).toHaveCount(1);
  await expect(page.getByLabel("Tu siguiente paso")).toHaveValue(
    "Probar un piloto pequeño.",
  );
});

test("fuentes configurables y configuración sin secretos", async ({
  page,
  isMobile,
}) => {
  await page.goto("/?demo=1");
  if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /^Mis fuentes/ }).click();
  const source = page.getByRole("switch", { name: "Activar Hacker News" });
  await expect(source).toBeChecked();
  await source.click();
  await expect(source).not.toBeChecked();
  if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: "Preferencias", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Resúmenes e ideas en español" }),
  ).toBeVisible();
  await expect(page.locator(".settings-view")).toContainText("LLM_BASE_URL");
});

test("la página no desborda el ancho disponible", async ({ page }) => {
  await page.goto("/?demo=1");
  const dimensions = await page.evaluate(() => ({
    width: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width);
});

test("las fotografías ocupan una fila ancha sin dejar un hueco sobre el título", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  const photo = page.locator(".inline-news-image").first();
  await photo.scrollIntoViewIfNeeded();
  await expect(photo.locator("img")).toBeVisible();
  const geometry = await photo.evaluate((element) => {
    const parentElement = element.parentElement!;
    const parent = parentElement.getBoundingClientRect();
    const padding = getComputedStyle(parentElement);
    const image = element.getBoundingClientRect();
    const title = element.nextElementSibling!.getBoundingClientRect();
    return {
      width: image.width,
      parent:
        parent.width -
        parseFloat(padding.paddingLeft) -
        parseFloat(padding.paddingRight),
      gap: title.top - image.bottom,
      float: getComputedStyle(element).float,
    };
  });
  expect(geometry.float).toBe("none");
  expect(geometry.width / geometry.parent).toBeGreaterThan(0.95);
  expect(geometry.gap).toBeGreaterThanOrEqual(0);
  expect(geometry.gap).toBeLessThan(30);
});

test("el cuaderno conserva notas al cambiar de sección y explica el reporte nocturno", async ({
  page,
  isMobile,
}) => {
  await page.goto("/?demo=1");
  if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /^Oportunidades/ }).click();
  await page.getByRole("button", { name: /Cuaderno de señales/ }).click();
  await expect(page.locator(".signal-evidence")).toContainText(
    "Señal ficticia de demostración",
  );
  await page
    .getByLabel("Tus notas y siguientes preguntas")
    .fill("Comprobar el flujo actual antes de construir.");
  await page.getByRole("button", { name: "Guardar nota", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Notas guardadas");
  await page.getByRole("button", { name: /Reportes nocturnos/ }).click();
  await expect(
    page.getByRole("button", { name: "Generar reporte de hoy" }),
  ).toBeDisabled();
  await expect(page.locator(".nightly-reports")).toContainText("20:00 CDMX");
  await page.getByRole("button", { name: /Cuaderno de señales/ }).click();
  await expect(page.getByLabel("Tus notas y siguientes preguntas")).toHaveValue(
    "Comprobar el flujo actual antes de construir.",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("las APIs rechazan escrituras externas y cron sin secreto", async ({
  request,
}) => {
  const external = await request.post("/api/preferences", {
    headers: { Origin: "https://outside.example.com" },
    data: { action: "read", id: "test-only" },
  });
  expect(external.status()).toBe(403);
  const cron = await request.get("/api/jobs/am");
  expect(cron.status()).toBe(401);
  expect((await request.get("/api/operations/check")).status()).toBe(401);
  expect(
    (
      await request.post("/api/operations/backup", {
        data: { status: "completed" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/validation", {
        headers: { Origin: "https://outside.example.com" },
        data: { action: "project" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/research/report", {
        headers: { Origin: "https://outside.example.com" },
      })
    ).status(),
  ).toBe(403);
  expect((await request.get("/api/research/reports/not-a-date")).status()).toBe(
    400,
  );
});

test("archivo automático y categorías de finanzas y operaciones", async ({
  page,
  isMobile,
}) => {
  await page.goto("/?demo=1");
  if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /^Oportunidades/ }).click();
  await page.getByRole("button", { name: /Archivo automático/ }).click();
  await expect(
    page.getByText("Este archivo se llena solo", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Periodo del archivo automático").selectOption("7");
  if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(
    page.getByRole("button", { name: "Finanzas", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Operaciones", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Estado y respaldos/ }).click();
  await expect(page.locator(".operations-view")).toContainText("siete días");
  await expect(
    page.getByRole("button", { name: "Actualizar estado", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("investigación y entrevista persisten al recargar", async ({
  page,
  isMobile,
}, testInfo) => {
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: "Entrevistas", exact: true }).click();
  await page
    .getByRole("button", { name: "Nueva investigación", exact: true })
    .click();
  const title = `Conciliación ${testInfo.project.name}`;
  await page.getByLabel("Nombre de la investigación").fill(title);
  await page
    .getByLabel("Segmento: ¿quién tiene el problema?")
    .fill("Despachos contables pequeños");
  await page
    .getByLabel("Problema concreto")
    .fill("Dedican horas a comparar facturas manualmente");
  await page
    .getByLabel("Hipótesis por comprobar")
    .fill("Reducir el tiempo de conciliación");
  await page
    .getByRole("button", { name: "Guardar investigación", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Guardado");
  await page.getByRole("button", { name: "Añadir entrevista" }).click();
  await page.getByLabel("Persona o alias").fill("Entrevista de prueba");
  await page
    .getByLabel("¿Cómo resolvió el último caso?")
    .fill("Una hoja de cálculo");
  await page
    .getByLabel("Tiempo, costo o consecuencia medible")
    .fill("Dos horas cada semana");
  await page
    .getByLabel("Notas y evidencia que contradice la hipótesis")
    .fill("Prefiere conservar su herramienta actual");
  await page
    .getByRole("button", { name: "Guardar entrevista", exact: true })
    .click();
  await expect(page.locator(".interview-card")).toContainText(
    "Dos horas cada semana",
  );
  await page.reload();
  if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: "Entrevistas", exact: true }).click();
  await page
    .locator(".project-list")
    .getByRole("button")
    .filter({ hasText: title })
    .click();
  await expect(page.locator(".interview-card")).toContainText(
    "Prefiere conservar su herramienta actual",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
