import { expect, test } from "@playwright/test";
import type { EvidenceData } from "../../src/features/evidence/types";

test("evidencia y reportes disponibles sin una pantalla de investigación", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const evidence = await page.request.get("/api/evidence");
  expect(evidence.ok()).toBe(true);
  const before: EvidenceData = await evidence.json();
  expect(Array.isArray(before.records)).toBe(true);
  const exported = await page.request.get("/api/evidence/export");
  expect(exported.ok()).toBe(true);
  expect(exported.headers()["content-type"]).toContain("text/markdown");
  const report = await page.request.get("/api/research/brief?days=3");
  expect(report.ok()).toBe(true);
  expect(await report.text()).toContain("Noticiero · investigación de");
  await expect(
    page.locator(
      ".evidence-workspace,.research-workspace,.idea-notes,.ideas-tab-panel",
    ),
  ).toHaveCount(0);
  if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(
    page.getByRole("button", {
      name: /Oportunidades|Importar CSV|Generar reporte de hoy/,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Estado y respaldos", exact: true })
    .click();
  await expect(
    page.getByLabel("Estado de la investigación automática"),
  ).toContainText("se conservan en segundo plano");
  const after: EvidenceData = await (
    await page.request.get("/api/evidence")
  ).json();
  expect(after.totalRecords).toBeGreaterThanOrEqual(before.totalRecords);
  const afterIds = new Set(after.records.map((record) => record.id));
  expect(before.records.every((record) => afterIds.has(record.id))).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("la API conserva evidencia, revisión y exportación al retirar formularios", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const marker = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const provider = `Proveedor de prueba ${marker}`;
  const issue = `No puedo obtener el reembolso ${marker}-uno`;
  const csv = [
    "expediente,fecha_ingreso,proveedor,motivo_reclamacion,giro",
    `${marker}-uno,2026-01-15,${provider},${issue},Servicios`,
    `${marker}-dos,2026-01-16,${provider},No puedo obtener el reembolso ${marker}-dos,Servicios`,
  ].join("\n");
  const headers = { Origin: new URL(page.url()).origin };
  const imported = await page.request.post("/api/evidence", {
    headers,
    data: { action: "import", csv },
  });
  expect(imported.ok()).toBe(true);
  expect((await imported.json()).added).toBe(2);
  const repeat = await page.request.post("/api/evidence", {
    headers,
    data: { action: "import", csv },
  });
  expect((await repeat.json()).added).toBe(0);
  const data: EvidenceData = await (
    await page.request.get("/api/evidence")
  ).json();
  const record = data.records.find((r) => r.issue === issue)!;
  expect(record).toMatchObject({
    country: "MX",
    kind: "complaint",
    product: provider,
  });
  const note = `Comprobar el proceso ${marker}`;
  const reviewed = await page.request.post("/api/evidence", {
    headers,
    data: { action: "review", id: record.id, decision: "useful", note },
  });
  expect(reviewed.ok()).toBe(true);
  await page.reload();
  await expect(
    page.locator(".evidence-workspace,.research-workspace,.idea-notes"),
  ).toHaveCount(0);
  const after: EvidenceData = await (
    await page.request.get("/api/evidence")
  ).json();
  expect(after.records.some((r) => r.id === record.id)).toBe(true);
  expect(after.reviews.find((r) => r.id === record.id)?.note).toBe(note);
  const exported = await page.request.get("/api/evidence/export");
  expect(exported.ok()).toBe(true);
  expect(await exported.text()).toContain(issue);
});
