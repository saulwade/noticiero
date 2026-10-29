import { editionFor } from "@/lib/time";
import type { BackupRun, JobRun } from "@/lib/types";
export type Finding = { id: string; message: string };
export function healthFindings(
  jobs: JobRun[],
  backup: BackupRun | undefined,
  now = new Date(),
): Finding[] {
  const findings: Finding[] = [];
  const latest = [...jobs].sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt),
  )[0];
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Mexico_City",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  const date = editionFor(
    new Date(now.getTime() - (hour < 9 ? 86400000 : 0)),
  ).date;
  const due = Date.parse(
    `${date}T${hour >= 9 && hour < 22 ? "07" : "20"}:00:00-06:00`,
  );
  const successful = jobs.some(
    (job) =>
      ["completed", "partial"].includes(job.status) &&
      Date.parse(job.startedAt) >= due,
  );
  if (!successful)
    findings.push({
      id: "update-missing",
      message:
        "Falta una actualización completada para la última ventana programada.",
    });
  if (latest?.status === "failed")
    findings.push({
      id: "update-failed",
      message:
        "La última actualización falló. Se conserva la edición anterior.",
    });
  if (latest?.status === "partial")
    findings.push({
      id: "update-partial",
      message:
        "La última edición quedó incompleta. Hay fuentes o datos pendientes.",
    });
  if (
    latest?.status === "running" &&
    now.getTime() - Date.parse(latest.startedAt) > 20 * 60000
  )
    findings.push({
      id: "update-stuck",
      message: "Una actualización lleva más de veinte minutos sin finalizar.",
    });
  for (const source of latest?.sourceStates ?? [])
    if (source.status === "error")
      findings.push({
        id: `source-${source.id}`,
        message: `No se pudo consultar ${source.name}.`,
      });
  if (!backup)
    findings.push({
      id: "backup-missing",
      message: "Aún no hay un respaldo automático confirmado.",
    });
  else if (backup.status === "failed")
    findings.push({
      id: "backup-failed",
      message: "El último intento de respaldo falló.",
    });
  else if (now.getTime() - Date.parse(backup.at) > 36 * 3600000)
    findings.push({
      id: "backup-stale",
      message:
        "El último respaldo confirmado tiene más de treinta y seis horas.",
    });
  return findings;
}
