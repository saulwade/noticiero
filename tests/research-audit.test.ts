import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { saveStory } from "@/db/repository";
import { makeStory } from "@/features/news/normalize";
import { classifySignal, extractSignals } from "@/features/research/signals";
import { clusterSignals } from "@/features/research/cluster";
import { proposeLocalOpportunities } from "@/features/research/opportunities";
import { trainModel } from "@/features/research/vector";
import {
  getResearchData,
  runLocalResearch,
  saveDailyReport,
} from "@/features/research/service";
import type { Story } from "@/lib/types";

const start = new Date("2026-10-28T15:00:00Z");
function statement(
  id: string,
  excerpt: string,
  author = id,
  at = start,
): Story {
  return {
    ...makeStory({
      title: "Community discussion",
      excerpt,
      url: `https://news.ycombinator.com/item?id=${id}`,
      sourceId: "ask-hn",
      sourceName: "Ask HN",
      publishedAt: at.toISOString(),
    })!,
    id,
    kind: "comment",
    author,
    detectedAt: at.toISOString(),
  };
}

describe("auditoría del aprendizaje acumulativo", () => {
  beforeEach(async () => {
    const db = await getDb();
    for (const table of [
      schema.stories,
      schema.researchModels,
      schema.researchSignals,
      schema.researchNotes,
      schema.dailyReports,
      schema.opportunities,
      schema.opportunityEvents,
      schema.researchObservations,
      schema.opportunityBatches,
      schema.savedItems,
    ])
      await db.delete(table);
  });

  it("rechaza consejos y ofrecimientos sin confundir applying con app", () => {
    for (const text of [
      "If you notice, I am applying this philosophy because I struggle to be a better person.",
      "This also applies to my chores because I struggle to keep my room clean.",
      "I manually counted my clothes twice because my room is messy.",
      "If there's a specific file or page you were looking for let me know; maybe I have a saved copy :)",
      "I recommend spreadsheets for invoice reconciliation matching records every week.",
    ])
      expect(classifySignal(text)).toBeUndefined();
    expect(
      classifySignal("I can't export invoices from our app anymore."),
    ).toBe("pain");
    expect(
      classifySignal(
        "Can anyone recommend an application for invoice reconciliation?",
      ),
    ).toBe("request");
  });

  it("detecta agotamiento de cuota descrito por quien lo sufrió", () => {
    expect(
      classifySignal(
        "I burned through 80% of my token usage quota in ten minutes.",
      ),
    ).toBe("pain");
    expect(
      classifySignal("Our AI agents exhausted our weekly budget in minutes."),
    ).toBe("pain");
    expect(
      classifySignal("Our AI agents have a weekly budget report."),
    ).toBeUndefined();
  });

  it("una cita larga conserva la frase que justifica clasificarla", async () => {
    const text = `My invoice workflow involves ${"matching records across systems ".repeat(24)}and is too expensive.`;
    expect(classifySignal(text)).toBe("pain");
    const item = statement("long-evidence", text);
    const signals = extractSignals(item, start);
    expect(signals).toHaveLength(1);
    expect(classifySignal(signals[0].quote)).toBe("pain");
    await saveStory(item);
    await runLocalResearch(start);
    expect((await getResearchData()).signals).toHaveLength(1);
    await runLocalResearch(start);
    expect((await getResearchData()).signals).toHaveLength(1);
  });

  it("una solución manual posterior no borra la necesidad ya expresada por el mismo autor", () => {
    const docs = [
      statement(
        "alice-request",
        "I need a tool for invoice reconciliation matching records in spreadsheets every week.",
        "alice",
      ),
      statement(
        "bob-manual",
        "We manually do invoice reconciliation matching records in spreadsheets every week.",
        "bob",
      ),
      statement(
        "alice-manual",
        "I manually do invoice reconciliation matching records in spreadsheets every week.",
        "alice",
      ),
    ];
    const model = trainModel(undefined, docs, start);
    const signals = docs.flatMap((doc) => extractSignals(doc, start));
    const before = clusterSignals([], signals.slice(0, 2), model, start);
    expect(
      proposeLocalOpportunities(before, signals.slice(0, 2), start),
    ).toHaveLength(1);
    const after = clusterSignals(before, signals, model, start);
    const ideas = proposeLocalOpportunities(after, signals, start);
    expect(ideas).toHaveLength(1);
    expect(
      ideas[0].evidence.some((item) => item.quote === signals[0].quote),
    ).toBe(true);
  });

  it("recupera todos los cierres pendientes con datos tras varios días de interrupción", async () => {
    await saveStory(
      statement(
        "day-one",
        "We manually reconcile invoice records in spreadsheets every week.",
      ),
    );
    await saveDailyReport("2026-10-28", start);
    await saveStory(
      statement(
        "day-two",
        "I need an invoice reconciliation tool for our accounting workflow.",
        "bob",
        new Date("2026-10-29T15:00:00Z"),
      ),
    );
    await runLocalResearch(new Date("2026-11-02T15:00:00Z"));
    const reports = (await getResearchData()).reports;
    expect(reports.find((r) => r.date === "2026-10-28")?.provisional).toBe(
      false,
    );
    expect(reports.find((r) => r.date === "2026-10-29")?.provisional).toBe(
      false,
    );
    expect(reports.some((r) => r.date === "2026-10-30")).toBe(false);
  });

  it("refuerza el mismo cuaderno dos meses después sin borrar citas ni historia", async () => {
    const text =
      "I need a tool for invoice reconciliation because manually matching invoices takes hours.";
    const first = {
      ...statement("month-one", text, "alice"),
      kind: "question" as const,
    };
    await saveStory(first);
    await runLocalResearch(start);
    const initial = await getResearchData();
    expect(initial.notes).toHaveLength(1);
    const later = new Date("2026-12-28T15:00:00Z");
    await saveStory({
      ...statement("month-three", text, "bob", later),
      kind: "question",
    });
    await runLocalResearch(later);
    const accumulated = await getResearchData();
    expect(accumulated.signals).toHaveLength(2);
    expect(accumulated.notes).toHaveLength(1);
    expect(accumulated.notes[0].id).toBe(initial.notes[0].id);
    expect(accumulated.notes[0].independentVoices).toBe(2);
    expect(accumulated.notes[0].journal).toHaveLength(2);
    expect(accumulated.observations).toHaveLength(2);
    expect(
      accumulated.history?.filter((e) => e.kind === "discovered"),
    ).toHaveLength(1);
    await runLocalResearch(later);
    expect((await getResearchData()).history).toEqual(accumulated.history);
  });

  it("recupera evidencia aún no extraída que ya está fuera del corpus de trabajo", async () => {
    await saveStory(
      statement(
        "old-unprocessed",
        "I need a tool for invoice reconciliation because manually matching invoices takes hours.",
      ),
    );
    await runLocalResearch(new Date("2026-12-28T15:00:00Z"));
    const data = await getResearchData();
    expect(data.documentsTracked).toBe(0);
    expect(data.signals).toHaveLength(1);
    expect(data.notes).toHaveLength(1);
  });
});
