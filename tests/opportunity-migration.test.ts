import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getResearchData, runLocalResearch } from "@/features/research/service";
import { recordOpportunity } from "@/features/research/archive";
import { demoData } from "@/lib/demo-data";
import { makeStory } from "@/features/news/normalize";
import { saveStory } from "@/db/repository";
import type { ResearchSignal, ResearchNote } from "@/lib/types";
const now = new Date("2026-11-01T16:00:00Z");
const signal = (id: string, quote: string): ResearchSignal => ({
  id,
  storyId: id,
  quote,
  kind: "pain",
  sourceName: "Ask HN",
  url: `https://news.ycombinator.com/item?id=${id}`,
  title: "Community",
  author: id,
  independenceKey: `hn:${id}`,
  terms: [],
  occurredAt: now.toISOString(),
  detectedAt: now.toISOString(),
});
const note = (ids: string[]): ResearchNote => ({
  id: "legacy-mixed",
  label: "Old broad topic",
  keywords: ["code"],
  firstSeen: now.toISOString(),
  lastSeen: now.toISOString(),
  signalIds: ids,
  independentVoices: 2,
  status: "repeated",
  journal: [{ date: "2026-11-01", added: 2, totalVoices: 2 }],
});
beforeEach(async () => {
  const db = await getDb();
  for (const table of [
    schema.stories,
    schema.researchModels,
    schema.researchSignals,
    schema.researchNotes,
    schema.researchObservations,
    schema.opportunities,
    schema.opportunityEvents,
    schema.opportunityBatches,
    schema.dailyReports,
    schema.savedItems,
  ])
    await db.delete(table);
});
describe("reclasificación sin borrar el archivo", () => {
  it("un salto de párrafo no convierte una experiencia propia en cita ajena", async () => {
    const db = await getDb();
    const quote = "I need a tool for: exporting invoices from our app.";
    await db
      .insert(schema.researchSignals)
      .values({ id: "a", data: signal("a", quote) });
    await saveStory({
      ...makeStory({
        title: "Community",
        excerpt: "I need a tool for:<p>exporting invoices from our app.",
        url: "https://news.ycombinator.com/item?id=a",
        sourceId: "ask-hn",
        sourceName: "Ask HN",
        publishedAt: now.toISOString(),
      })!,
      id: "a",
      kind: "comment",
      author: "a",
      authoredExcerpt: "I need a tool for:\nexporting invoices from our app.",
    });
    expect((await getResearchData()).signals.map((s) => s.id)).toEqual(["a"]);
  });
  it("revalida una cita antigua aplanada cuando la fuente conserva atribución nueva", async () => {
    const db = await getDb();
    const quote = "I cannot export invoices from our accounting app.";
    const signals = [signal("a", quote), signal("b", quote)];
    await db
      .insert(schema.researchSignals)
      .values(signals.map((data) => ({ id: data.id, data })));
    await saveStory({
      ...makeStory({
        title: "Community",
        excerpt: `> ${quote} I agree.`,
        url: "https://news.ycombinator.com/item?id=b",
        sourceId: "ask-hn",
        sourceName: "Ask HN",
        publishedAt: now.toISOString(),
      })!,
      id: "b",
      kind: "comment",
      author: "b",
      authoredExcerpt: "I agree.",
    });
    const data = await getResearchData();
    expect(data.signals.map((s) => s.id)).toEqual(["a"]);
    expect(data.notes[0].independentVoices).toBe(1);
    expect(await db.select().from(schema.researchSignals)).toHaveLength(2);
  });
  it("una edición posterior no borra una experiencia propia capturada con otra versión", async () => {
    const db = await getDb();
    const quote = "I cannot export invoices from our accounting app.";
    const original = { ...signal("a", quote), contentHash: "original-version" };
    await db
      .insert(schema.researchSignals)
      .values({ id: original.id, data: original });
    await saveStory({
      ...makeStory({
        title: "Community",
        excerpt: `She wrote: "${quote}" I agree.`,
        url: "https://news.ycombinator.com/item?id=a",
        sourceId: "ask-hn",
        sourceName: "Ask HN",
        publishedAt: now.toISOString(),
      })!,
      id: "a",
      kind: "comment",
      author: "a",
      authoredExcerpt: "I agree.",
      contentHash: "edited-version",
    });
    expect((await getResearchData()).signals.map((s) => s.id)).toEqual(["a"]);
  });
  it("retira la hipótesis falsa de la vista actual y conserva todas sus filas originales", async () => {
    const db = await getDb();
    const signals = [
      signal(
        "a",
        "I loved coding in the past, but no matter what I do at this point, I can’t find a reason to anymore that’s actually necessary",
      ),
      signal(
        "b",
        "> I can’t find a reason to anymore that’s actually necessary The huge environmental and societal cost of LLMs, maybe?",
      ),
    ];
    await db
      .insert(schema.researchSignals)
      .values(signals.map((data) => ({ id: data.id, data })));
    const old = note(signals.map((s) => s.id));
    await db.insert(schema.researchNotes).values({ id: old.id, data: old });
    const idea = {
      ...demoData().opportunities[0],
      id: "legacy-false",
      engine: "local" as const,
      researchNoteId: old.id,
      evidence: signals.map((s) => ({
        storyId: s.storyId,
        quote: s.quote,
        url: s.url,
        reason: "old classifier",
      })),
    };
    await db.transaction((tx) =>
      recordOpportunity(tx, idea, now.toISOString()),
    );
    const rawBefore = await db.select().from(schema.researchSignals);
    await runLocalResearch(now);
    const data = await getResearchData();
    expect(data.signals).toEqual([]);
    expect(data.notes).toEqual([]);
    expect(data.history?.[0].currentAssessment).toBe("superseded");
    expect(await db.select().from(schema.researchSignals)).toEqual(rawBefore);
    expect((await db.select().from(schema.researchNotes))[0].data).toEqual(old);
    expect(await db.select().from(schema.opportunities)).toHaveLength(1);
    expect(await db.select().from(schema.opportunityEvents)).toHaveLength(1);
    await runLocalResearch(now);
    expect((await getResearchData()).history).toEqual(data.history);
  });
  it("desdobla un cuaderno mezclado y mantiene identidades estables al persistir otra vez", async () => {
    const db = await getDb();
    const signals = [
      signal("photos", "I cannot export photos from our app."),
      signal("invoice", "I cannot export invoices from our app."),
    ];
    await db
      .insert(schema.researchSignals)
      .values(signals.map((data) => ({ id: data.id, data })));
    const old = note(signals.map((s) => s.id));
    await db.insert(schema.researchNotes).values({ id: old.id, data: old });
    await runLocalResearch(now);
    const first = await getResearchData();
    expect(first.notes).toHaveLength(2);
    expect(first.notes.every((n) => n.independentVoices === 1)).toBe(true);
    await runLocalResearch(now);
    expect((await getResearchData()).notes).toEqual(first.notes);
    expect(
      (await db.select().from(schema.researchNotes)).some(
        (r) => r.id === old.id,
      ),
    ).toBe(true);
  });
});
