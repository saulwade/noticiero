import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  researchModels,
  researchNotes,
  researchSignals,
  opportunities,
  opportunityBatches,
  dailyReports,
  opportunityEvents,
  researchObservations,
  stories as storedStories,
} from "@/db/schema";
import { getStories } from "@/db/repository";
import type { ResearchData } from "@/lib/types";
import { trainModel, keywords, terms } from "./vector";
import { extractSignals, classifySignal } from "./signals";
import { clusterSignals } from "./cluster";
import { proposeLocalOpportunities } from "./opportunities";
import { createDailyReport, localHour } from "./report";
import { editionFor } from "@/lib/time";
import { hash } from "@/features/news/normalize";
import { recordOpportunity } from "./archive";
import { authoredText } from "./evidence-text";

export async function getResearchData(): Promise<ResearchData> {
  const db = await getDb();
  const [models, notes, signals, reports, history, observations, community] =
    await Promise.all([
      db.select().from(researchModels).where(eq(researchModels.id, "local-v1")),
      db.select().from(researchNotes),
      db.select().from(researchSignals),
      db.select().from(dailyReports),
      db.select().from(opportunityEvents),
      db.select().from(researchObservations),
      db
        .select({
          id: storedStories.id,
          excerpt: sql<string>`${storedStories.data}->>'excerpt'`,
          authoredExcerpt: sql<
            string | null
          >`${storedStories.data}->>'authoredExcerpt'`,
          contentHash: sql<string>`${storedStories.data}->>'contentHash'`,
        })
        .from(storedStories)
        .where(sql`${storedStories.data}->>'kind' IN ('question','comment')`),
    ]);
  // Revalidate cached evidence when the explicit classifier improves; retain raw rows for audit.
  const sources = new Map(community.map((s) => [s.id, s]));
  const comparableText = (value: string) => value.replace(/\s+/g, " ").trim();
  const accepted = signals.flatMap((row) => {
    const quote = authoredText(row.data.quote);
    const source = sources.get(row.data.storyId);
    // A newly retained paragraph boundary can prove that a legacy flattened
    // quotation was somebody else's text. An actual later content edit does
    // not erase a previously captured, versioned first-person statement.
    if (
      source?.authoredExcerpt !== null &&
      source?.authoredExcerpt !== undefined &&
      (!row.data.contentHash || row.data.contentHash === source.contentHash) &&
      comparableText(source.excerpt).includes(comparableText(row.data.quote)) &&
      !comparableText(source.authoredExcerpt).includes(comparableText(quote))
    )
      return [];
    const kind = classifySignal(quote);
    return kind ? [{ ...row.data, kind, quote, terms: terms(quote) }] : [];
  });
  const currentNotes = clusterSignals(
    notes.map((r) => r.data),
    accepted,
    models[0]?.data ?? trainModel(undefined, []),
  );
  return {
    observations: observations
      .map((row) => row.data)
      .sort((a, b) => b.at.localeCompare(a.at)),
    notes: currentNotes.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)),
    signals: accepted,
    history: history
      .map((row) => ({
        ...row.data,
        currentAssessment:
          row.data.idea.engine !== "local"
            ? undefined
            : currentNotes.some(
                  (n) =>
                    n.id === row.data.idea.researchNoteId &&
                    n.status === "repeated",
                ) &&
                row.data.idea.evidence.every((e) =>
                  accepted.some(
                    (s) => s.storyId === e.storyId && s.quote === e.quote,
                  ),
                )
              ? ("supported" as const)
              : ("superseded" as const),
      }))
      .sort((a, b) => b.at.localeCompare(a.at)),
    reports: reports
      .map((row) => row.data)
      .sort((a, b) => b.date.localeCompare(a.date)),
    documentsTracked: Object.keys(models[0]?.data.documents ?? {}).length,
    updatedAt: models[0]?.data.updatedAt,
  };
}
export async function runLocalResearch(
  now = new Date(),
  guard: () => Promise<unknown> = async () => {},
) {
  const db = await getDb();
  const [stories, previous, modelRows] = await Promise.all([
    getStories(),
    getResearchData(),
    db.select().from(researchModels).where(eq(researchModels.id, "local-v1")),
  ]);
  const corpus = stories
    .filter(
      (story) => now.getTime() - Date.parse(story.detectedAt) < 30 * 86400000,
    )
    .slice(0, 2000);
  const model = trainModel(modelRows[0]?.data, corpus, now);
  const known = new Map(previous.signals.map((signal) => [signal.id, signal]));
  // The model's bounded working corpus must not limit evidence extraction.
  // This also recovers older statements when classification rules improve.
  const fresh = stories
    .flatMap((story) => extractSignals(story, now))
    .filter((signal) => !known.has(signal.id));
  for (const signal of fresh) known.set(signal.id, signal);
  const signals = [...known.values()];
  const notes = clusterSignals(previous.notes, signals, model, now);
  const ideas = proposeLocalOpportunities(notes, signals, now);
  const edition = editionFor(now);
  const observedIds = new Set(
    (previous.observations ?? []).map((item) => item.id),
  );
  await guard();
  await db.transaction(async (tx) => {
    for (const story of stories.filter(
      (story) => story.kind !== "comment" && story.kind !== "research",
    )) {
      const id = hash(`${story.id}:${story.contentHash}`);
      if (observedIds.has(id)) continue;
      const data = {
        id,
        storyId: story.id,
        title: story.originalTitle ?? story.title,
        excerpt: story.excerpt.slice(0, 600),
        sourceName: story.sourceName,
        url: story.url,
        category: story.category,
        keywords: keywords(
          terms(`${story.originalTitle ?? story.title} ${story.excerpt}`),
          model,
          8,
        ),
        at: story.detectedAt,
      };
      await tx
        .insert(researchObservations)
        .values({ id: data.id, data })
        .onConflictDoNothing();
    }
    await tx
      .insert(researchModels)
      .values({ id: "local-v1", data: model })
      .onConflictDoUpdate({ target: researchModels.id, set: { data: model } });
    for (const signal of fresh)
      await tx
        .insert(researchSignals)
        .values({ id: signal.id, data: signal })
        .onConflictDoNothing();
    for (const note of notes)
      await tx
        .insert(researchNotes)
        .values({ id: note.id, data: note })
        .onConflictDoUpdate({ target: researchNotes.id, set: { data: note } });
    for (const idea of ideas) {
      await recordOpportunity(tx, idea, now.toISOString());
    }
    const key = `${edition.key}:local:${hash(
      signals
        .map((signal) => signal.id)
        .sort()
        .join("|"),
    )}`;
    await tx
      .insert(opportunityBatches)
      .values({
        key,
        ideaIds: ideas.map((idea) => idea.id),
      })
      .onConflictDoNothing();
  });
  if (localHour(now) >= 20) {
    await guard();
    await saveDailyReport(edition.date, now);
  }
  // Recover every stored day with missing/provisional coverage after downtime.
  // Empty days have no captured evidence and must not be invented.
  const reportsByDate = new Map(
    previous.reports.map((report) => [report.date, report]),
  );
  const capturedDates = new Set([
    ...stories.map((story) => editionFor(new Date(story.detectedAt)).date),
    ...signals.map((signal) => editionFor(new Date(signal.detectedAt)).date),
    ...previous.reports
      .filter((report) => report.provisional)
      .map((report) => report.date),
  ]);
  for (const date of [...capturedDates].sort()) {
    const report = reportsByDate.get(date);
    if (date >= edition.date || (report && !report.provisional)) continue;
    await guard();
    await saveDailyReport(date, now);
  }
}
export async function saveDailyReport(
  date = editionFor().date,
  now = new Date(),
) {
  const db = await getDb();
  const old = (
    await db.select().from(dailyReports).where(eq(dailyReports.date, date))
  )[0]?.data;
  if (old && !old.provisional && date < editionFor(now).date) return old;
  const [stories, research, rows] = await Promise.all([
    getStories(),
    getResearchData(),
    db.select().from(opportunities),
  ]);
  const report = createDailyReport(
    date,
    stories,
    research.signals,
    research.notes,
    rows.map((row) => row.data),
    now,
  );
  if (old?.inputHash === report.inputHash) return old;
  await db
    .insert(dailyReports)
    .values({ date, data: report })
    .onConflictDoUpdate({ target: dailyReports.date, set: { data: report } });
  return report;
}
