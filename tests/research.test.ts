import { describe, expect, it, beforeEach } from "vitest";
import { makeStory, plainText } from "@/features/news/normalize";
import { terms, trainModel, vector, cosine } from "@/features/research/vector";
import { extractSignals } from "@/features/research/signals";
import { clusterSignals } from "@/features/research/cluster";
import { proposeLocalOpportunities } from "@/features/research/opportunities";
import { createDailyReport, localHour } from "@/features/research/report";
import {
  runLocalResearch,
  getResearchData,
  saveDailyReport,
} from "@/features/research/service";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { saveStory, savePreference, getDashboardData } from "@/db/repository";
import type { Story } from "@/lib/types";

const now = new Date("2026-10-29T03:00:00Z");
function story(
  id: string,
  excerpt: string,
  author = id,
  kind: Story["kind"] = "comment",
): Story {
  return {
    ...makeStory({
      title: "Ask HN: Does anyone need a billing tool?",
      excerpt,
      url: `https://news.ycombinator.com/item?id=${id}`,
      sourceId: "ask-hn",
      sourceName: "Ask HN",
      publishedAt: now.toISOString(),
    })!,
    id,
    author,
    kind,
    detectedAt: now.toISOString(),
  };
}
const invoice =
  "I need a tool for invoice reconciliation because manually matching invoices takes hours.";
const otherInvoice =
  "We need a tool for invoice reconciliation because manually matching invoices takes days.";

