import type { Opportunity, ResearchNote, ResearchSignal } from "@/lib/types";

export function proposeLocalOpportunities(
  notes: ResearchNote[],
  signals: ResearchSignal[],
  now = new Date(),
): Opportunity[] {
  const byId = new Map(signals.map((signal) => [signal.id, signal]));
  return notes
    .filter((note) => note.status === "repeated")
    .flatMap((note) => {
      const members = note.signalIds.flatMap((id) =>
        byId.get(id) ? [byId.get(id)!] : [],
      );
      const representatives = new Map<string, ResearchSignal>();
      for (const signal of members.filter((member) => member.author)) {
        const previous = representatives.get(signal.independenceKey);
        // A later workaround must not hide this person's explicit need.
        if (
          !previous ||
          (previous.kind === "workaround" && signal.kind !== "workaround")
        )
          representatives.set(signal.independenceKey, signal);
      }
      const byVoice = [...representatives.values()];
      if (
        byVoice.length < 2 ||
        !byVoice.some(
          (signal) => signal.kind === "request" || signal.kind === "pain",
        )
      )
        return [];
      let proposal = `Hipótesis: reducir un paso repetido relacionado con ${note.label.toLowerCase()}, empezando por el problema descrito en las citas.`;
      let mvp =
        "Un prototipo que resuelva un solo caso de las citas. Probarlo manualmente con un usuario antes de automatizar todo.";
      if (note.label.includes("Costos")) {
        proposal =
          "Un panel por proyecto que consolide consumo de modelos y alerte antes de agotar presupuestos.";
        mvp =
          "Importar un archivo de consumo, agrupar costos por proyecto y generar una alerta de umbral. Validar con dos usuarios antes de conectar proveedores.";
      }
      if (note.label.includes("Facturación")) {
        proposal =
          "Una herramienta que convierta documentos de facturación de formatos repetidos en registros conciliables y revisables.";
        mvp =
          "Procesar dos formatos aportados voluntariamente por usuarios, marcar discrepancias y exportar una tabla, manteniendo revisión humana.";
      }
      if (note.label.includes("Integraciones")) {
        proposal =
          "Un conector pequeño para el traspaso de información que las personas describen hacer a mano.";
        mvp =
          "Conectar únicamente las dos herramientas mencionadas por los participantes y resolver un flujo con registro de errores.";
      }
      if (note.label.includes("reuniones")) {
        proposal =
          "Convertir transcripciones en tareas revisables y seguimiento dentro de una herramienta existente.";
        mvp =
          "Importar una transcripción autorizada y producir una lista de acciones editable, sin grabaciones automáticas.";
      }
      return [
        {
          id: `local-${note.id}`,
          title: `Explorar: ${note.label}`,
          problem: `Se encontraron ${byVoice.length} autores públicos distintos con solicitudes o fricción relacionada. El alcance real del problema debe comprobarse en las citas.`,
          customer:
            "Segmento por validar: usuarios que describen este proceso. No se ha comprobado su rol, presupuesto ni disposición a pagar.",
          proposal,
          mvp,
          experiment:
            "Durante una semana, entrevistar con consentimiento a cinco personas del segmento y observar cómo resuelven hoy el problema. No enviar mensajes automáticamente.",
          successSignal:
            "Umbral propuesto: dos personas aceptan probar el mismo flujo y una describe una consecuencia medible del problema.",
          whyNow: `El cuaderno registra señales desde ${note.firstSeen.slice(0, 10)}. Su repetición justifica investigar, no demuestra un mercado.`,
          evidence: byVoice.slice(0, 4).map((signal) => ({
            storyId: signal.storyId,
            reason:
              signal.kind === "request"
                ? "Solicitud explícita de ayuda o solución."
                : signal.kind === "pain"
                  ? "Fricción expresada por el autor."
                  : "Solución manual descrita por el autor.",
            url: signal.url,
            sourceName: signal.sourceName,
            quote: signal.quote,
          })),
          difficulty: "Media" as const,
          confidence: "Exploratoria" as const,
          caveat:
            "Hipótesis construida con plantillas locales y agrupación estadística. Autores no verificados; similitud no equivale a la misma necesidad ni a clientes dispuestos a pagar.",
          createdAt: now.toISOString(),
          engine: "local" as const,
          researchNoteId: note.id,
        },
      ];
    });
}
