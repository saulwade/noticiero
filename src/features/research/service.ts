import { eq } from "drizzle-orm";
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

export async function getResearchData(): Promise<ResearchData> {
  const db = await getDb();
  const [models, notes, signals, reports, history, observations] =
    await Promise.all([
      db.select().from(researchModels).where(eq(researchModels.id, "local-v1")),
      db.select().from(researchNotes),
      db.select().from(researchSignals),
      db.select().from(dailyReports),
      db.select().from(opportunityEvents),
      db.select().from(researchObservations),
    ]);
  // Revalidate cached evidence when the explicit classifier improves; retain raw rows for audit.
  const accepted = signals.flatMap((row) => {
    const kind = classifySignal(row.data.quote);
    return kind ? [{ ...row.data, kind }] : [];
  });
  const acceptedIds = new Set(accepted.map((signal) => signal.id));
  const currentNotes = notes
    .map((row) => {
      const note = row.data;
      const members = accepted.filter((signal) =>
        note.signalIds.includes(signal.id),
      );
      const voices = new Set(
        members
          .filter((signal) => signal.author)
          .map((signal) => signal.independenceKey),
      ).size;
      return {
        ...note,
        signalIds: note.signalIds.filter((id) => acceptedIds.has(id)),
        independentVoices: voices,
        status: voices >= 2 ? ("repeated" as const) : ("isolated" as const),
        journal: note.journal
          .map((entry) => ({
            ...entry,
            added: members.filter(
              (signal) =>
                editionFor(new Date(signal.detectedAt)).date === entry.date,
            ).length,
            totalVoices: new Set(
              members
                .filter(
                  (signal) =>
                    signal.author &&
                    editionFor(new Date(signal.detectedAt)).date <= entry.date,
                )
                .map((signal) => signal.independenceKey),
            ).size,
          }))
          .filter((entry) => entry.added > 0),
      };
    })
    .filter((note) => note.signalIds.length > 0);
  return {
    observations: observations
      .map((row) => row.data)
      .sort((a, b) => b.at.localeCompare(a.at)),
    notes: currentNotes.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)),
    signals: accepted,
    history: history
      .map((row) => row.data)
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
  const fresh = corpus
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
  // Recover the previous night's report after a suspended/offline Mac resumes.
  const yesterday = editionFor(new Date(now.getTime() - 86400000)).date;
  const previousReport = previous.reports.find(
    (report) => report.date === yesterday,
  );
  if (
    (!previousReport || previousReport.provisional) &&
    (previousReport ||
      stories.some(
        (story) => editionFor(new Date(story.detectedAt)).date === yesterday,
      ))
  ) {
    await guard();
    await saveDailyReport(yesterday, now);
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
