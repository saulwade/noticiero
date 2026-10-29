import Parser from "rss-parser";
import { fetchExternal } from "@/lib/http";
import { makeStory } from "@/features/news/normalize";
import type { Story } from "@/lib/types";

type Media = { $?: { url?: string }; url?: string };
type FeedItem = {
  mediaContent?: Media | Media[];
  mediaThumbnail?: Media | Media[];
  "content:encoded"?: string;
  "content:encodedSnippet"?: string;
};
const parser = new Parser<Record<string, never>, FeedItem>({
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
    ],
  },
});
function mediaUrl(media?: Media | Media[]) {
  const first = Array.isArray(media) ? media[0] : media;
  return first?.$?.url ?? first?.url;
}
export async function loadFeed(source: {
  id: string;
  name: string;
  url: string;
}): Promise<Story[]> {
  const response = await fetchExternal(source.url, [
    new URL(source.url).hostname,
  ]);
  const raw = await response.text();
  if (raw.length > 4_000_000)
    throw new Error("El feed excedió el tamaño permitido.");
  return parseFeed(raw, source);
}
export async function parseFeed(
  raw: string,
  source: { id: string; name: string },
): Promise<Story[]> {
  const feed = await parser.parseString(raw);
  const cutoff = Date.now() - 72 * 3600000;
  return feed.items.slice(0, 30).flatMap((item) => {
    const html = item["content:encoded"] ?? item.content ?? "";
    const image =
      mediaUrl(item.mediaContent) ??
      mediaUrl(item.mediaThumbnail) ??
      (item.enclosure?.type?.startsWith("image/")
        ? item.enclosure.url
        : undefined) ??
      html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
    const story = makeStory({
      title: item.title ?? "",
      url: item.link ?? "",
      excerpt: item.contentSnippet ?? item["content:encodedSnippet"] ?? html,
      sourceId: source.id,
      sourceName: source.name,
      publishedAt: item.isoDate ?? item.pubDate,
      imageUrl: image,
    });
    return story && Date.parse(story.publishedAt) >= cutoff ? [story] : [];
  });
}
