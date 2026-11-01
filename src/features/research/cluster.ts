import type { ResearchModel, ResearchNote, ResearchSignal } from "@/lib/types";
import { hash } from "@/features/news/normalize";
import { editionFor } from "@/lib/time";
import { keywords } from "./vector";
import { isSpecificScope, problemScope } from "./problem-scope";

export function topicLabel(tokens: string[]) {
  return problemScope(tokens.join(" "))?.label ?? "Necesidad por clasificar";
}

/** Rebuild the current interpretation; source rows and report snapshots remain untouched. */
export function clusterSignals(
  previous: ResearchNote[],
  signals: ResearchSignal[],
  model: ResearchModel,
  _now = new Date(),
): ResearchNote[] {
  // Keep the existing call contract; journal days come from capture timestamps.
  void _now;
  const groups = new Map<string, ResearchSignal[]>();
  for (const signal of [...signals].sort(
    (a, b) =>
      a.detectedAt.localeCompare(b.detectedAt) || a.id.localeCompare(b.id),
  )) {
    const scope = problemScope(signal.quote);
    if (!scope) continue;
    const key = isSpecificScope(scope)
      ? scope.key
      : `${scope.key}:${signal.id}`;
    const members = groups.get(key) ?? [];
    if (
      !members.some(
        (m) => m.storyId === signal.storyId && m.quote === signal.quote,
      )
    )
      members.push(signal);
    groups.set(key, members);
  }
  const used = new Set<string>();
  return [...groups]
    .map(([key, members]) => {
      const scope = problemScope(members[0].quote)!;
      const voices = new Set(
        members.filter((s) => s.author).map((s) => s.independenceKey),
      ).size;
      const compatible = [...previous]
        .sort((a, b) => a.id.localeCompare(b.id))
        .find(
          (n) =>
            !used.has(n.id) &&
            n.signalIds.some((id) => members.some((s) => s.id === id)) &&
            n.signalIds.every((id) => {
              const signal = signals.find((s) => s.id === id);
              return !signal || problemScope(signal.quote)?.key === key;
            }),
        );
      const id = compatible?.id ?? `research-${hash(members[0].id)}`;
      used.add(id);
      const journal: ResearchNote["journal"] = [];
      for (const member of members) {
        const date = editionFor(new Date(member.detectedAt)).date;
        let entry = journal.find((e) => e.date === date);
        if (!entry) {
          entry = { date, added: 0, totalVoices: 0 };
          journal.push(entry);
        }
        entry.added++;
        entry.totalVoices = new Set(
          members
            .filter(
              (s) =>
                s.author && editionFor(new Date(s.detectedAt)).date <= date,
            )
            .map((s) => s.independenceKey),
        ).size;
      }
      return {
        id,
        label: `${scope.label}${scope.domain !== "general" ? ` · ${scope.domain}` : ""}${scope.segment !== "desconocido" ? ` · ${scope.segment}` : ""}`,
        keywords: keywords(
          members.flatMap((s) => s.terms),
          model,
        ),
        signalIds: members.map((s) => s.id),
        independentVoices: voices,
        status: voices >= 2 ? ("repeated" as const) : ("isolated" as const),
        firstSeen: members[0].detectedAt,
        lastSeen: members.at(-1)!.detectedAt,
        journal,
        scope,
      };
    })
    .sort(
      (a, b) =>
        b.independentVoices - a.independentVoices ||
        b.lastSeen.localeCompare(a.lastSeen),
    );
}
