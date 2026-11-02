const messages = {
  "finance-stock-evidence":
    "La investigación adicional de empresas tiene fuentes pendientes. El estado y la cobertura se conservan en la app; revisar si requiere atención.",
  "finance-news-research":
    "No está confirmado el informe automático de investigación financiera. Revisar el proceso; se conserva el historial anterior.",
  "finance-automatic-analysis":
    "No está confirmado el análisis automático del portafolio. Revisar el proceso; se conserva el informe anterior.",
  "finance-fx-missing":
    "La referencia USD/MXN está pendiente de actualización. Revisar antes de usar la valoración.",
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
  "evidence-sfc-co":
    "La fuente de estadísticas de Colombia no pudo actualizarse. Se conserva el historial anterior; revisar el detalle en la app.",
  "evidence-profeco":
    "La fuente de PROFECO no pudo actualizarse. Se conserva el historial anterior; revisar el detalle en la app.",
  "evidence-github":
    "La muestra de problemas de GitHub no pudo actualizarse. Se conserva el historial anterior; revisar el detalle en la app.",
  "evidence-cfpb":
    "La muestra de reclamaciones de CFPB no pudo actualizarse. Se conserva el historial anterior; revisar el detalle en la app.",
  "evidence-hn":
    "La muestra de Hacker News no pudo actualizarse. Se conserva el historial anterior; revisar el detalle en la app.",
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
