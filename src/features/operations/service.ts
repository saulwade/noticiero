import { getDb } from "@/db/client";
import {
  jobs,
  backupRuns,
  operationAlerts,
  evidenceConnectors,
} from "@/db/schema";
import { healthFindings } from "./health";
import type { BackupRun, OperationAlert, OperationsData } from "@/lib/types";
import { z } from "zod";
export async function getOperationsData(): Promise<OperationsData> {
  const db = await getDb();
  const [runs, backups, alerts, connectors] = await Promise.all([
    db.select().from(jobs),
    db.select().from(backupRuns),
    db.select().from(operationAlerts),
    db.select().from(evidenceConnectors),
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
});
export async function recordBackup(raw: unknown) {
  const input = backupInput.parse(raw);
  if (
    input.status === "completed" &&
    (!input.sha256 || !input.bytes || !input.counts)
  )
    throw new Error("Manifiesto incompleto.");
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
