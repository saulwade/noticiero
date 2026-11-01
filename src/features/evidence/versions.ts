import type { EvidenceRecord } from "./types";

/** Deterministic latest capture per case; callers may filter the resulting snapshots by time. */
export function latestEvidenceVersions(records: EvidenceRecord[]) {
  const latest = new Map<string, EvidenceRecord>();
  for (const record of [...records].sort(
    (a, b) =>
      (a.revision ?? 0) - (b.revision ?? 0) ||
      a.capturedAt.localeCompare(b.capturedAt) ||
      a.id.localeCompare(b.id),
  ))
    latest.set(`${record.source}:${record.externalId}`, record);
  return [...latest.values()];
}