describe("motor estadístico local", () => {
  it("actualiza frecuencias sin multiplicar documentos reconsultados y evita colisiones de prototipo", () => {
    const one = story("1", invoice);
    const first = trainModel(undefined, [one], now);
    const second = trainModel(first, [one], now);
    expect(second.documentFrequency).toEqual(first.documentFrequency);
    expect(Object.keys(second.documents)).toHaveLength(1);
    const changed = trainModel(
      first,
      [
        {
          ...one,
          excerpt: "constructor prototype security",
          originalTitle: "Security",
          contentHash: "changed",
        },
      ],
      now,
    );
    expect(changed.documentFrequency.factura).toBeUndefined();
    expect(terms("constructor prototype costos")).toEqual([
      "constructor",
      "prototype",
      "coste",
    ]);
    const v = vector(terms("constructor prototype"), changed);
    expect(cosine(v, v)).toBeCloseTo(1);
  });
  it("extrae solicitudes y quejas originales, nunca el titular del padre de una respuesta", () => {
    expect(extractSignals(story("1", invoice), now)[0].kind).toBe("request");
    expect(
      extractSignals(
        story("2", "I am frustrated because the export doesn't work reliably."),
        now,
      )[0].kind,
    ).toBe("pain");
    expect(
      extractSignals(
        story(
          "3",
          "We manually copy and paste records into spreadsheets every week.",
        ),
        now,
      )[0].kind,
    ).toBe("workaround");
    expect(
      extractSignals(
        story("4", "Great announcement, congratulations to the team!"),
        now,
      ),
    ).toEqual([]);
    expect(
      extractSignals(
        story("recommend", "I recommend Stripe for invoice reconciliation."),
        now,
      ),
    ).toEqual([]);
    expect(
      extractSignals(
        story(
          "personal",
          "I need an optimist who can find the good in people and in life.",
        ),
        now,
      ),
    ).toEqual([]);
    expect(
      extractSignals(
        story(
          "advice",
          "You have to look at the code and say I understand it even if you can't write it.",
        ),
        now,
      ),
    ).toEqual([]);
    expect(
      extractSignals(
        story("enough", "I cannot recommend this invoice tool enough."),
        now,
      ),
    ).toEqual([]);
    expect(
      extractSignals(
        story(
          "recommend-request",
          "Can anyone recommend a tool for invoice reconciliation?",
        ),
        now,
      )[0].kind,
    ).toBe("request");
    expect(
      extractSignals(story("5", invoice, "author", "research"), now),
    ).toEqual([]);
    expect(extractSignals(story("6", invoice, "author", "news"), now)).toEqual(
      [],
    );
    expect(plainText("can&#x27;t &amp; won&#39;t&#x2f;ever")).toBe(
      "can't & won't/ever",
    );
  });
  it("requiere autores distintos, separa temas y no duplica notas al reejecutarse", () => {
    const docs = [
      story("1", invoice, "alice"),
      story("2", otherInvoice, "bob"),
      story(
        "3",
        "I need a tool to track AI token costs and model pricing.",
        "carl",
      ),
    ];
    const model = trainModel(undefined, docs, now);
    const signals = docs.flatMap((doc) => extractSignals(doc, now));
    const notes = clusterSignals([], signals, model, now);
    expect(notes).toHaveLength(2);
    expect(notes[0].independentVoices).toBe(2);
    expect(proposeLocalOpportunities(notes, signals, now)).toHaveLength(1);
    expect(clusterSignals(notes, signals, model, now)).toEqual(notes);
    const sameAuthor = signals.map((signal) => ({
      ...signal,
      author: "alice",
      independenceKey: "hn:alice",
    }));
    expect(
      proposeLocalOpportunities(
        clusterSignals([], sameAuthor, model, now),
        sameAuthor,
        now,
      ),
    ).toEqual([]);
  });
  it("recupera reportes sin filtrar evidencia de días futuros y distingue el corte provisional", () => {
    const docs = [story("1", invoice), story("2", otherInvoice)];
    const model = trainModel(undefined, docs, now);
    const old = extractSignals(docs[0], now);
    const future = extractSignals(docs[1], new Date("2026-10-30T03:00:00Z"));
    const notes = clusterSignals(
      clusterSignals([], old, model, now),
      future.concat(old),
      model,
      new Date("2026-10-30T03:00:00Z"),
    );
    const ideas = proposeLocalOpportunities(
      notes,
      [...old, ...future],
      new Date("2026-10-30T03:00:00Z"),
    );
    const report = createDailyReport(
      "2026-10-28",
      docs,
      [...old, ...future],
      notes,
      ideas,
      new Date("2026-10-30T03:00:00Z"),
    );
    expect(report.themes[0].voices).toBe(1);
    expect(report.themes[0].evidence).toHaveLength(1);
    expect(report.hypotheses).toEqual([]);
    expect(report.provisional).toBe(false);
    expect(localHour(new Date("2026-10-29T02:00:00Z"))).toBe(20);
    expect(
      createDailyReport(
        "2026-10-28",
        [],
        [],
        [],
        [],
        new Date("2026-10-28T18:00:00Z"),
      ).provisional,
    ).toBe(true);
  });
  it("un comentario editado mañana no sustituye una cita de la hipótesis de ayer", () => {
    const docs = [
      story("1", invoice, "alice"),
      story("2", otherInvoice, "bob"),
    ];
    const model = trainModel(undefined, docs, now);
    const old = docs.flatMap((doc) => extractSignals(doc, now));
    const firstNotes = clusterSignals([], old, model, now);
    const firstIdea = proposeLocalOpportunities(firstNotes, old, now)[0];
    const tomorrow = new Date("2026-10-30T03:00:00Z");
    const edited = extractSignals(
      story(
        "1",
        "I need a tool for invoice reconciliation after tomorrow's new discovery.",
        "alice",
      ),
      tomorrow,
    );
    const all = [...old, ...edited];
    const notes = clusterSignals(firstNotes, all, model, tomorrow);
    const updated = {
      ...proposeLocalOpportunities(notes, all, tomorrow)[0],
      createdAt: firstIdea.createdAt,
    };
    const report = createDailyReport(
      "2026-10-28",
      docs,
      all,
      notes,
      [updated],
      tomorrow,
    );
    expect(report.hypotheses).toHaveLength(1);
    expect(report.hypotheses![0].evidence.map((item) => item.quote)).toContain(
      invoice,
    );
    expect(JSON.stringify(report)).not.toContain("tomorrow's new discovery");
  });
  it("el resumen de noticias descarta cupones y deportes y el caché refleja el texto seleccionado", () => {
    const tech = {
      ...story(
        "tech",
        "The new GPU architecture supports software developers.",
        "writer",
        "news",
      ),
      title: "Nvidia releases a new GPU",
      originalTitle: "Nvidia releases a new GPU",
    };
    const coupon = {
      ...tech,
      id: "coupon",
      title: "Norton Coupon Codes: Up to 58% Off",
      originalTitle: "Norton Coupon Codes: Up to 58% Off",
    };
    const sport = {
      ...tech,
      id: "sport",
      title: "Milwaukee wins World Series",
      originalTitle: "Milwaukee wins World Series",
    };
    const first = createDailyReport(
      "2026-10-28",
      [tech, coupon, sport],
      [],
      [],
      [],
      now,
    );
    expect(first.news?.map((item) => item.title)).toEqual([tech.title]);
    const second = createDailyReport(
      "2026-10-28",
      [{ ...tech, summary: "Resumen editorial actualizado." }, coupon, sport],
      [],
      [],
      [],
      now,
    );
    expect(second.inputHash).not.toBe(first.inputHash);
  });
});
describe("archivo de investigación persistente", () => {
  beforeEach(async () => {
    const db = await getDb();
    for (const table of [
      schema.stories,
      schema.researchModels,
      schema.researchNotes,
      schema.researchSignals,
      schema.dailyReports,
      schema.opportunities,
      schema.opportunityBatches,
      schema.savedItems,
    ])
      await db.delete(table);
  });
  it("acumula señales, guarda el cierre y conserva anotaciones sin volver a publicar ideas", async () => {
    await saveStory(story("1", invoice, "alice"));
    await saveStory(story("2", otherInvoice, "bob"));
    await runLocalResearch(now);
    const first = await getResearchData();
    expect(first.signals).toHaveLength(2);
    expect(first.reports).toHaveLength(1);
    expect(first.reports[0].themes[0].voices).toBe(2);
    await savePreference({
      action: "note",
      kind: "note",
      id: first.notes[0].id,
      note: "Preguntar por su flujo actual",
      state: "validating",
    });
    await runLocalResearch(now);
    const second = await getResearchData();
    expect(second.notes).toEqual(first.notes);
    expect(second.signals).toHaveLength(2);
    expect(second.reports[0].inputHash).toBe(first.reports[0].inputHash);
    const data = await getDashboardData();
    expect(data.saved[0].note).toBe("Preguntar por su flujo actual");
    expect(data.opportunities).toHaveLength(1);
    expect(
      await saveDailyReport("2026-10-28", new Date("2026-10-30T03:00:00Z")),
    ).toEqual(first.reports[0]);
  });
  it("recupera un corte provisional del día anterior aunque no hubiera quejas", async () => {
    await saveStory(
      story(
        "news",
        "Microsoft releases a new developer platform.",
        "writer",
        "news",
      ),
    );
    const provisional = await saveDailyReport(
      "2026-10-28",
      new Date("2026-10-28T18:00:00Z"),
    );
    expect(provisional.provisional).toBe(true);
    await runLocalResearch(new Date("2026-10-29T15:00:00Z"));
    const data = await getResearchData();
    expect(data.reports[0].provisional).toBe(false);
    expect(data.reports[0].documentCount).toBe(1);
    expect(data.reports[0].newSignals).toBe(0);
  });
  it("retira oportunidades derivadas de evidencia que el clasificador ya no admite, conservando sus anotaciones", async () => {
    const docs = [
      story("1", invoice, "alice"),
      story("2", otherInvoice, "bob"),
    ];
    for (const doc of docs) await saveStory(doc);
    await runLocalResearch(now);
    const db = await getDb();
    const data = await getDashboardData();
    const idea = data.opportunities[0];
    await savePreference({
      action: "note",
      kind: "idea",
      id: idea.id,
      note: "Mi anotación se conserva",
      state: "explore",
    });
    // Simulate a cached signal produced by an earlier, broader classifier.
    await db.delete(schema.researchSignals);
    const signal = extractSignals(docs[0], now)[0];
    await db.insert(schema.researchSignals).values({
      id: signal.id,
      data: {
        ...signal,
        quote: "I recommend Stripe for invoice reconciliation.",
      },
    });
    const filtered = await getDashboardData();
    expect(filtered.opportunities).toEqual([]);
    expect(filtered.saved.find((item) => item.id === idea.id)?.note).toBe(
      "Mi anotación se conserva",
    );
  });
});
