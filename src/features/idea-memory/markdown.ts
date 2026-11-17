import type { IdeaMemoryData } from "./types";
const text = (value: string) => value.replace(/[\r\n<>]/g, " ");
const decisions = {
  watch: "En seguimiento",
  investigate: "Investigar",
  pause: "Pausada",
  discard: "Descartada",
};
export function ideaMemoryMarkdown(memory: IdeaMemoryData, compact = false) {
  const definitions = [...memory.definitions].sort(
    (a, b) =>
      Number(b.origin === "review") - Number(a.origin === "review") ||
      a.id.localeCompare(b.id),
  );
  const shown = compact ? definitions.slice(0, 8) : definitions;
  return [
    "## Memoria de ideas y calidad de evidencia",
    "",
    `${memory.definitions.length} líneas conservadas · ${memory.assessmentCount} evaluaciones archivadas · ${memory.linkedRevisions} vínculos versionados · ${memory.sourceCheckCount} consultas de fuentes. Última evaluación: ${memory.updatedAt ?? "pendiente"}.`,
    "",
    "Los casos, cuentas y citas no equivalen a organizaciones verificadas ni intención de compra. Las comparaciones son de la muestra; el archivo no se entrena por sí solo.",
    "",
    ...shown.flatMap((idea) => {
      const a = memory.assessments.find((item) => item.ideaId === idea.id);
      const entries = memory.decisions.filter((d) => d.ideaId === idea.id);
      return [
        `### ${idea.id} · ${text(idea.title)}`,
        "",
        text(idea.hypothesis),
        ...(!a
          ? ["Evaluación automática pendiente."]
          : [
              `Estado: ${decisions[a.decision]}. Evaluado ${a.asOf}.`,
              `${a.totals.cases} registros distintos enlazados, ${a.totals.revisions} versiones; ${a.totals.activeCases} obstáculos recientes abiertos. ${a.totals.publicAccounts} cuentas públicas y ${a.totals.anonymousCases} expedientes sin identidad pública; ${a.totals.mexicoCases} casos recientes con procedencia mexicana documentada.`,
              `Se conservan aparte ${a.totals.historical} antecedentes, ${a.totals.resolved} resoluciones declaradas, ${a.totals.closedUnverified} cierres sin verificar, ${a.totals.promotions} promociones, ${a.totals.context} piezas de contexto, ${a.totals.statistics} estadísticas y ${a.totals.rejected} exclusiones humanas.`,
              `Ventana móvil: ${a.weekly.currentCases} casos originales de los últimos siete días frente a ${a.weekly.previousCases} de los siete anteriores; ${a.weekly.newAccounts} cuentas sin antecedentes previos en la muestra reciente. ${a.weekly.newCaptures} casos recién capturados incluyen ${a.weekly.historicalImports} antecedentes; ${a.weekly.revisions} capturas son revisiones. No es crecimiento del mercado.`,
              `Repetición específica: ${a.weekly.repeatedMechanisms} mecanismos entre cuentas distintas. Consecuencias cuantificadas declaradas: ${a.totals.quantifiedConsequences}; menciones explícitas de rol/clientes: ${a.totals.buyerStatements}. Ninguna se considera medición auditada o comprador verificado.`,
              ...a.mechanisms
                .filter((m) => m.cases >= 2 && !m.key.startsWith("isolated:"))
                .slice(0, 5)
                .map(
                  (m) =>
                    `- Patrón de la muestra: ${text(m.label)} · ${m.cases} casos, ${m.publicAccounts} cuentas públicas y ${m.anonymousCases} expedientes sin identidad pública · ${m.sourceFamilies} familias de fuentes. Expedientes distintos no prueban personas independientes.`,
                ),
              ...a.rationale.map((reason) => `- ${text(reason)}`),
              ...a.gaps.map((gap) => `- Falta: ${text(gap)}`),
              ...(!compact
                ? a.evidence.flatMap((e) => [
                    `> ${text(e.quote)}`,
                    `${e.url} · ${e.dateBasis === "source_updated" ? "actualizado en fuente (original desconocido)" : "original"} ${e.occurredAt} · captura ${e.capturedAt} · ${e.quality}.`,
                    ...Object.entries(e.fields).map(
                      ([key, value]) => `${key}: ${text(value)}`,
                    ),
                  ])
                : []),
              ...(!compact
                ? a.contradictions.flatMap((e) => [
                    `Evidencia que limita o contradice (${e.quality}): ${text(e.quote)}`,
                    e.url,
                  ])
                : []),
              ...a.sources
                .slice(0, compact ? 3 : 20)
                .map(
                  (source) =>
                    `- Fuente ${source.status}: ${source.url} · ${source.checkedAt ?? "sin consulta"} · ${text(source.message)}`,
                ),
              ...(compact && a.sources.length > 3
                ? [
                    `Otras ${a.sources.length - 3} fuentes y sus estados están en la exportación completa de memoria.`,
                  ]
                : []),
            ]),
        ...(!compact
          ? entries.flatMap((entry) => [
              `Decisión atribuida a revisión de investigación · ${entry.at}: ${decisions[entry.decision]} · ${text(entry.reason)}`,
              ...entry.references.map((url) => `- Referencia: ${url}`),
            ])
          : []),
        "",
      ];
    }),
    ...(shown.length < definitions.length
      ? [
          `${definitions.length - shown.length} líneas adicionales se conservan en la memoria completa.`,
        ]
      : []),
    "",
  ].join("\n");
}
