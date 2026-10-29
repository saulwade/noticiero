import { z } from "zod";
import { fetchExternal, mapConcurrent } from "@/lib/http";
import { makeStory } from "@/features/news/normalize";
import type { Story } from "@/lib/types";

const host = "hacker-news.firebaseio.com";
const itemSchema = z.object({
  id: z.number(),
  type: z.string(),
  title: z.string().optional(),
  text: z.string().optional(),
  by: z.string().optional(),
  time: z.number(),
  kids: z.array(z.number()).optional(),
  dead: z.boolean().optional(),
  deleted: z.boolean().optional(),
  score: z.number().optional(),
});
async function item(id: number) {
  try {
    return itemSchema.parse(
      await (
        await fetchExternal(`https://${host}/v0/item/${id}.json`, [host], 1)
      ).json(),
    );
  } catch {
    return undefined;
  }
}
export async function loadCommunity(section: "ask" | "show"): Promise<Story[]> {
  const ids = z
    .array(z.number())
    .parse(
      await (
        await fetchExternal(`https://${host}/v0/${section}stories.json`, [host])
      ).json(),
    )
    .slice(0, section === "ask" ? 18 : 10);
  const fetched = await mapConcurrent(ids, 5, item);
  if (ids.length && fetched.every((thread) => !thread))
    throw new Error("No se pudieron consultar los hilos.");
  const threads = fetched.filter(
    (thread) =>
      thread &&
      !thread.dead &&
      !thread.deleted &&
      thread.title &&
      Date.now() - thread.time * 1000 < 14 * 86400000,
  );
  const result: Story[] = [];
  const children: {
    id: number;
    parent: NonNullable<(typeof threads)[number]>;
  }[] = [];
  for (const thread of threads) {
    if (!thread) continue;
    const story = makeStory({
      title: thread.title!,
      excerpt: thread.text,
      url: `https://news.ycombinator.com/item?id=${thread.id}`,
      sourceId: `${section}-hn`,
      sourceName: section === "ask" ? "Ask HN" : "Show HN",
      publishedAt: new Date(thread.time * 1000).toISOString(),
      score: thread.score,
    });
    if (story)
      result.push({
        ...story,
        kind: section === "ask" ? "question" : "launch",
        author: thread.by,
        threadId: String(thread.id),
        category: "Startups",
      });
    for (const id of (thread.kids ?? []).slice(0, 3))
      children.push({ id, parent: thread });
  }
  const comments = await mapConcurrent(
    children.slice(0, section === "ask" ? 36 : 18),
    5,
    async ({ id, parent }) => ({ comment: await item(id), parent }),
  );
  for (const { comment, parent } of comments) {
    if (
      !comment?.text ||
      comment.deleted ||
      comment.dead ||
      comment.type !== "comment"
    )
      continue;
    const story = makeStory({
      title: parent.title!,
      excerpt: comment.text,
      url: `https://news.ycombinator.com/item?id=${comment.id}`,
      sourceId: `${section}-hn`,
      sourceName:
        section === "ask" ? "Ask HN · respuesta" : "Show HN · respuesta",
      publishedAt: new Date(comment.time * 1000).toISOString(),
    });
    if (story)
      result.push({
        ...story,
        kind: "comment",
        author: comment.by,
        threadId: String(parent.id),
        category: "Startups",
      });
  }
  return result;
}
