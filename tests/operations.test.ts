import { describe, it, expect, beforeEach } from "vitest";
import { healthFindings } from "@/features/operations/health";
import {
  reconcileOperations,
  recordBackup,
} from "@/features/operations/service";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import type { JobRun, BackupRun } from "@/lib/types";
const now = new Date("2026-10-29T15:37:00Z");
const job: JobRun = {
  id: "health-job",
  editionKey: "test",
  startedAt: "2026-10-29T13:30:00Z",
  finishedAt: "2026-10-29T13:31:00Z",
  status: "completed",
  stage: "Listo",
  storiesAdded: 0,
  sourceStates: [{ id: "hn", name: "Hacker News", status: "ok", count: 1 }],
};
const backup: BackupRun = {
  id: "test-backup",
  at: "2026-10-29T10:23:00Z",
  status: "completed",
};
describe("monitor independiente", () => {
  it("detecta una edición omitida aunque la última actualización tenga menos de dieciséis horas", () => {
    expect(
      healthFindings(
        [{ ...job, startedAt: "2026-10-29T02:20:00Z" }],
        backup,
        now,
      ).map((item) => item.id),
    ).toContain("update-missing");
    expect(healthFindings([job], backup, now)).toEqual([]);
  });
  it("comprueba la ventana nocturna sin exigir la edición de la mañana antes de tiempo", () => {
    expect(
      healthFindings(
        [{ ...job, startedAt: "2026-10-29T02:20:00Z" }],
        backup,
        new Date("2026-10-29T12:00:00Z"),
      ),
    ).toEqual([]);
    expect(
      healthFindings([job], backup, new Date("2026-10-30T04:37:00Z")).map(
        (item) => item.id,
      ),
    ).toContain("update-missing");
  });
  it("señala fallos de fuentes, ejecuciones detenidas y respaldos vencidos", () => {
    const findings = healthFindings(
      [
        {
          ...job,
          status: "running",
          sourceStates: [{ id: "hn", name: "HN", status: "error", count: 0 }],
        },
      ],
      { ...backup, at: "2026-10-27T00:00:00Z" },
      now,
    ).map((item) => item.id);
    expect(findings).toEqual(
      expect.arrayContaining(["update-stuck", "source-hn", "backup-stale"]),
    );
  });
  it("avisa de una edición parcial aunque las fuentes hayan respondido", () => {
    expect(
      healthFindings(
        [{ ...job, status: "partial", message: "Cotizaciones pendientes" }],
        backup,
        now,
      ).map((item) => item.id),
    ).toContain("update-partial");
  });
});
describe("registro operativo", () => {
  beforeEach(async () => {
    const db = await getDb();
    for (const table of [
      schema.jobs,
      schema.backupRuns,
      schema.operationAlerts,
      schema.financeSync,
      schema.financeInstruments,
      schema.financeProfiles,
    ])
      await db.delete(table);
    const captured = new Date().toISOString();
    await db.insert(schema.financeSync).values({
      id: "news-research",
      data: {
        id: "news-research",
        label: "Investigación financiera",
        provider: "Motor local",
        status: "ok",
        message: "Fixture",
        lastSuccess: captured,
      },
    });
    await db.insert(schema.financeSync).values({
      id: "fx:USD/MXN",
      data: {
        id: "fx:USD/MXN",
        label: "USD/MXN",
        provider: "Frankfurter",
        status: "ok",
        message: "Referencia sintética de salud",
        lastSuccess: captured,
        asOf: captured.slice(0, 10),
      },
    });
  });
  it("avisa si falta el análisis automático de un perfil configurado y se resuelve al recuperarlo", async () => {
    const db = await getDb();
    const at = new Date().toISOString();
    await db
      .insert(schema.financeProfiles)
      .values({
        id: "health-profile",
        data: {
          id: "health-profile",
          version: 1,
          initialCapitalMxn: "12000",
          monthlyContributionMxn: "300",
          horizonYears: 12,
          riskPreference: "unconfirmed",
          reserveExcluded: true,
          broker: { name: "Ejemplo", verified: false },
          updatedAt: at,
        },
      });
    expect(
      (await reconcileOperations()).alerts.some(
        (a) => a.id === "finance-automatic-analysis",
      ),
    ).toBe(true);
    await db
      .insert(schema.financeSync)
      .values({
        id: "automatic-analysis",
        data: {
          id: "automatic-analysis",
          label: "Análisis",
          provider: "Python",
          status: "ok",
          message: "Fixture",
          lastSuccess: at,
        },
      });
    expect(
      (await reconcileOperations()).alerts.some(
        (a) => a.id === "finance-automatic-analysis",
      ),
    ).toBe(false);
  });
  it("deduplica y resuelve el aviso después de recuperar el servicio", async () => {
    const first = await reconcileOperations();
    await reconcileOperations();
    const db = await getDb();
    expect((await db.select().from(schema.operationAlerts)).length).toBe(
      first.alerts.length,
    );
    const at = new Date().toISOString();
    await db
      .insert(schema.jobs)
      .values({ id: job.id, data: { ...job, startedAt: at, finishedAt: at } });
    const recovered = await recordBackup({
      status: "completed",
      runId: "123",
      bytes: 20,
      sha256: "a".repeat(64),
      counts: { stories: 1 },
    });
    expect(recovered.alerts).toEqual([]);
    expect(
      (await db.select().from(schema.operationAlerts)).every(
        (row) => row.data.resolvedAt,
      ),
    ).toBe(true);
  });
  it("rechaza un respaldo completado sin manifiesto", async () => {
    await expect(
      recordBackup({ status: "completed", runId: "123" }),
    ).rejects.toThrow("Manifiesto");
  });
});
