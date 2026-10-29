import type { Story } from "./types";
export function storyMatches(story: Story, id: string) {
  return story.id === id || Boolean(story.relatedIds?.includes(id));
}
export function resolveStorySource(stories: Story[], id: string) {
  const exact = stories.find((story) => story.id === id);
  if (exact) return { name: exact.sourceName, url: exact.url, storyId: id };
  for (const story of stories) {
    const reference = story.references.find((ref) => ref.storyId === id);
    if (reference) return reference;
  }
  return undefined;
}
