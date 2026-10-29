import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import {
  beginUpdate,
  collectNews,
  finishUpdate,
  analyzeIdeas,
} from "@/features/jobs/update";
import {
  getJob,
  getStories,
  savePreference,
  getDashboardData,
  saveStory,
} from "@/db/repository";
import { generateOpportunities } from "@/features/opportunities/generate";
import { reserveBudget, usedBudget } from "@/features/analysis/budget";
import { editionFor } from "@/lib/time";
import { makeStory } from "@/features/news/normalize";
import { sql } from "drizzle-orm";
vi.mock("@/features/sources/hacker-news", () => ({
  loadHackerNews: vi.fn(async () => [
    makeStory({
      title: "Microsoft announces a developer tool",
      url: "https://example.com/news",
      sourceId: "hn",
      sourceName: "Hacker News",
    })!,
  ]),
}));
vi.mock("@/features/sources/rss", () => ({
  loadFeed: vi.fn(async () => {
    throw new Error("Source unavailable");
  }),
}));
vi.mock("@/features/sources/community", () => ({
  loadCommunity: vi.fn(async () => {
    throw new Error("Source unavailable");
  }),
}));
vi.mock("@/features/sources/yc", () => ({
  loadRequestsForStartups: vi.fn(async () => {
    throw new Error("Source unavailable");
  }),
}));
vi.mock("@/features/opportunities/generate", () => ({
  generateOpportunities: vi.fn(async () => []),
}));
afterEach(() => vi.unstubAllEnvs());

beforeEach(async () => {
  vi.clearAllMocks();
  const db = await getDb();
  for (const table of [
    schema.stories,
    schema.jobs,
    schema.leases,
    schema.editions,
    schema.savedItems,
    schema.readItems,
    schema.sourceStates,
    schema.settings,
    schema.usage,
    schema.opportunityBatches,
    schema.researchModels,
    schema.researchNotes,
    schema.researchSignals,
    schema.dailyReports,
    schema.opportunities,
  ])
    await db.delete(table);
});
describe("ediciones y persistencia", () => {
  it("usa la fecha de CDMX para una edición PM disparada al día siguiente en UTC", () => {
    expect(editionFor(new Date("2026-10-29T02:00:00Z"))).toEqual({
      key: "2026-10-28-PM",
      date: "2026-10-28",
      slot: "PM",
    });
  });
  it("evita iniciar dos trabajos solapados", async () => {
    const first = await beginUpdate();
    const second = await beginUpdate();
    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(second.job.id).toBe(first.job.id);
  });
  it("no permite que un trabajo viejo publique después de perder su lease", async () => {
    const first = await beginUpdate();
    const db = await getDb();
    await db.execute(
      sql`UPDATE leases SET expires_at = NOW() - INTERVAL '1 minute' WHERE token = ${first.job.id}`,
    );
    const second = await beginUpdate();
    expect(second.reused).toBe(false);
    await expect(finishUpdate(first.job.id)).rejects.toThrow("bloqueo");
    expect((await getDashboardData()).editions).toHaveLength(0);
  });
  it("continúa con la fuente sana y no duplica noticias al reejecutar", async () => {
    const { job } = await beginUpdate();
    await collectNews(job.id);
    await collectNews(job.id);
    await finishUpdate(job.id);
    expect(await getStories()).toHaveLength(1);
    expect((await getJob(job.id))?.status).toBe("partial");
    const data = await getDashboardData();
    expect(data.editions).toHaveLength(1);
    expect(data.sources.filter((s) => s.status === "ok")).toHaveLength(1);
    const second = await beginUpdate();
    await collectNews(second.job.id);
    await finishUpdate(second.job.id);
    expect(await getStories()).toHaveLength(1);
    expect((await getDashboardData()).editions).toHaveLength(1);
  });
  it("guarda historias, lectura y notas de ideas en PostgreSQL", async () => {
    await savePreference({
      action: "save",
      id: "story-one",
      kind: "story",
      enabled: true,
    });
    await savePreference({ action: "read", id: "story-one" });
    await savePreference({
      action: "note",
      id: "idea-one",
      kind: "idea",
      note: "Entrevistar a dos clientes",
      state: "validating",
    });
    const data = await getDashboardData();
    expect(data.readIds).toContain("story-one");
    expect(data.saved.find((s) => s.id === "idea-one")?.note).toBe(
      "Entrevistar a dos clientes",
    );
    await savePreference({ action: "save", id: "story-one", enabled: false });
    expect(
      (await getDashboardData()).saved.some((s) => s.id === "story-one"),
    ).toBe(false);
  });
  it("reserva presupuesto atómicamente ante llamadas simultáneas", async () => {
    const results = await Promise.all([
      reserveBudget(0.4, 1),
      reserveBudget(0.4, 1),
      reserveBudget(0.4, 1),
    ]);
    expect(results.filter(Boolean)).toHaveLength(2);
    expect(await usedBudget()).toBeCloseTo(0.8);
  });
  it("reutiliza un resultado válido sin ideas para no volver a pagar por él", async () => {
    vi.stubEnv("ANALYSIS_MODE", "api");
    vi.stubEnv("LLM_BASE_URL", "http://localhost:11434/v1");
    vi.stubEnv("LLM_MODEL", "test");
    vi.stubEnv("AI_INPUT_USD_PER_MILLION", "0");
    vi.stubEnv("AI_OUTPUT_USD_PER_MILLION", "0");
    const { job } = await beginUpdate();
    await collectNews(job.id);
    const story = (await getStories())[0];
    await saveStory({
      ...story,
      analysis: "ready",
      summary: "Resumen de prueba identificado, sin demanda comprobada.",
    });
    await analyzeIdeas(job.id);
    await analyzeIdeas(job.id);
    expect(generateOpportunities).toHaveBeenCalledTimes(1);
  });
  it("no genera un segundo lote de ideas para la misma edición aunque cambie su contenido", async () => {
    vi.stubEnv("ANALYSIS_MODE", "api");
    vi.stubEnv("LLM_BASE_URL", "http://localhost:11434/v1");
    vi.stubEnv("LLM_MODEL", "test");
    vi.stubEnv("AI_INPUT_USD_PER_MILLION", "0");
    vi.stubEnv("AI_OUTPUT_USD_PER_MILLION", "0");
    const { job } = await beginUpdate();
    await collectNews(job.id);
    const story = (await getStories())[0];
    await saveStory({
      ...story,
      analysis: "ready",
      summary: "Nueva evidencia de prueba.",
    });
    const db = await getDb();
    await db.insert(schema.opportunityBatches).values({
      key: `${job.editionKey}:older-content-hash`,
      ideaIds: ["one", "two", "three"],
    });
    await analyzeIdeas(job.id);
    expect(generateOpportunities).not.toHaveBeenCalled();
  });
});
