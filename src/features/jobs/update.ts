import { randomUUID } from "node:crypto";
import { sql, eq, like } from "drizzle-orm";
import { getDb, resultRows } from "@/db/client";
import {
  leases,
  sourceStates,
  opportunities,
  editions,
  opportunityBatches,
} from "@/db/schema";
import {
  getJob,
  saveJob,
  getStories,
  saveStory,
  getSourceSettings,
  storiesByIds,
} from "@/db/repository";
import { feeds, allSourceDefinitions } from "@/features/sources/registry";
import { loadHackerNews } from "@/features/sources/hacker-news";
import { loadFeed } from "@/features/sources/rss";
import { rankStories, groupStories } from "@/features/news/deduplicate";
import { summarize, ANALYSIS_VERSION } from "@/features/analysis/summarize";
import { aiConfig, analysisMode } from "@/features/analysis/config";
import { loadCommunity } from "@/features/sources/community";
import { loadRequestsForStartups } from "@/features/sources/yc";
import { runLocalResearch } from "@/features/research/service";
import { refreshEvidence } from "@/features/evidence/service";
import { generateOpportunities } from "@/features/opportunities/generate";
import { updateQuote } from "@/features/market/alpha-vantage";
import { getCompany } from "@/features/market/company-catalog";
import { mapConcurrent } from "@/lib/http";
import { hash } from "@/features/news/normalize";
import { isRelevantStory } from "@/features/news/relevance";
import { reconcileOperations } from "@/features/operations/service";
import { editionFor } from "@/lib/time";
import type { JobRun, SourceState, Story } from "@/lib/types";

