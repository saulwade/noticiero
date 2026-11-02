const messages = {
  "update-missing": "Falta la edición de la última ventana programada.",
  "update-failed": "La última actualización falló.",
  "update-partial": "La última edición quedó incompleta; hay datos pendientes.",
  "update-stuck":
    "Una actualización no ha terminado dentro del plazo esperado.",
  "backup-missing": "No hay un respaldo automático confirmado.",
  "backup-failed": "El último respaldo falló.",
  "backup-stale": "El respaldo tiene más de treinta y seis horas.",
  "archive-unconfirmed":
    "El archivo histórico duradero no tiene una copia verificada en el último respaldo.",
  "storage-check-failed":
    "No se pudo comprobar el espacio disponible de la base.",
  "storage-database":
    "La base principal se acerca al margen de almacenamiento gratuito. Revisar capacidad sin borrar datos.",
  "storage-evidence-bytes":
    "La evidencia se acerca al límite de espacio configurado. Revisar capacidad sin borrar datos.",
  "storage-evidence-records":
    "La evidencia se acerca al límite de registros configurado. Revisar capacidad sin borrar datos.",
};
export function operationMessage(item) {
  const message = messages[item.id];
  if (
    message &&
    [
      "storage-database",
      "storage-evidence-bytes",
      "storage-evidence-records",
    ].includes(item.id)
  )
    return `${String(item.message).startsWith("Prioritario:") ? "Prioritario (85% o más)" : "Preventivo (70% o más)"}: ${message}`;
  return (
    message ??
    (String(item.id).startsWith("source-")
      ? "Una fuente activa no pudo consultarse."
      : "Se detectó un problema operativo.")
  );
}
