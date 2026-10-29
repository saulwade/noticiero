import { eq, inArray, sql } from "drizzle-orm";
import { getDb, resultRows } from "./client";
import * as tables from "./schema";
import { aiConfig, analysisMode } from "@/features/analysis/config";
import { getResearchData } from "@/features/research/service";
import { usedBudget } from "@/features/analysis/budget";
import { allSourceDefinitions } from "@/features/sources/registry";
import { rankStories, groupStories } from "@/features/news/deduplicate";
import { isRelevantStory } from "@/features/news/relevance";
import type { DashboardData, Story, JobRun, SavedItem } from "@/lib/types";
import { getValidationData } from "@/features/validation/service";
import { getOperationsData } from "@/features/operations/service";

export async function getStories(): Promise<Story[]> {
  const db = await getDb();
  return (await db.select().from(tables.stories))
    .map((row) => row.data)
    .toSorted((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
export async function saveStory(story: Story) {
  const db = await getDb();
  await db
    .insert(tables.stories)
    .values({ id: story.id, url: story.url, data: story })
    .onConflictDoUpdate({ target: tables.stories.id, set: { data: story } });
}
export async function getJob(id: string): Promise<JobRun | undefined> {
  const db = await getDb();
  return (await db.select().from(tables.jobs).where(eq(tables.jobs.id, id)))[0]
    ?.data;
}
export async function saveJob(job: JobRun) {
  const db = await getDb();
  await db
    .insert(tables.jobs)
    .values({ id: job.id, data: job })
    .onConflictDoUpdate({ target: tables.jobs.id, set: { data: job } });
}
export async function getSourceSettings(): Promise<Record<string, boolean>> {
  const db = await getDb();
  return (
    (
      await db
        .select()
        .from(tables.settings)
        .where(eq(tables.settings.key, "sources"))
    )[0]?.data ?? {}
  );
}
export async function setSourceEnabled(id: string, enabled: boolean) {
  const db = await getDb();
  const previous = await getSourceSettings();
  const data = { ...previous, [id]: enabled };
  await db
    .insert(tables.settings)
    .values({ key: "sources", data })
    .onConflictDoUpdate({ target: tables.settings.key, set: { data } });
}
export async function savePreference(input: {
  action: "save" | "read" | "note";
  id: string;
  kind?: "story" | "idea" | "note";
  enabled?: boolean;
  note?: string;
  state?: SavedItem["state"];
}) {
  const db = await getDb();
  if (input.action === "read") {
    await db
      .insert(tables.readItems)
      .values({ id: input.id })
      .onConflictDoNothing();
    return;
  }
  if (input.action === "save" && !input.enabled) {
    await db
      .delete(tables.savedItems)
      .where(eq(tables.savedItems.id, input.id));
    return;
  }
  const old = (
    await db
      .select()
      .from(tables.savedItems)
      .where(eq(tables.savedItems.id, input.id))
  )[0]?.data;
  const kind = input.kind ?? old?.kind ?? "story";
  let snapshot = old?.snapshot;
  if (!snapshot && kind === "story") {
    const story = (
      await db
        .select()
        .from(tables.stories)
        .where(eq(tables.stories.id, input.id))
    )[0]?.data;
    if (story) snapshot = { kind: "story", story };
  } else if (!snapshot && kind === "idea") {
    const idea = (
      await db
        .select()
        .from(tables.opportunities)
        .where(eq(tables.opportunities.id, input.id))
    )[0]?.data;
    if (idea) snapshot = { kind: "idea", idea };
  }
  const data: SavedItem = {
    id: input.id,
    kind,
    note: input.note ?? old?.note ?? "",
    state: input.state ?? old?.state ?? "explore",
    createdAt: old?.createdAt ?? new Date().toISOString(),
    snapshot,
  };
  await db
    .insert(tables.savedItems)
    .values({ id: input.id, data })
    .onConflictDoUpdate({ target: tables.savedItems.id, set: { data } });
}
export async function getDashboardData(): Promise<DashboardData> {
  const db = await getDb();
  const [
    articles,
    stock,
    ideas,
    sources,
    jobs,
    editions,
    saved,
    read,
    spent,
    research,
    validation,
    operations,
  ] = await Promise.all([
    getStories(),
    db.select().from(tables.quotes),
    db.select().from(tables.opportunities),
    db.select().from(tables.sourceStates),
    db.select().from(tables.jobs),
    db.select().from(tables.editions),
    db.select().from(tables.savedItems),
    db.select().from(tables.readItems),
    usedBudget(),
    getResearchData(),
    getValidationData(),
    getOperationsData(),
  ]);
  // Upgrade old bookmarks from raw rows before editorial/evidence filters run.
  // Patch only the missing snapshot so concurrent annotation edits survive.
  const archived = await Promise.all(
    saved.map(async ({ id, data }) => {
      if (data.snapshot) return data;
      const story =
        data.kind === "story"
          ? articles.find((item) => item.id === id)
          : undefined;
      const idea =
        data.kind === "idea"
          ? ideas.find((item) => item.id === id)?.data
          : undefined;
      const snapshot: SavedItem["snapshot"] = story
        ? { kind: "story", story }
        : idea
          ? { kind: "idea", idea }
          : undefined;
      if (!snapshot) return data;
      const patched = resultRows(
        await db.execute(sql`
      UPDATE saved_items
      SET data = jsonb_set(data, '{snapshot}', ${JSON.stringify(snapshot)}::jsonb, true)
      WHERE id = ${id} AND (data->'snapshot' IS NULL OR data->'snapshot' = 'null'::jsonb)
      RETURNING data
    `),
      ) as { data: SavedItem }[];
      if (patched[0]) return patched[0].data;
      // Another request may have filled the snapshot or removed this bookmark.
      return (
        await db
          .select()
          .from(tables.savedItems)
          .where(eq(tables.savedItems.id, id))
      )[0]?.data;
    }),
  );
  const savedItems = archived.filter((item): item is SavedItem =>
    Boolean(item),
  );
  const latestJob = jobs
    .map((r) => r.data)
    .toSorted((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
  const cfg = aiConfig();
  return {
    stories: rankStories(
      groupStories(
        articles.filter(
          (story) =>
            story.kind !== "comment" &&
            story.kind !== "research" &&
            (saved.some((item) => item.id === story.id) ||
              story.kind === "question" ||
              story.kind === "launch" ||
              story.sourceId === "yc" ||
              isRelevantStory(
                story.originalTitle ?? story.title,
                story.excerpt,
                story.sourceId,
              )),
        ),
      ),
    ),
    quotes: stock.map((r) => r.data),
    opportunities: ideas
      .map((r) => r.data)
      .filter(
        (idea) =>
          idea.engine !== "local" ||
          (research.notes.some(
            (note) =>
              note.id === idea.researchNoteId && note.status === "repeated",
          ) &&
            idea.evidence.every((item) =>
              research.signals.some(
                (signal) =>
                  signal.storyId === item.storyId &&
                  signal.quote === item.quote,
              ),
            )),
      )
      .toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    sources: allSourceDefinitions.map(
      (source) =>
        sources.find((row) => row.id === source.id)?.data ?? {
          id: source.id,
          name: source.name,
          status: "pending",
          count: 0,
        },
    ),
    latestJob:
      latestJob?.status === "running" &&
      Date.now() - Date.parse(latestJob.startedAt) > 20 * 60000
        ? {
            ...latestJob,
            status: "failed",
            stage: "Interrumpida",
            message:
              "La actualización se interrumpió. Puedes volver a intentarlo.",
          }
        : latestJob,
    editions: editions
      .map((r) => r.data)
      .toSorted((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
      .slice(0, 30),
    saved: savedItems,
    readIds: read.map((r) => r.id),
    configuration: {
      ai: analysisMode() === "api" && cfg.configured,
      analysisMode: analysisMode(),
      background: process.env.NOTICIERO_BACKGROUND === "1",
      market: Boolean(process.env.ALPHA_VANTAGE_API_KEY),
      storage: process.env.DATABASE_URL ? "postgres" : "local",
      hosted: Boolean(process.env.VERCEL),
      monthlyBudget: cfg.monthlyBudget,
      spent,
      model: cfg.configured ? cfg.model : undefined,
    },
    research,
    validation,
    operations,
    demo: false,
  };
}
export async function storiesByIds(ids: string[]) {
  if (!ids.length) return [];
  const db = await getDb();
  return (
    await db
      .select()
      .from(tables.stories)
      .where(inArray(tables.stories.id, ids))
  ).map((r) => r.data);
}
