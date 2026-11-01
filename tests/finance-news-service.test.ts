import { financeAction, getFinanceData } from "@/features/finance/service";
import { financeDay } from "@/features/finance/engine";
import * as newsEngine from "@/features/finance/news-research";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { getDb } from "@/db/client";
import * as t from "@/db/schema";
import {
  collectFinanceNews,
  getFinanceNewsWorkspace,
  saveFinanceNewsReview,
} from "@/features/finance/research-service";
import { backupColumns, validateSnapshot } from "@/features/backups/format";
import type { Story } from "@/lib/types";
afterEach(() => vi.restoreAllMocks());
const now = new Date("2026-10-31T22:00:00Z");
const story: Story = {
  id: "finance-source",
  url: "https://example.com/earnings",
  title: "Microsoft reports revenue growth while cloud costs rise",
  sourceId: "synthetic-editorial",
  sourceName: "Fuente sintética",
  publishedAt: "2026-10-31T14:00:00Z",
  detectedAt: now.toISOString(),
  excerpt:
    "Microsoft reported revenue growth of 8 percent. Cloud costs also increased, while the company did not provide a new profit forecast.",
  category: "Finanzas",
  companies: ["MSFT"],
  coverage: "excerpt",
  analysis: "pending",
  references: [
    { name: "Fuente sintética", url: "https://example.com/earnings" },
  ],
  score: 10,
  contentHash: "first-content",
  kind: "news",
};
beforeEach(async () => {
  const db = await getDb();
  for (const table of [
    t.financeNewsEvents,
    t.financeNewsReviews,
    t.financeNewsBriefs,
    t.financeInstruments,
    t.financeMovements,
    t.financeDecisions,
    t.financeMarks,
    t.financePolicies,
    t.financeTheses,
    t.financeResearch,
    t.financeSync,
    t.stories,
  ])
    await db.delete(table);
});
async function seed(s = story) {
  const db = await getDb();
  await db
    .insert(t.stories)
    .values({ id: s.id, url: s.url, data: s })
    .onConflictDoUpdate({ target: t.stories.id, set: { data: s } });
}
describe("archivo de investigación financiera sin cartera", () => {
  it("guarda fichas e informe automáticamente, repite sin duplicar y no crea inversiones", async () => {
    await seed();
    await collectFinanceNews(now);
    await collectFinanceNews(now);
    const data = await getFinanceNewsWorkspace(false, now);
    expect(data.events).toHaveLength(1);
    expect(data.briefs).toHaveLength(1);
    const db = await getDb();
    expect(await db.select().from(t.financeInstruments)).toHaveLength(0);
    expect(await db.select().from(t.financeMovements)).toHaveLength(0);
  });
  it("la lectura no escribe ni consulta proveedores; versiones preservan la copia anterior", async () => {
    await seed();
    await collectFinanceNews(now);
    const first = await getFinanceNewsWorkspace(false, now);
    await seed({
      ...story,
      contentHash: "second-content",
      excerpt: story.excerpt + " A later update added operating expenses.",
    });
    const still = await getFinanceNewsWorkspace(false, now);
    expect(still.events[0].id).toBe(first.events[0].id);
    await collectFinanceNews(new Date(now.getTime() + 1000));
    const changed = await getFinanceNewsWorkspace(true, now);
    expect(changed.totalVersions).toBe(2);
    expect(changed.totalEvents).toBe(1);
  });
  it("una fuente A→B→A vuelve a mostrar A con una observación nueva y sin reescribir informes", async () => {
    await seed();
    await collectFinanceNews(now);
    const first = await getFinanceNewsWorkspace(true, now);
    const changed = {
      ...story,
      contentHash: "revised",
      title: "Microsoft changes its revenue report to 8 percent",
    };
    await seed(changed);
    await collectFinanceNews(new Date(now.getTime() + 1000));
    await seed();
    await collectFinanceNews(new Date(now.getTime() + 2000));
    const current = await getFinanceNewsWorkspace(
      true,
      new Date(now.getTime() + 2000),
    );
    expect(current.events[0].title).toBe(story.title);
    expect(current.events[0].id).not.toBe(first.events[0].id);
    expect(current.events[0].evidenceId).toBe(first.events[0].evidenceId);
    expect(current.totalVersions).toBe(3);
    expect(current.totalBriefs).toBe(3);
    const old = current.briefs.find((b) => b.id === first.briefs[0].id);
    expect(old?.eventIds).toEqual(first.briefs[0].eventIds);
    await collectFinanceNews(new Date(now.getTime() + 3000));
    expect(
      (await getFinanceNewsWorkspace(true, new Date(now.getTime() + 3000)))
        .totalVersions,
    ).toBe(3);
  });
  it("versiona notas con captura de noticia, deduplica reintentos y conserva revisiones", async () => {
    await seed();
    await collectFinanceNews(now);
    const event = (await getFinanceNewsWorkspace(false, now)).events[0];
    const input = {
      eventId: event.id,
      status: "investigate" as const,
      note: "Revisar el margen antes de concluir.",
      openQuestions: "Qué período incluye el costo?",
    };
    await saveFinanceNewsReview(input);
    await saveFinanceNewsReview(input);
    await saveFinanceNewsReview({
      ...input,
      status: "monitor",
      note: "Esperar el reporte oficial y contrastar el gasto.",
    });
    const data = await getFinanceNewsWorkspace(true, new Date());
    expect(data.reviews).toHaveLength(2);
    expect(data.reviews.every((r) => r.snapshot.id === event.id)).toBe(true);
  });
  it("el diario conserva las noticias y notas conocidas al registrar una decisión sin dinero", async () => {
    await seed();
    await collectFinanceNews(now);
    const event = (await getFinanceNewsWorkspace(false, now)).events[0];
    await saveFinanceNewsReview({
      eventId: event.id,
      status: "monitor",
      note: "Esperar el reporte oficial antes de concluir.",
      openQuestions: "Revisar el período.",
    });
    await financeAction({
      action: "decision",
      date: financeDay(),
      decision: "Continuar investigando",
      reason: "Revisar las cifras y sus fuentes antes de invertir.",
      alternatives: "Esperar",
      revisitWhen: "Cuando llegue el reporte",
    });
    const first = (await getFinanceData(true)).decisions[0];
    expect(first.snapshot.news?.[0].id).toBe(event.id);
    expect(first.snapshot.newsReviews?.[0].note).toContain("reporte oficial");
    await seed({
      ...story,
      contentHash: "third-content",
      title: "Microsoft updates its source",
    });
    await collectFinanceNews(new Date(now.getTime() + 1000));
    const captured = (await getFinanceData(true)).decisions[0];
    expect(captured.snapshot.news?.[0].title).toBe(story.title);
    expect(captured.snapshot.summary.valueMxn).toBe("0");
  });
  it("rechaza notas sin noticia archivada y no acepta contenido excesivo", async () => {
    await expect(
      saveFinanceNewsReview({
        eventId: "missing",
        status: "monitor",
        note: "Una hipótesis.",
        openQuestions: "",
      }),
    ).rejects.toThrow();
    await expect(
      saveFinanceNewsReview({
        eventId: "missing",
        status: "monitor",
        note: "a".repeat(10000),
        openQuestions: "",
      }),
    ).rejects.toThrow();
  });
  it("declara límites al leer una muestra y exporta el archivo completo", async () => {
    await seed();
    await collectFinanceNews(now);
    const db = await getDb();
    const base = (await db.select().from(t.financeNewsEvents))[0].data;
    await db.insert(t.financeNewsEvents).values(
      Array.from({ length: 80 }, (_, i) => ({
        id: `event-${i}`,
        data: {
          ...base,
          id: `event-${i}`,
          storyId: `story-${i}`,
          url: `https://example.com/event-${i}`,
          title: `Noticia independiente ${i}`,
          relatedStoryIds: [],
          relatedUrls: [],
        },
      })),
    );
    const brief = await getFinanceNewsWorkspace(false, now);
    const full = await getFinanceNewsWorkspace(true, now);
    expect(brief.viewLimited).toBe(true);
    expect(full.events.length).toBeGreaterThan(brief.events.length);
    expect(full.events.length).toBe(full.totalEvents);
  });
  it("recupera noticias antiguas más allá de 5,000 filas crudas mediante un cursor persistente", async () => {
    const db = await getDb();
    const rows = Array.from({ length: 5001 }, (_, i) => {
      const id = `raw-${String(i).padStart(5, "0")}`;
      return {
        id,
        url: `https://example.com/hobby-${i}`,
        data: {
          ...story,
          id,
          url: `https://example.com/hobby-${i}`,
          title: "Ask HN: hobbies without finance",
          kind: "question" as const,
          category: "Software" as const,
          companies: [],
          publishedAt: "2026-10-31T16:00:00Z",
          contentHash: id,
        },
      };
    });
    await db.insert(t.stories).values(rows);
    await seed({
      ...story,
      id: "zz-old-finance",
      url: "https://example.com/older-finance",
      publishedAt: "2026-10-01T12:00:00Z",
    });
    for (let i = 0; i < 11; i++)
      await collectFinanceNews(new Date(now.getTime() + i * 1000));
    const data = await getFinanceNewsWorkspace(true, now);
    expect(data.events.some((e) => e.storyId === "zz-old-finance")).toBe(true);
    const state = (await db.select().from(t.financeSync)).find(
      (r) => r.id === "news-research",
    )?.data;
    expect(state?.scanComplete).toBe(true);
  });
  it("un fallo atrasado no reemplaza un éxito más reciente", async () => {
    const db = await getDb();
    const at = new Date(now.getTime() + 60_000).toISOString();
    await db.insert(t.financeSync).values({
      id: "news-research",
      data: {
        id: "news-research",
        label: "Investigación",
        provider: "Motor local",
        status: "ok",
        message: "Éxito reciente",
        lastAttempt: at,
        lastSuccess: at,
      },
    });
    await seed();
    vi.spyOn(newsEngine, "buildFinanceNewsEvent").mockImplementationOnce(() => {
      throw new Error("synthetic extraction failure");
    });
    await expect(collectFinanceNews(now)).rejects.toThrow("quedó pendiente");
    const state = (await db.select().from(t.financeSync)).find(
      (r) => r.id === "news-research",
    )?.data;
    expect(state?.status).toBe("ok");
    expect(state?.lastSuccess).toBe(at);
  });
  it("los backups aceptan archivos completos22/26/33/34/37/41 y rechazan mezcla parcial", () => {
    const tables = Object.keys(backupColumns).map((name) => ({
      name,
      rows: [],
    }));
    const automatic = new Set([
      "finance_profiles",
      "finance_histories",
      "finance_automation_inputs",
      "finance_analyses",
    ]);
    const previous = tables.filter((t) => !automatic.has(t.name));
    const sets = [
      tables,
      previous,
      previous.filter((t) => !t.name.startsWith("finance_news_")),
      previous.filter(
        (t) => !t.name.startsWith("finance_news_") && t.name !== "finance_sync",
      ),
      tables.filter((t) => !t.name.startsWith("finance_")),
      tables.filter(
        (t) =>
          !t.name.startsWith("finance_") && !t.name.startsWith("evidence_"),
      ),
    ];
    expect(sets.map((t) => t.length)).toEqual([41, 37, 34, 33, 26, 22]);
    for (const set of sets)
      expect(
        validateSnapshot({
          version: 1,
          createdAt: now.toISOString(),
          tables: set,
        }).tables,
      ).toHaveLength(set.length);
    expect(() =>
      validateSnapshot({
        version: 1,
        createdAt: now.toISOString(),
        tables: tables.filter((t) => t.name !== "finance_news_reviews"),
      }),
    ).toThrow();
  });
});
