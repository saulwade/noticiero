import type {
  DailyReport,
  ResearchNote,
  ResearchSignal,
  Opportunity,
  Story,
} from "@/lib/types";
import { hash } from "@/features/news/normalize";
import { editionFor, TIME_ZONE } from "@/lib/time";
import { proposeLocalOpportunities } from "./opportunities";
import { isRelevantStory } from "@/features/news/relevance";
import { groupStories, rankStories } from "@/features/news/deduplicate";

const clean = (text: string) =>
  text
    .replace(/[\r\n]+/g, " ")
    .replace(/[<>]/g, "")
    .trim();
export function localHour(now = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
}
export function createDailyReport(
  date: string,
  stories: Story[],
  signals: ResearchSignal[],
  notes: ResearchNote[],
  ideas: Opportunity[],
  now = new Date(),
): DailyReport {
  const todaySignals = signals.filter(
    (signal) => editionFor(new Date(signal.detectedAt)).date === date,
  );
  const activeNotes = notes.filter((note) =>
    note.journal.some((entry) => entry.date === date),
  );
  const availableSignals = signals.filter(
    (signal) => editionFor(new Date(signal.detectedAt)).date <= date,
  );
  const documents = stories.filter(
    (story) => editionFor(new Date(story.detectedAt)).date === date,
  );
  const themes = activeNotes.slice(0, 8).map((note) => {
    const members = availableSignals.filter((signal) =>
      note.signalIds.includes(signal.id),
    );
    return {
      noteId: note.id,
      label: note.label,
      voices: new Set(
        members
          .filter((signal) => signal.author)
          .map((signal) => signal.independenceKey),
      ).size,
      signals: members.length,
      evidence: members.slice(-4),
    };
  });
  const noteIds = new Set(activeNotes.map((note) => note.id));
  const publishedIds = new Set(
    ideas
      .filter(
        (idea) =>
          idea.researchNoteId &&
          noteIds.has(idea.researchNoteId) &&
          editionFor(new Date(idea.createdAt)).date <= date,
      )
      .map((idea) => idea.id),
  );
  const asOfNotes = activeNotes.map((note) => {
    const members = availableSignals.filter((signal) =>
      note.signalIds.includes(signal.id),
    );
    const voices = new Set(
      members
        .filter((signal) => signal.author)
        .map((signal) => signal.independenceKey),
    ).size;
    return {
      ...note,
      signalIds: members.map((signal) => signal.id),
      independentVoices: voices,
      status: voices >= 2 ? ("repeated" as const) : ("isolated" as const),
    };
  });
  // Reconstruct evidence as of the cutoff: an edited comment keeps its story ID.
  const relatedIdeas = proposeLocalOpportunities(
    asOfNotes,
    availableSignals,
    new Date(`${date}T23:59:59-06:00`),
  ).filter((idea) => publishedIds.has(idea.id));
  const news = rankStories(
    groupStories(
      documents.filter(
        (story) =>
          !["comment", "research", "question"].includes(story.kind ?? "news") &&
          isRelevantStory(
            story.originalTitle ?? story.title,
            story.excerpt,
            story.sourceId,
          ),
      ),
    ),
    new Date(`${date}T23:59:59-06:00`).getTime(),
  )
    .slice(0, 8)
    .map((story) => ({
      title: story.title,
      excerpt: (story.summary ?? story.excerpt).slice(0, 400),
      url: story.url,
      sourceName: story.sourceName,
    }));
  const provisional = date === editionFor(now).date && localHour(now) < 20;
  const lines = [
    `# Reporte de investigación · ${date}`,
    "",
    `${provisional ? "Corte provisional" : "Cierre nocturno"} · generado ${now.toISOString()} · zona editorial ${TIME_ZONE}.`,
    "",
    "## Qué se observó",
    "",
    `- ${documents.length} documentos incorporados en la jornada.`,
    `- ${todaySignals.length} señales nuevas de solicitudes, fricción o soluciones manuales.`,
    `- ${activeNotes.length} notas con observaciones nuevas.`,
    `- Motor: TF-IDF, similitud coseno y reglas explícitas; sin API de IA.`,
    "",
  ];
  lines.push(
    "## Noticias de la jornada",
    "",
    ...news.flatMap((item) => [
      `### [${clean(item.title)}](${item.url})`,
      "",
      `${clean(item.sourceName)} · extracto disponible: ${clean(item.excerpt) || "Solo titular."}`,
      "",
    ]),
    "## Señales de problemas",
    "",
  );
  if (!themes.length)
    lines.push(
      "No se encontraron señales suficientes para destacar temas nuevos. La ausencia de señales no demuestra ausencia de demanda.",
    );
  for (const theme of themes) {
    lines.push(
      `### ${clean(theme.label)}`,
      "",
      `${theme.voices} autores/orígenes distintos en ${theme.signals} observaciones acumuladas.`,
      "",
    );
    const note = notes.find((item) => item.id === theme.noteId)!;
    const evidence = availableSignals
      .filter((signal) => note.signalIds.includes(signal.id))
      .slice(-4);
    for (const signal of evidence)
      lines.push(
        `> ${clean(signal.quote)}`,
        "",
        `[${clean(signal.sourceName)}${signal.author ? ` · ${clean(signal.author)}` : ""}](${signal.url}) · publicado ${editionFor(new Date(signal.occurredAt)).date} · observado ${editionFor(new Date(signal.detectedAt)).date}.`,
        "",
      );
  }
  lines.push("## Hipótesis para validar", "");
  if (!relatedIdeas.length)
    lines.push(
      "No se publica una nueva hipótesis sin repetición suficiente de señales. Las notas aisladas siguen disponibles en el cuaderno.",
      "",
    );
  for (const idea of relatedIdeas)
    lines.push(
      `### ${clean(idea.title)}`,
      "",
      clean(idea.proposal),
      "",
      `**Primer experimento:** ${clean(idea.experiment)}`,
      "",
      `**Señal de éxito propuesta:** ${clean(idea.successSignal)}`,
      "",
    );
  lines.push(
    "## Contexto consultado",
    "",
    ...documents
      .filter((story) => story.kind === "research" || story.sourceId === "yc")
      .slice(0, 6)
      .map(
        (story) =>
          `- [${clean(story.originalTitle ?? story.title)}](${story.url}) · contexto editorial, no demanda verificada.`,
      ),
    "",
    "## Límites",
    "",
    "La cobertura es una muestra acotada de fuentes públicas. No representa todo el mercado. Los autores no se han verificado, una queja no prueba disposición a pagar y las agrupaciones pueden contener errores. Las citas conservan su idioma original. No se contactó a ninguna persona. Las notas y los enlaces permiten comprobar cada señal.",
  );
  return {
    date,
    news,
    generatedAt: now.toISOString(),
    inputHash: hash(
      JSON.stringify({
        date,
        signalIds: todaySignals.map((signal) => signal.id).sort(),
        docs: documents
          .map((story) => `${story.id}:${story.contentHash}`)
          .sort(),
        noteState: themes.map((theme) => `${theme.noteId}:${theme.signals}`),
        ideas: relatedIdeas,
        news,
        themes,
        provisional,
      }),
    ),
    provisional,
    documentCount: documents.length,
    signalCount: availableSignals.length,
    newSignals: todaySignals.length,
    themes,
    opportunityIds: relatedIdeas.map((idea) => idea.id),
    hypotheses: relatedIdeas,
    sourceNames: [...new Set(documents.map((story) => story.sourceName))],
    markdown: lines.join("\n"),
  };
}
