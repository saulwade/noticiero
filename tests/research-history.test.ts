import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { recordOpportunity } from "@/features/research/archive";
import { getResearchData } from "@/features/research/service";
import { findCompanies } from "@/features/market/company-catalog";
import { runLocalResearch } from "@/features/research/service";
import { saveStory } from "@/db/repository";
import { demoData } from "@/lib/demo-data";
import { isRelevantStory } from "@/features/news/relevance";
import { classify } from "@/features/news/normalize";
import { makeStory } from "@/features/news/normalize";
beforeEach(async () => {
  const db = await getDb();
  for (const table of [
    schema.opportunities,
    schema.opportunityEvents,
    schema.researchObservations,
  ])
    await db.delete(table);
});
describe("archivo automático de oportunidades", () => {
  it("conserva palabras clave de noticias sin necesitar una oportunidad ni un favorito", async () => {
    const db = await getDb();
    await db.delete(schema.stories);
    const now = new Date("2026-10-29T15:00:00Z");
    const story = makeStory({
      title: "Banks change lending standards",
      excerpt:
        "Financial institutions update credit processes for small business borrowers.",
      url: "https://example.com/financial-context",
      sourceId: "banking-dive",
      sourceName: "Banking Dive",
      publishedAt: now.toISOString(),
    })!;
    await saveStory({ ...story, detectedAt: now.toISOString() });
    await saveStory({
      ...story,
      id: "older-context",
      url: "https://example.com/older-context",
      title: "Historical banking context",
      originalTitle: "Historical banking context",
      detectedAt: "2026-08-01T13:00:00Z",
    });
    await runLocalResearch(now);
    await runLocalResearch(now);
    await db.delete(schema.stories);
    await db.delete(schema.researchModels);
    const research = await getResearchData();
    expect(research.observations).toHaveLength(2);
    expect(research.observations?.[0].keywords.length).toBeGreaterThan(0);
    expect(research.observations?.[0].title).toBe(story.title);
  });
  it("incorpora nuevas oportunidades en una segunda actualización de la misma edición sin favoritos", async () => {
    const db = await getDb();
    for (const table of [
      schema.stories,
      schema.researchNotes,
      schema.researchSignals,
      schema.researchModels,
      schema.dailyReports,
      schema.opportunityBatches,
    ])
      await db.delete(table);
    const now = new Date("2026-10-29T15:00:00Z");
    async function add(id: string, text: string) {
      const story = makeStory({
        title: "Community comment",
        excerpt: text,
        url: `https://news.ycombinator.com/item?id=${id}`,
        sourceId: "ask-hn",
        sourceName: "Ask HN",
        publishedAt: now.toISOString(),
      })!;
      await saveStory({
        ...story,
        kind: "comment",
        author: id,
        detectedAt: now.toISOString(),
      });
    }
    await add(
      "history-a",
      "I need a tool for invoice reconciliation because manually matching invoices takes hours.",
    );
    await add(
      "history-b",
      "We need a tool for invoice reconciliation because manually matching invoices takes days.",
    );
    await runLocalResearch(now);
    expect(await db.select().from(schema.opportunities)).toHaveLength(1);
    await add(
      "history-c",
      "I need an inventory app to track warehouse stock and shipping quantities.",
    );
    await add(
      "history-d",
      "We need an inventory app to track warehouse stock and shipping quantities.",
    );
    await runLocalResearch(new Date(now.getTime() + 60000));
    expect(await db.select().from(schema.opportunities)).toHaveLength(2);
    expect(
      (await getResearchData()).history?.filter(
        (event) => event.kind === "discovered",
      ),
    ).toHaveLength(2);
  });
  it("guarda sin favoritos, evita repetir y conserva evidencia después de cambiar la hipótesis", async () => {
    const db = await getDb();
    const idea = { ...demoData().opportunities[0], id: "history-idea" };
    await db.transaction((tx) =>
      recordOpportunity(tx, idea, "2026-10-29T13:00:00Z"),
    );
    await db.transaction((tx) =>
      recordOpportunity(
        tx,
        { ...idea, createdAt: "2026-10-29T20:00:00Z" },
        "2026-10-29T20:00:00Z",
      ),
    );
    expect((await getResearchData()).history).toHaveLength(1);
    await db.transaction((tx) =>
      recordOpportunity(
        tx,
        { ...idea, proposal: "Nueva propuesta basada en evidencia" },
        "2026-10-30T13:00:00Z",
      ),
    );
    await db.delete(schema.opportunities);
    const history = (await getResearchData()).history!;
    expect(history).toHaveLength(2);
    expect(
      history.find((event) => event.kind === "discovered")?.idea.proposal,
    ).toBe(idea.proposal);
    expect(history[0].kind).toBe("updated");
  });
  it("captura la versión de una oportunidad anterior al despliegue del archivo", async () => {
    const db = await getDb();
    const idea = { ...demoData().opportunities[0], id: "legacy-history" };
    await db.insert(schema.opportunities).values({ id: idea.id, data: idea });
    await db.transaction((tx) =>
      recordOpportunity(tx, idea, "2026-10-29T13:00:00Z"),
    );
    expect((await getResearchData()).history?.[0].kind).toBe("discovered");
  });
});
it("incluye finanzas y operaciones sin convertir promociones en noticias", () => {
  expect(
    findCompanies(
      "JPMorgan and Bank of America join Mastercard and Visa payment networks",
    ),
  ).toEqual(expect.arrayContaining(["JPM", "BAC", "MA", "V"]));
  expect(findCompanies("I renewed my travel visa")).not.toContain("V");
  expect(classify("Banks expand payment and lending services")).toBe(
    "Finanzas",
  );
  expect(classify("Inventory and bookkeeping for small business")).toBe(
    "Operaciones",
  );
  expect(
    isRelevantStory("Banks change lending standards", "", "banking-dive"),
  ).toBe(true);
  expect(isRelevantStory("Small business payroll and inventory")).toBe(true);
  expect(isRelevantStory("Best coupon codes for credit cards")).toBe(false);
});
