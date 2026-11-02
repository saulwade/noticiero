export const MAX_EVIDENCE_RECORDS = 50_000;
export const MAX_EVIDENCE_BYTES = 64_000_000;
// Reference allowance for the principal database, not project-wide billing usage.
export const DATABASE_REFERENCE_BYTES = 1_000_000_000;
export type StorageCapacity = {
  databaseBytes: number;
  evidenceBytes: number;
  evidenceRecords: number;
  checkedAt: string;
};
export function capacityFindings(capacity?: StorageCapacity) {
  if (!capacity)
    return [
      {
        id: "storage-check-failed",
        message:
          "No se pudo medir el espacio disponible. El historial se conserva; revisa la medición.",
      },
    ];
  const metrics = [
    [
      "database",
      "la base principal",
      capacity.databaseBytes,
      DATABASE_REFERENCE_BYTES,
    ],
    [
      "evidence-bytes",
      "el espacio de evidencia",
      capacity.evidenceBytes,
      MAX_EVIDENCE_BYTES,
    ],
    [
      "evidence-records",
      "los registros de evidencia",
      capacity.evidenceRecords,
      MAX_EVIDENCE_RECORDS,
    ],
  ] as const;
  return metrics.flatMap(([id, label, used, limit]) => {
    const ratio = used / limit;
    if (ratio < 0.7) return [];
    return [
      {
        id: `storage-${id}`,
        message: `${ratio >= 0.85 ? "Prioritario" : "Aviso preventivo"}: ${label} alcanzó el ${Math.floor(ratio * 100)}% del margen configurado. Revisar capacidad antes de que se detenga el ingreso. No se borran datos ni se cambia de plan automáticamente.`,
      },
    ];
  });
}
