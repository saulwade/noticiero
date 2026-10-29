import type { Opportunity, SavedItem, Story } from "./types";
import { storyMatches } from "./story-identity";

// Saved copies are independent of later rankings, source edits and classifier changes.
export function savedArchive(
  saved: SavedItem[],
  stories: Story[],
  ideas: Opportunity[],
) {
  const archivedStories: Story[] = [];
  const archivedIdeas: Opportunity[] = [];
  for (const item of saved) {
    if (item.kind === "story") {
      const story =
        item.snapshot?.kind === "story"
          ? item.snapshot.story
          : stories.find((story) => storyMatches(story, item.id));
      if (
        story &&
        !archivedStories.some((previous) => storyMatches(previous, story.id))
      )
        archivedStories.push(story);
    } else if (item.kind === "idea") {
      const idea =
        item.snapshot?.kind === "idea"
          ? item.snapshot.idea
          : ideas.find((idea) => idea.id === item.id);
      if (idea) archivedIdeas.push(idea);
    }
  }
  return { stories: archivedStories, ideas: archivedIdeas };
}
