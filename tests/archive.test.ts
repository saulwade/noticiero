import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getDashboardData, savePreference, saveStory } from "@/db/repository";
import { makeStory } from "@/features/news/normalize";
import { savedArchive } from "@/lib/saved-archive";
import { demoData } from "@/lib/demo-data";

beforeEach(async () => {
  const db = await getDb();
  for (const table of [schema.stories, schema.opportunities, schema.savedItems])
    await db.delete(table);
});
describe("archivo de guardados", () => {
  it("conserva la primera copia aunque una noticia cambie y se editen sus notas", async () => {
    const story = makeStory({
      title: "Microsoft launches a developer tool",
      excerpt: "The original source extract available when saved.",
      url: "https://example.com/archive-test",
      sourceId: "hn",
      sourceName: "Hacker News",
    })!;
    await saveStory(story);
    await savePreference({
      action: "save",
      id: story.id,
      kind: "story",
      enabled: true,
    });
    await saveStory({
      ...story,
      title: "Updated title",
      excerpt: "Changed source text",
      contentHash: "changed",
    });
    await savePreference({
      action: "note",
      id: story.id,
      note: "Discutir esta señal",
      state: "validating",
    });
    await savePreference({
      action: "save",
      id: story.id,
      kind: "story",
      enabled: true,
    });
    const data = await getDashboardData();
    expect(
      savedArchive(data.saved, data.stories, data.opportunities).stories[0]
        .title,
    ).toBe(story.title);
    expect(data.saved[0].note).toBe("Discutir esta señal");
    expect(
      data.saved[0].snapshot?.kind === "story" &&
        data.saved[0].snapshot.story.excerpt,
    ).toBe(story.excerpt);
  });
  it("una idea guardada sigue accesible aunque deje de publicarse por falta de evidencia", async () => {
    const idea = {
      ...demoData().opportunities[0],
      id: "archive-idea",
      engine: "local" as const,
      researchNoteId: "rejected-note",
    };
    const db = await getDb();
    await db.insert(schema.opportunities).values({ id: idea.id, data: idea });
    await savePreference({
      action: "save",
      kind: "idea",
      id: idea.id,
      enabled: true,
    });
    const data = await getDashboardData();
    expect(data.opportunities).toEqual([]);
    expect(
      savedArchive(data.saved, data.stories, data.opportunities).ideas[0],
    ).toEqual(idea);
    await db
      .delete(schema.opportunities)
      .where(eq(schema.opportunities.id, idea.id));
    const after = await getDashboardData();
    expect(savedArchive(after.saved, [], []).ideas[0].title).toBe(idea.title);
  });
  it("el archivo admite más de sesenta noticias y conserva compatibilidad con marcadores anteriores", () => {
    const source = demoData().stories[0];
    const saved = Array.from({ length: 65 }, (_, index) => {
      const story = { ...source, id: `archive-${index}` };
      return {
        id: story.id,
        kind: "story" as const,
        note: "",
        state: "explore" as const,
        createdAt: "2020-01-01T00:00:00Z",
        snapshot: { kind: "story" as const, story },
      };
    });
    expect(savedArchive(saved, [], []).stories).toHaveLength(65);
    const legacy = {
      id: source.id,
      kind: "story" as const,
      note: "",
      state: "explore" as const,
      createdAt: "2020-01-01T00:00:00Z",
    };
    expect(savedArchive([legacy], [source], []).stories[0]).toEqual(source);
  });
  it("archiva marcadores antiguos antes de filtrar ideas y conserva sus notas y fecha", async () => {
    const db = await getDb();
    const idea = {
      ...demoData().opportunities[0],
      id: "legacy-rejected-idea",
      engine: "local" as const,
      researchNoteId: "rejected-note",
    };
    const legacy = {
      id: idea.id,
      kind: "idea" as const,
      note: "Retomar esta hipótesis",
      state: "validating" as const,
      createdAt: "2020-01-01T00:00:00Z",
    };
    await db.insert(schema.opportunities).values({ id: idea.id, data: idea });
    await db.insert(schema.savedItems).values({ id: legacy.id, data: legacy });
    const data = await getDashboardData();
    expect(data.opportunities).toEqual([]);
    expect(savedArchive(data.saved, [], []).ideas).toEqual([idea]);
    const stored = (await db.select().from(schema.savedItems))[0].data;
    expect(stored).toMatchObject(legacy);
    expect(stored.snapshot).toEqual({ kind: "idea", idea });
    await db.delete(schema.opportunities);
    const after = await getDashboardData();
    expect(savedArchive(after.saved, [], []).ideas).toEqual([idea]);
  });
});
