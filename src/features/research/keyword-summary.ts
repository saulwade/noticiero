import { editionFor } from "@/lib/time";
import { terms } from "./vector";
import type { ResearchObservation } from "@/lib/types";

/** Current interpretation of saved keywords; raw observations stay immutable. */
export function keywordSummary(
  observations: Pick<
    ResearchObservation,
    "id" | "storyId" | "at" | "keywords"
  >[],
  from: string,
  to: string,
  limit = 20,
) {
  const latest = new Map<string, (typeof observations)[number]>();
  for (const row of [...observations]
    .filter((r) => Number.isFinite(Date.parse(r.at)))
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))) {
    const date = editionFor(new Date(row.at)).date;
    if (date >= from && date <= to) latest.set(row.storyId, row);
  }
  const counts = new Map<string, number>();
  for (const row of latest.values())
    for (const term of new Set(terms(row.keywords.join(" "))))
      counts.set(term, (counts.get(term) ?? 0) + 1);
  return {
    documents: latest.size,
    keywords: [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([term, documents]) => ({ term, documents })),
  };
}