export async function beginUpdate(): Promise<{ job: JobRun; reused: boolean }> {
  const db = await getDb();
  const id = randomUUID();
  const result = await db.execute(
    sql`INSERT INTO leases(name, token, expires_at) VALUES ('update', ${id}, NOW() + INTERVAL '20 minutes') ON CONFLICT(name) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at WHERE leases.expires_at < NOW() RETURNING token`,
  );
  if (!resultRows(result).length) {
    const lease = (
      await db.select().from(leases).where(eq(leases.name, "update"))
    )[0];
    const job = lease && (await getJob(lease.token));
    if (job) return { job, reused: true };
    throw new Error(
      "Hay una actualización iniciándose. Intenta en unos segundos.",
    );
  }
  const job: JobRun = {
    id,
    editionKey: editionFor().key,
    status: "running",
    stage: "Consultando fuentes",
    startedAt: new Date().toISOString(),
    sourceStates: [],
    storiesAdded: 0,
  };
  await saveJob(job);
  return { job, reused: false };
}
async function activeJob(id: string) {
  const job = await getJob(id);
  if (!job || job.status !== "running")
    throw new Error("La actualización ya no está activa.");
  const db = await getDb();
  const renewed = await db.execute(
    sql`UPDATE leases SET expires_at = NOW() + INTERVAL '20 minutes' WHERE name = 'update' AND token = ${id} AND expires_at > NOW() RETURNING token`,
  );
  if (!resultRows(renewed).length)
    throw new Error(
      "La actualización perdió su bloqueo. Inicia un nuevo intento.",
    );
  return job;
}
export async function collectNews(id: string): Promise<void> {
  const job = await activeJob(id);
  if (job.storyIds) return;
  const settings = await getSourceSettings();
  const previous = new Map(
    (await getStories()).map((story) => [story.id, story]),
  );
  const results = await Promise.all(
    allSourceDefinitions
      .filter((source) => settings[source.id] !== false)
      .map(async (source) => {
        try {
          const fetched =
            source.id === "hn"
              ? await loadHackerNews()
              : source.id === "ask-hn"
                ? await loadCommunity("ask")
                : source.id === "show-hn"
                  ? await loadCommunity("show")
                  : source.id === "yc-rfs"
                    ? await loadRequestsForStartups()
                    : await loadFeed(
                        feeds.find((feed) => feed.id === source.id)!,
                      );
          const stories = fetched.filter(
            (story) =>
              ["ask-hn", "show-hn", "yc-rfs", "yc"].includes(story.sourceId) ||
              isRelevantStory(
                story.originalTitle ?? story.title,
                story.excerpt,
                story.sourceId,
              ),
          );
          const state: SourceState = {
            id: source.id,
            name: source.name,
            status: "ok",
            count: stories.length,
            checkedAt: new Date().toISOString(),
          };
          return { stories, state };
        } catch {
          const state: SourceState = {
            id: source.id,
            name: source.name,
            status: "error",
            count: 0,
            checkedAt: new Date().toISOString(),
            message:
              "No pudimos consultar esta fuente. Se conserva la edición anterior.",
          };
          return { stories: [] as Story[], state };
        }
      }),
  );
  const db = await getDb();
  let added = 0;
  const incoming = new Map<string, Story>();
  for (const result of results) {
    await db
      .insert(sourceStates)
      .values({ id: result.state.id, data: result.state })
      .onConflictDoUpdate({
        target: sourceStates.id,
        set: { data: result.state },
      });
    for (const story of result.stories) {
      const old = previous.get(story.id);
      if (!old && !incoming.has(story.id)) added++;
      // Preserve an existing Spanish analysis only while the original content is unchanged.
      const data =
        old?.contentHash === story.contentHash
          ? {
              ...story,
              detectedAt: old.detectedAt,
              title: old.title,
              summary: old.summary,
              why: old.why,
              analysis: old.analysis,
              analysisHash: old.analysisHash,
            }
          : story;
      incoming.set(story.id, data);
    }
  }
  for (const story of incoming.values()) await saveStory(story);
  const ranked = rankStories(
    groupStories(
      [...incoming.values()].filter(
        (story) => story.kind !== "comment" && story.kind !== "research",
      ),
    ),
  );
  await saveJob({
    ...job,
    sourceStates: results.map((result) => result.state),
    storiesAdded: added,
    storyIds: ranked.slice(0, 25).map((s) => s.id),
    stage: "Preparando tu edición",
  });
}
export async function analyzeNews(
  id: string,
  onlyIds?: string[],
): Promise<void> {
  const job = await activeJob(id);
  if (analysisMode() !== "api" || !aiConfig().configured) return;
  const stories = await storiesByIds(onlyIds ?? job.storyIds ?? []);
  let failures = 0;
  await mapConcurrent(
    stories.filter(
      (story) =>
        story.coverage !== "headline" &&
        story.analysisHash !== `${ANALYSIS_VERSION}:${story.contentHash}`,
    ),
    2,
    async (story) => {
      try {
        const result = await summarize(story);
        await activeJob(id);
        await saveStory(result);
      } catch {
        failures++;
      }
    },
  );
  if (failures)
    await saveJob({
      ...job,
      message: `${failures} análisis pendientes; las noticias originales siguen disponibles.`,
    });
}
export async function analyzeIdeas(id: string): Promise<void> {
  const job = await activeJob(id);
  if (analysisMode() === "local") {
    await runLocalResearch(new Date(job.startedAt), () => activeJob(id));
    await refreshEvidence(await getStories(), new Date(job.startedAt), () =>
      activeJob(id),
    );
    return;
  }
  if (!aiConfig().configured) return;
  const db = await getDb();
  const stories = await storiesByIds(job.storyIds ?? []);
  const eligible = stories.filter((story) => story.analysis === "ready");
  if (!eligible.length) return;
  const key = `${job.editionKey}:${hash(
    eligible
      .map((story) => `${story.id}:${story.analysisHash ?? story.summary}`)
      .sort()
      .join("|"),
  )}`;
  const batches = await db
    .select()
    .from(opportunityBatches)
    .where(like(opportunityBatches.key, `${job.editionKey}:%`));
  // Cache empty outcomes by input hash, and publish at most one nonempty batch per edition.
  if (batches.some((batch) => batch.key === key || batch.ideaIds.length > 0))
    return;
  try {
    const ideas = await generateOpportunities(stories);
    await activeJob(id);
    await db.transaction(async (tx) => {
      for (const idea of ideas)
        await tx
          .insert(opportunities)
          .values({ id: idea.id, data: idea })
          .onConflictDoUpdate({
            target: opportunities.id,
            set: { data: idea },
          });
      await tx
        .insert(opportunityBatches)
        .values({ key, ideaIds: ideas.map((idea) => idea.id) })
        .onConflictDoNothing();
    });
  } catch {
    await saveJob({
      ...job,
      message: [job.message, "La generación de ideas quedó pendiente."]
        .filter(Boolean)
        .join(" "),
    });
  }
}
export async function collectMarket(id: string): Promise<void> {
  const job = await activeJob(id);
  await saveJob({ ...job, stage: "Relacionando empresas" });
  const stories = await storiesByIds(job.storyIds ?? []);
  const symbols = [...new Set(stories.flatMap((story) => story.companies))]
    .filter((symbol) => !getCompany(symbol)?.private)
    .slice(0, 10);
  let failures = 0;
  for (const symbol of symbols) {
    try {
      await updateQuote(symbol);
    } catch {
      failures++;
    }
  }
  if (failures)
    await saveJob({
      ...job,
      stage: "Relacionando empresas",
      message: [job.message, `${failures} cotizaciones no disponibles.`]
        .filter(Boolean)
        .join(" "),
    });
}
export async function finishUpdate(id: string): Promise<void> {
  const job = await activeJob(id);
  const db = await getDb();
  const ok = job.sourceStates.some((source) => source.status === "ok");
  const partial =
    job.sourceStates.some((source) => source.status === "error") ||
    Boolean(job.message);
  const finishedAt = new Date().toISOString();
  if (ok) {
    const when = editionFor(new Date(job.startedAt));
    const data = {
      ...when,
      storyIds: job.storyIds ?? [],
      publishedAt: finishedAt,
      partial,
    };
    await db
      .insert(editions)
      .values({ key: when.key, data })
      .onConflictDoUpdate({ target: editions.key, set: { data } });
  }
  await saveJob({
    ...job,
    status: ok ? (partial ? "partial" : "completed") : "failed",
    stage: ok ? "Tu edición está lista" : "No se pudo actualizar",
    finishedAt,
    message: !ok
      ? "No se pudo consultar ninguna fuente activa. Revisa tu conexión o activa una fuente."
      : job.message,
  });
  await db.delete(leases).where(eq(leases.token, id));
  await reconcileOperations();
}
export async function failUpdate(id: string): Promise<void> {
  const job = await getJob(id);
  if (job?.status === "running")
    await saveJob({
      ...job,
      status: "failed",
      stage: "Actualización interrumpida",
      finishedAt: new Date().toISOString(),
      message: "Puedes reintentar; se conservaron las noticias descargadas.",
    });
  const db = await getDb();
  await db.delete(leases).where(eq(leases.token, id));
  await reconcileOperations();
}
export async function runLocalUpdate(id: string) {
  try {
    await collectNews(id);
    await analyzeNews(id);
    await analyzeIdeas(id);
    await collectMarket(id);
    await finishUpdate(id);
  } catch {
    await failUpdate(id);
  }
}
