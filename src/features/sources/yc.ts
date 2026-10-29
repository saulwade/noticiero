import { load } from "cheerio";
import { fetchExternal } from "@/lib/http";
import { makeStory, hash } from "@/features/news/normalize";
import type { Story } from "@/lib/types";

export function parseRequestsForStartups(html: string): Story[] {
  const $ = load(html);
  const result: Story[] = [];
  $("h3")
    .slice(0, 16)
    .each((_, element) => {
      const heading = $(element);
      const anchor = heading.find('a[href^="#"]').attr("href");
      const title = heading.text().trim();
      if (!title || !anchor) return;
      const container = heading.closest("[id]").length
        ? heading.closest("[id]")
        : heading.parent().parent();
      const excerpt = container
        .clone()
        .find("h3,svg")
        .remove()
        .end()
        .text()
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 5000);
      const sourceUrl = `https://www.ycombinator.com/rfs${anchor}`;
      const story = makeStory({
        title,
        excerpt,
        url: "https://www.ycombinator.com/rfs",
        sourceId: "yc-rfs",
        sourceName: "YC · Requests for Startups",
        publishedAt: new Date(0).toISOString(),
      });
      if (story)
        result.push({
          ...story,
          id: hash(sourceUrl),
          url: sourceUrl,
          references: [
            { name: "Y Combinator", url: sourceUrl, storyId: hash(sourceUrl) },
          ],
          kind: "research",
          category: "Startups",
        });
    });
  return result;
}
export async function loadRequestsForStartups() {
  const response = await fetchExternal("https://www.ycombinator.com/rfs", [
    "www.ycombinator.com",
  ]);
  const html = await response.text();
  if (html.length > 4_000_000)
    throw new Error("La fuente excede el tamaño permitido.");
  const stories = parseRequestsForStartups(html);
  if (!stories.length) throw new Error("El formato público de YC cambió.");
  return stories;
}
