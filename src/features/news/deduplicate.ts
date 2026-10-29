import type { Story } from "@/lib/types";

function tokens(title: string) {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3),
  );
}
export function sameEvent(a: Story, b: Story): boolean {
  if (a.url === b.url) return true;
  if (
    Math.abs(Date.parse(a.publishedAt) - Date.parse(b.publishedAt)) >
    36 * 3600000
  )
    return false;
  const left = tokens(a.originalTitle ?? a.title),
    right = tokens(b.originalTitle ?? b.title);
  const intersection = [...left].filter((word) => right.has(word)).length;
  return (
    intersection >= 5 &&
    intersection / new Set([...left, ...right]).size >= 0.72
  );
}
export function groupStories(input: Story[]): Story[] {
  const result: Story[] = [];
  for (const story of input.toSorted((a, b) => b.score - a.score)) {
    const references = story.references.map((ref) => ({
      ...ref,
      storyId: ref.storyId ?? (ref.url === story.url ? story.id : undefined),
    }));
    const match = result.find((existing) => sameEvent(existing, story));
    if (!match) {
      result.push({
        ...story,
        relatedIds: [...new Set([story.id, ...(story.relatedIds ?? [])])],
        references,
      });
      continue;
    }
    match.relatedIds = [
      ...new Set([
        ...(match.relatedIds ?? [match.id]),
        story.id,
        ...(story.relatedIds ?? []),
      ]),
    ];
    for (const ref of references)
      if (!match.references.some((r) => r.url === ref.url))
        match.references.push(ref);
    match.imageUrl ??= story.imageUrl;
    match.imageCredit ??= story.imageCredit;
  }
  return result;
}
export function rankStories(stories: Story[], now = Date.now()): Story[] {
  const score = (story: Story) => {
    const age = Math.max(0, (now - Date.parse(story.publishedAt)) / 3600000);
    return (
      Math.max(0, 48 - age) +
      Math.min(14, Math.log2(story.score + 1) * 1.5) +
      (story.companies.length ? 6 : 0) +
      (story.category === "IA" || story.category === "Chips" ? 5 : 0) +
      (story.coverage !== "headline" ? 18 : 0) +
      (story.imageUrl ? 4 : 0)
    );
  };
  const remaining = [...stories];
  const result: Story[] = [];
  const counts = new Map<string, number>();
  while (remaining.length) {
    remaining.sort(
      (a, b) =>
        score(b) -
        (counts.get(b.sourceId) ?? 0) * 8 -
        (score(a) - (counts.get(a.sourceId) ?? 0) * 8),
    );
    const story = remaining.shift()!;
    result.push(story);
    counts.set(story.sourceId, (counts.get(story.sourceId) ?? 0) + 1);
  }
  return result;
}
