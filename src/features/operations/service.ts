import { getDb, resultRows } from "@/db/client";
import { sql } from "drizzle-orm";
import {
  capacityFindings,
  type StorageCapacity,
} from "@/features/storage/capacity";
import {
  jobs,
  backupRuns,
  operationAlerts,
  evidenceConnectors,
  financeSync,
  financeInstruments,
  financeProfiles,
} from "@/db/schema";
import { financeSyncFindings } from "@/features/finance/daily-sync";
import { healthFindings } from "./health";
import type { BackupRun, OperationAlert, OperationsData } from "@/lib/types";
import { z } from "zod";
export async function getOperationsData(): Promise<OperationsData> {
  const db = await getDb();
  let capacity: StorageCapacity | undefined;
  try {
    const row = resultRows(
      await db.execute(sql`SELECT
      pg_database_size(current_database())::bigint AS database_bytes,
      (SELECT count(*) FROM evidence_records)::bigint AS evidence_records,
      (SELECT coalesce(sum(octet_length(data::text)),0) FROM evidence_records)::bigint AS evidence_bytes`),
    )[0] as Record<string, unknown>;
    const values = [
      row.database_bytes,
      row.evidence_records,
      row.evidence_bytes,
    ].map(Number);
    if (!values.every((v) => Number.isSafeInteger(v) && v >= 0))
      throw new Error("Medición inválida");
    capacity = {
      databaseBytes: values[0],
      evidenceRecords: values[1],
      evidenceBytes: values[2],
      checkedAt: new Date().toISOString(),
    };
  } catch {
    /* Keep the dashboard available and surface the failed measurement. */
  }
  const [
    runs,
    backups,
    alerts,
    connectors,
    financialStates,
    instruments,
    profiles,
  ] = await Promise.all([
    db.select().from(jobs),
    db.select().from(backupRuns),
    db.select().from(operationAlerts),
    db.select().from(evidenceConnectors),
    db.select().from(financeSync),
    db.select().from(financeInstruments),
    db.select().from(financeProfiles),
  ]);
  const backup = backups
    .map((row) => row.data)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  const lastSuccessfulUpdate = runs
    .map((row) => row.data)
    .filter((job) => ["completed", "partial"].includes(job.status))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]?.finishedAt;
  const current = healthFindings(
    runs.map((row) => row.data),
    backup,
  );
  current.push(...capacityFindings(capacity));
  if (!backup?.archive || backup.archive.status !== "completed")
    current.push({
      id: "archive-unconfirmed",
      message:
        "El archivo histórico duradero no tiene una copia verificada en el último respaldo. El contenido de la base se conserva.",
    });
  current.push(
    ...financeSyncFindings(
      financialStates.map((r) => r.data),
      instruments.map((r) => r.data),
    ),
  );
  if (profiles.length) {
    const analysis = financialStates.find(
      (r) => r.id === "automatic-analysis",
    )?.data;
    if (
      !analysis?.lastSuccess ||
      analysis.status === "error" ||
      Date.now() - Date.parse(analysis.lastSuccess) > 36 * 3600000
    )
      current.push({
        id: "finance-automatic-analysis",
        message:
          "Finanzas: falta confirmar el análisis cuantitativo automático. Se conserva la propuesta anterior.",
      });
  }
  const now = new Date().toISOString();
  for (const row of connectors) {
    if (row.data.status === "error" || row.data.blocked)
      current.push({
        id: `evidence-${row.id}`,
        message: `Radar: ${row.id} — ${row.data.message}`,
      });
  }
  return {
    backup,
    capacity,
    lastSuccessfulUpdate,
    repository: process.env.OPS_REPOSITORY,
    alerts: current.map((finding) => {
      const old = alerts.find((row) => row.id === finding.id)?.data;
      return {
        ...finding,
        firstSeen: old && !old.resolvedAt ? old.firstSeen : now,
        lastSeen: now,
      };
    }),
  };
}
export async function reconcileOperations() {
  const db = await getDb();
  const data = await getOperationsData();
  const now = new Date().toISOString();
  const old = await db.select().from(operationAlerts);
  await db.transaction(async (tx) => {
    for (const alert of data.alerts)
      await tx
        .insert(operationAlerts)
        .values({ id: alert.id, data: alert })
        .onConflictDoUpdate({
          target: operationAlerts.id,
          set: { data: alert },
        });
    for (const row of old)
      if (
        !row.data.resolvedAt &&
        !data.alerts.some((alert) => alert.id === row.id)
      ) {
        const resolved: OperationAlert = { ...row.data, resolvedAt: now };
        await tx
          .insert(operationAlerts)
          .values({ id: row.id, data: resolved })
          .onConflictDoUpdate({
            target: operationAlerts.id,
            set: { data: resolved },
          });
      }
  });
  return data;
}
const backupInput = z.object({
  status: z.enum(["completed", "failed"]),
  runId: z.string().regex(/^\d+$/),
  bytes: z.number().int().nonnegative().max(500000000).optional(),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  counts: z
    .record(z.string().regex(/^[a-z_]+$/), z.number().int().nonnegative())
    .optional(),
  archive: z
    .object({
      status: z.enum(["completed", "failed"]),
      url: z
        .string()
        .regex(
          /^https:\/\/github\.com\/saulwade\/noticiero-ops\/releases\/tag\/history-\d{4}-\d{2}$/,
        )
        .optional(),
      sha256: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
      bytes: z.number().int().positive().max(40_000_000).optional(),
    })
    .optional(),
});
export async function recordBackup(raw: unknown) {
  const input = backupInput.parse(raw);
  if (
    input.status === "completed" &&
    (!input.sha256 || !input.bytes || !input.counts)
  )
    throw new Error("Manifiesto incompleto.");
  if (
    input.archive?.status === "completed" &&
    (!input.archive.url || !input.archive.sha256 || !input.archive.bytes)
  )
    throw new Error("Manifiesto del archivo incompleto.");
  const data: BackupRun = {
    ...input,
    id: `github-${input.runId}-${input.status}`,
    at: new Date().toISOString(),
  };
  const db = await getDb();
  await db
    .insert(backupRuns)
    .values({ id: data.id, data })
    .onConflictDoUpdate({ target: backupRuns.id, set: { data } });
  return reconcileOperations();
}
