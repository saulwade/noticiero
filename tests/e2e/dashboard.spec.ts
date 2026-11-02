import { expect, test } from "@playwright/test";
import type { ValidationData } from "../../src/lib/types";

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

test("investigación automática fuera de la interfaz diaria", async ({
  page,
  isMobile,
}) => {
  await page.goto("/?demo=1");
  await expect(
    page.locator(
      ".research-workspace,.evidence-workspace,.ideas-tab-panel,.idea-notes",
    ),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ideas", exact: true }),
  ).toHaveCount(0);
  if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("button", { name: /Oportunidades|Radar|Entrevistas/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Estado y respaldos", exact: true })
    .click();
  await expect(
    page.getByLabel("Estado de la investigación automática"),
  ).toContainText("se conservan en segundo plano");
  await expect(
    page.getByLabel("Estado de la investigación automática"),
  ).toContainText("No necesitas abrir una sección");
  await expect(
    page.getByRole("button", {
      name: /Generar reporte|Guardar notas|Importar CSV/,
    }),
  ).toHaveCount(0);
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

test("los reportes siguen disponibles por API sin abrir un cuaderno", async ({
  page,
}) => {
  await page.goto("/");
  const response = await page.request.get("/api/research/brief?days=7");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("text/markdown");
  expect(await response.text()).toContain("Noticiero · investigación de");
  expect(
    (await page.request.get("/api/research/brief?days=999")).status(),
  ).toBe(400);
  await expect(
    page.getByRole("button", {
      name: /Cuaderno de señales|Reportes nocturnos|Archivo automático/,
    }),
  ).toHaveCount(0);
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

test("estado discreto y categorías conservadas", async ({ page, isMobile }) => {
  await page.goto("/?demo=1");
  if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(
    page
      .locator(".sidebar")
      .getByRole("button", { name: "Finanzas", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".sidebar")
      .getByRole("button", { name: "Operaciones", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Estado y respaldos", exact: true })
    .click();
  await expect(page.locator(".operations-view")).toContainText("siete días");
  await expect(page.getByLabel("Capacidad de almacenamiento")).toContainText(
    "70% y 85%",
  );
  await expect(page.getByLabel("Estado del archivo histórico")).toContainText(
    "sin expiración programada",
  );
  await expect(
    page.getByLabel("Estado de la investigación automática"),
  ).toContainText("último análisis guardado");
  await expect(
    page.getByRole("button", { name: "Actualizar estado", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("investigaciones conservadas por API sin formularios ni acceso de entrevistas", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const marker = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const headers = { Origin: new URL(page.url()).origin };
  const title = `Conciliación archivada ${marker}`;
  const projectResponse = await page.request.post("/api/validation", {
    headers,
    data: {
      action: "project",
      title,
      segment: "Despachos contables pequeños",
      problem: "Dedican horas a comparar facturas manualmente",
      hypothesis: "Reducir el tiempo de conciliación",
      status: "archived",
    },
  });
  expect(projectResponse.ok()).toBe(true);
  const { projectId } = await projectResponse.json();
  expect(typeof projectId).toBe("string");
  const alias = `Entrevista de prueba ${marker}`;
  const interviewResponse = await page.request.post("/api/validation", {
    headers,
    data: {
      action: "interview",
      projectId,
      alias,
      date: "2026-11-01",
      currentSolution: "Una hoja de cálculo",
      consequence: "Dos horas cada semana",
      notes: "Prefiere conservar su herramienta actual",
      status: "completed",
    },
  });
  expect(interviewResponse.ok()).toBe(true);
  const beforeResponse = await page.request.get("/api/validation");
  expect(beforeResponse.ok()).toBe(true);
  const before: ValidationData = await beforeResponse.json();
  const project = before.projects.find((item) => item.id === projectId);
  const interview = before.interviews.find(
    (item) => item.projectId === projectId && item.alias === alias,
  );
  expect(project).toMatchObject({ title, status: "archived" });
  expect(interview).toMatchObject({
    consequence: "Dos horas cada semana",
    notes: "Prefiere conservar su herramienta actual",
  });

  await page.reload();
  await expect(
    page.locator(
      ".validation-workspace,.interview-form,.research-workspace,.evidence-workspace",
    ),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: /Preparar entrevistas|Llevar a Entrevistas|Añadir entrevista/,
    }),
  ).toHaveCount(0);
  const afterResponse = await page.request.get("/api/validation");
  expect(afterResponse.ok()).toBe(true);
  const after: ValidationData = await afterResponse.json();
  expect(after.projects.find((item) => item.id === projectId)).toEqual(project);
  expect(after.interviews.find((item) => item.id === interview?.id)).toEqual(
    interview,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("tres destinos y ninguna pantalla de tareas de investigación", async ({
  page,
  isMobile,
}) => {
  await page.goto("/?demo=1");
  if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  const navigation = page.getByRole("navigation", {
    name: "Navegación principal",
  });
  await expect(navigation.getByRole("button")).toHaveCount(3);
  for (const name of ["Mi briefing", "Mi portafolio", "Guardados"])
    await expect(
      navigation.getByRole("button", { name: new RegExp(`^${name}`) }),
    ).toBeVisible();
  await expect(
    navigation.getByRole("button", { name: /Oportunidades|Radar|Entrevistas/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", {
      name: /Radar de evidencia|Prioridades de investigación/,
    }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
