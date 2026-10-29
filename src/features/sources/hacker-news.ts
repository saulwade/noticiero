import { z } from "zod";
import { fetchExternal, mapConcurrent } from "@/lib/http";
import { makeStory } from "@/features/news/normalize";
import type { Story } from "@/lib/types";
const host = "hacker-news.firebaseio.com";
const itemSchema = z.object({
  id: z.number(),
  type: z.string(),
  title: z.string().optional(),
  url: z.string().optional(),
  time: z.number(),
  score: z.number().optional(),
  deleted: z.boolean().optional(),
  dead: z.boolean().optional(),
  text: z.string().optional(),
});
export async function loadHackerNews(): Promise<Story[]> {
  const response = await fetchExternal(`https://${host}/v0/topstories.json`, [
    host,
  ]);
  const ids = z
    .array(z.number())
    .parse(await response.json())
    .slice(0, 35);
  const items = await mapConcurrent(ids, 6, async (id) => {
    try {
      return itemSchema.parse(
        await (
          await fetchExternal(`https://${host}/v0/item/${id}.json`, [host], 2)
        ).json(),
      );
    } catch {
      return undefined;
    }
  });
  return items.flatMap((item) => {
    if (
      !item ||
      item.type !== "story" ||
      item.deleted ||
      item.dead ||
      !item.title ||
      !item.url ||
      Date.now() - item.time * 1000 > 72 * 3600000
    )
      return [];
    const story = makeStory({
      title: item.title,
      url: item.url,
      excerpt: item.text,
      sourceId: "hn",
      sourceName: "Hacker News",
      publishedAt: new Date(item.time * 1000).toISOString(),
      score: item.score,
    });
    return story ? [story] : [];
  });
}
