import { expect, test, type Page } from "@playwright/test";

async function openRadar(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /^Oportunidades/ }).click();
  await page
    .getByText("Radar de problemas · evidencia y cobertura", { exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Radar de evidencia" }),
  ).toBeVisible();
}

test("radar vacío, filtros, cobertura y exportación en escritorio y teléfono", async ({
  page,
  isMobile,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?demo=1");
  await openRadar(page, isMobile);
  await expect(
    page.getByRole("region", { name: "Prioridades de investigación" }),
  ).toContainText("Qué vale la pena entender.");
  const radar = page.getByRole("region", { name: "Radar de evidencia" });
  await expect(radar.getByRole("heading", { level: 1 })).toContainText(
    "Problemas reales.",
  );
  await expect(
    radar.getByRole("heading", { name: "La evidencia viene primero." }),
  ).toBeVisible();
  await radar
    .getByLabel("Buscar problema o cita")
    .fill("Sin coincidencia de prueba");
  await radar.getByLabel("País sustentado").selectOption("unknown");
  await radar.getByLabel("Idioma", { exact: true }).selectOption("es");
  await radar.getByLabel("Tipo", { exact: true }).selectOption("complaint");
  await expect(
    radar.getByRole("heading", {
      name: "Sin coincidencias con estos filtros.",
    }),
  ).toBeVisible();
  await radar.getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(radar.getByLabel("Buscar problema o cita")).toHaveValue("");
  await radar
    .getByText("Cobertura y estado de las fuentes", { exact: true })
    .click();
  await expect(
    radar.getByText("Aún no hay comprobaciones de fuentes."),
  ).toBeVisible();
  await radar
    .getByText("Importar evidencia de PROFECO", { exact: true })
    .click();
  await expect(
    radar.getByLabel("Archivo CSV oficial de PROFECO"),
  ).toBeDisabled();
  await expect(
    radar.getByRole("button", { name: "Importar CSV", exact: true }),
  ).toBeDisabled();
  const downloadPromise = page.waitForEvent("download");
  await radar
    .getByRole("button", { name: "Exportar investigación", exact: true })
    .click();
  const file = await downloadPromise;
  expect(file.suggestedFilename()).toBe("noticiero-evidencia.md");
  await expect(radar.getByRole("status")).toContainText(
    "Investigación descargada",
  );
  await radar.getByRole("button", { name: /Balances semanales/ }).click();
  await expect(
    radar.getByText("El primer balance aparecerá después del cierre semanal.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("CSV explícito y revisión persistente dentro de Oportunidades", async ({
  page,
  isMobile,
}, testInfo) => {
  const marker = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const provider = `Proveedor evidencia ${marker}`;
  const issue = `No puedo obtener el reembolso ${marker}-uno`;
  const csv = [
    "expediente,fecha_ingreso,proveedor,motivo_reclamacion,giro",
    `${marker}-uno,2026-01-15,${provider},${issue},Servicios`,
    `${marker}-dos,2026-01-16,${provider},No puedo obtener el reembolso ${marker}-dos,Servicios`,
  ].join("\n");
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/evidence"
    )
      writes.push(request.postData() ?? "");
  });
  await page.goto("/");
  await openRadar(page, isMobile);
  const radar = page.getByRole("region", { name: "Radar de evidencia" });
  await radar
    .getByText("Importar evidencia de PROFECO", { exact: true })
    .click();
  await radar.getByLabel("Archivo CSV oficial de PROFECO").setInputFiles({
    name: `profeco-${marker}.csv`,
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(
    radar.getByText(
      `Listo para validar: profeco-${marker}.csv. Aún no se ha enviado.`,
    ),
  ).toBeVisible();
  expect(writes).toEqual([]);
  await radar
    .getByRole("button", { name: "Importar CSV", exact: true })
    .click();
  await expect(radar.getByRole("status")).toContainText(
    /2 registros nuevos importados/,
  );
  const priorities = page.getByRole("region", {
    name: "Prioridades de investigación",
  });
  await expect(priorities).toContainText("México:");
  await expect(priorities).toContainText("Repetición histórica");
  const globalSearch = page.getByRole("textbox", {
    name: "Buscar noticias, empresas o ideas",
  });
  await globalSearch.fill(provider);
  await expect(priorities).toContainText(provider);
  await globalSearch.fill(`no-selected-problem-${marker}`);
  await expect(priorities).toContainText(
    "No hay problemas seleccionados que coincidan con esta búsqueda.",
  );
  await expect(priorities.locator(".op-lead")).toHaveCount(0);
  await globalSearch.fill("");
  expect(writes).toHaveLength(1);
  expect(JSON.parse(writes[0]).action).toBe("import");

  await radar.getByRole("button", { name: /^Evidencia/ }).click();
  await radar.getByLabel("Buscar problema o cita").fill(issue);
  await radar.getByLabel("País sustentado").selectOption("MX");
  await radar.getByLabel("Idioma", { exact: true }).selectOption("es");
  await radar.getByLabel("Tipo", { exact: true }).selectOption("complaint");
  const record = radar.locator(".ev-record").filter({ hasText: issue });
  await expect(record).toHaveCount(1);
  await expect(record).toContainText("Caso sin identidad pública");
  await expect(record).toContainText(
    "Registro administrativo, sin narrativa personal",
  );
  await record.getByText("Revisar esta evidencia", { exact: true }).click();
  await record
    .getByLabel("Clasificación", { exact: true })
    .selectOption("useful");
  const note = `Comprobar la demora y el proceso actual ${marker}`;
  await record.getByLabel("Nota de revisión", { exact: true }).fill(note);
  await record
    .getByRole("button", { name: "Guardar revisión", exact: true })
    .click();
  await expect(radar.getByRole("status")).toContainText("Revisión guardada");

  await page.reload();
  await openRadar(page, isMobile);
  await radar.getByRole("button", { name: /^Evidencia/ }).click();
  await radar.getByLabel("Buscar problema o cita").fill(issue);
  const savedRecord = radar.locator(".ev-record").filter({ hasText: issue });
  await savedRecord.locator(".ev-review > summary").click();
  await expect(
    savedRecord.getByLabel("Nota de revisión", { exact: true }),
  ).toHaveValue(note);
  await expect(savedRecord.locator(".ev-saved-note")).toContainText(note);

  await radar.getByRole("button", { name: /^Problemas/ }).click();
  const dossier = radar.locator(".ev-dossier").filter({ hasText: provider });
  await expect(dossier).toHaveCount(1);
  await dossier.locator(":scope > summary").click();
  await expect(dossier).toContainText(
    "0 autores identificados · 2 casos anónimos",
  );
  await expect(
    dossier.getByRole("heading", {
      name: "Actividad · publicación frente a captura",
    }),
  ).toBeVisible();
  await expect(dossier.locator(".ev-activity")).toContainText(
    "0 casos publicados",
  );
  await expect(dossier.locator(".ev-activity")).toContainText(
    "2 capturados en el período",
  );
  await expect(
    dossier.getByRole("heading", { name: "Contradicciones y límites" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    dossier.getByRole("button", { name: "Llevar a Entrevistas" }),
  ).toHaveCount(0);
  expect(writes.every((write) => JSON.parse(write).action !== "project")).toBe(
    true,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
