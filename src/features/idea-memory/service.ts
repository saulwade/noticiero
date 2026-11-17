import { sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { getDb } from "@/db/client";
import {
  ideaMemory,
  ideaJournal,
  ideaLinks,
  ideaSourceChecks,
  ideaAssessments,
  evidenceRecords,
  evidenceReviews,
  stories,
} from "@/db/schema";
import { buildDossiers } from "@/features/evidence/engine";
import { isSpecificScope } from "@/features/research/problem-scope";
import { linkIdeaEvidence, classifyStoryContext } from "./quality";
import { assessIdea } from "./engine";
import { refreshMemorySources } from "./sources";
import { memoryImportSchema } from "./import";
import {
  MEMORY_VERSION,
  type IdeaDefinition,
  type IdeaMemoryData,
  type IdeaSource,
} from "./types";

function effectiveDefinition(
  definition: IdeaDefinition,
  journal: import("./types").IdeaDecision[],
  now: Date,
): IdeaDefinition {
  const override = journal
    .filter(
      (d) =>
        d.ideaId === definition.id &&
        d.matchOverride &&
        Date.parse(d.at) <= now.getTime(),
    )
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
    .at(-1)?.matchOverride;
  return override ? { ...definition, match: override } : definition;
}

export async function importIdeaMemory(raw: unknown, now = new Date()) {
  const input = memoryImportSchema.parse(raw);
  if (
    input.definitions.some((d) => Date.parse(d.createdAt) > now.getTime()) ||
    input.decisions.some((d) => Date.parse(d.at) > now.getTime())
  )
    throw new Error("La memoria no admite fechas futuras.");
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7202634)`);
    const old = (await tx.select().from(ideaMemory)).map((r) => r.data);
    const known = new Set([
      ...old.map((d) => d.id),
      ...input.definitions.map((d) => d.id),
    ]);
    if (input.decisions.some((d) => !known.has(d.ideaId)))
      throw new Error("Decisión sin idea registrada.");
    for (const definition of input.definitions) {
      const prior = old.find((d) => d.id === definition.id);
      if (prior && !isDeepStrictEqual(prior, definition))
        throw new Error(
          "La definición original se conserva; registra el cambio en el historial de decisiones.",
        );
      await tx
        .insert(ideaMemory)
        .values({ id: definition.id, data: definition })
        .onConflictDoNothing();
    }
    const priorJournal = (await tx.select().from(ideaJournal)).map(
      (r) => r.data,
    );
    for (const decision of input.decisions) {
      const prior = priorJournal.find((d) => d.id === decision.id);
      if (prior && !isDeepStrictEqual(prior, decision))
        throw new Error("No se sobrescribe una decisión anterior.");
      await tx
        .insert(ideaJournal)
        .values({ id: decision.id, data: decision })
        .onConflictDoNothing();
    }
  });
  return {
    definitions: input.definitions.length,
    decisions: input.decisions.length,
  };
}

export async function getIdeaMemory(
  now = new Date(),
  history = false,
  cursor?: { before: string; beforeId: string },
): Promise<IdeaMemoryData> {
  const db = await getDb();
  const cutoff = now.toISOString();
  const assessmentsQuery = history
    ? db
        .select()
        .from(ideaAssessments)
        .where(
          sql`${ideaAssessments.data}->>'asOf' <= ${cutoff} AND ${cursor ? sql`(${cursor.before} > ${ideaAssessments.data}->>'asOf' OR (${cursor.before} = ${ideaAssessments.data}->>'asOf' AND ${cursor.beforeId} > ${ideaAssessments.id}))` : sql`true`}`,
        )
        .orderBy(
          sql`${ideaAssessments.data}->>'asOf' DESC`,
          sql`${ideaAssessments.id} DESC`,
        )
        .limit(101)
    : db
        .selectDistinctOn([sql`${ideaAssessments.data}->>'ideaId'`])
        .from(ideaAssessments)
        .where(sql`${ideaAssessments.data}->>'asOf' <= ${cutoff}`)
        .orderBy(
          sql`${ideaAssessments.data}->>'ideaId'`,
          sql`${ideaAssessments.data}->>'asOf' DESC`,
          sql`${ideaAssessments.id} DESC`,
        );
  const [definitions, journal, assessments, links, checks, totalAssessments] =
    await Promise.all([
      db.select().from(ideaMemory),
      db.select().from(ideaJournal),
      assessmentsQuery,
      db
        .select({ count: sql<number>`count(*)` })
        .from(ideaLinks)
        .where(sql`${ideaLinks.data}->>'classifiedAt' <= ${cutoff}`),
      db
        .select({ count: sql<number>`count(*)` })
        .from(ideaSourceChecks)
        .where(sql`${ideaSourceChecks.data}->>'checkedAt' <= ${cutoff}`),
      db
        .select({ count: sql<number>`count(*)` })
        .from(ideaAssessments)
        .where(sql`${ideaAssessments.data}->>'asOf' <= ${cutoff}`),
    ]);
  const all = assessments
    .map((r) => r.data)
    .filter((a) => Date.parse(a.asOf) <= now.getTime());
  // A pagination cursor must use the database's ordering, not JS locale collation.
  if (!history)
    all.sort(
      (a, b) => b.asOf.localeCompare(a.asOf) || b.id.localeCompare(a.id),
    );
  const seen = new Set<string>();
  return {
    version: MEMORY_VERSION,
    definitions: definitions
      .map((r) =>
        effectiveDefinition(
          r.data,
          journal.map((j) => j.data),
          now,
        ),
      )
      .filter((d) => Date.parse(d.createdAt) <= now.getTime())
      .sort((a, b) => a.id.localeCompare(b.id)),
    decisions: journal
      .map((r) => r.data)
      .filter((d) => Date.parse(d.at) <= now.getTime())
      .sort((a, b) => a.at.localeCompare(b.at)),
    assessments: history
      ? all.slice(0, 100)
      : all.filter((a) => {
          if (seen.has(a.ideaId)) return false;
          seen.add(a.ideaId);
          return true;
        }),
    assessmentCount: Number(totalAssessments[0].count),
    linkedRevisions: Number(links[0].count),
    sourceCheckCount: Number(checks[0].count),
    updatedAt: all[0]?.asOf,
    ...(history
      ? {
          historyPage: {
            limit: 100,
            ...(all.length > 100
              ? { next: { before: all[99].asOf, beforeId: all[99].id } }
              : {}),
          },
        }
      : {}),
  };
}

/** Called by the existing research edition; no finance, external AI or extra scheduler. */
export async function refreshIdeaMemory(
  now = new Date(),
  guard: () => Promise<unknown> = async () => {},
  fetcher?: typeof fetch,
) {
  const db = await getDb();
  const [records, reviews, stored, journal, checks, previousAssessments, news] =
    await Promise.all([
      db.select().from(evidenceRecords),
      db.select().from(evidenceReviews),
      db.select().from(ideaMemory),
      db.select().from(ideaJournal),
      db.select().from(ideaSourceChecks),
      db
        .select({
          ideaId: sql<string>`${ideaAssessments.data}->>'ideaId'`,
          asOf: sql<string>`max(${ideaAssessments.data}->>'asOf')`,
        })
        .from(ideaAssessments)
        .where(sql`${ideaAssessments.data}->>'asOf' <= ${now.toISOString()}`)
        .groupBy(sql`${ideaAssessments.data}->>'ideaId'`),
      db.select().from(stories),
    ]);
  const raw = records.map((r) => r.data),
    decisions = journal.map((r) => r.data),
    human = reviews.map((r) => r.data);
  const definitions = stored
    .map((r) => effectiveDefinition(r.data, decisions, now))
    .filter((d) => Date.parse(d.createdAt) <= now.getTime());
  // Track concrete new groups without displacing the four reviewed hypotheses.
  // Registration is bounded per edition, not by a lifetime history ceiling.
  const registeredScopes = new Set(
    definitions.flatMap((d) => (d.match.scopeKey ? [d.match.scopeKey] : [])),
  );
  const automatic = buildDossiers(raw, human, now)
    .filter(
      (d) =>
        d.scope &&
        isSpecificScope(d.scope) &&
        d.scope.mechanism &&
        !registeredScopes.has(d.scope.key),
    )
    .filter((d) => {
      if (registeredScopes.has(d.scope!.key)) return false;
      registeredScopes.add(d.scope!.key);
      return true;
    })
    .slice(0, 5)
    .map((d): IdeaDefinition => ({
      id: `AUTO-${d.id}`,
      title: d.label,
      hypothesis: `Investigar el mecanismo documentado en ${d.alternatives.join(", ") || "el proceso señalado"}; comprador y solución pendientes.`,
      origin: "automatic",
      createdAt: now.toISOString(),
      match: { scopeKey: d.scope!.key, groups: [] },
      sources: [],
    }));
  definitions.push(...automatic);
  const lastAssessment = new Map<string, string>();
  for (const row of previousAssessments)
    if (
      !lastAssessment.has(row.ideaId) ||
      row.asOf > lastAssessment.get(row.ideaId)!
    )
      lastAssessment.set(row.ideaId, row.asOf);
  const working = [
    ...definitions.filter((d) => d.origin === "review"),
    ...definitions
      .filter((d) => d.origin === "automatic")
      .sort(
        (a, b) =>
          (lastAssessment.get(a.id) ?? "").localeCompare(
            lastAssessment.get(b.id) ?? "",
          ) || a.id.localeCompare(b.id),
      )
      .slice(0, 40),
  ];
  const links = working.flatMap((idea) => [
    ...linkIdeaEvidence(idea, raw, human, decisions, now),
    ...news.flatMap((row) => {
      const link = classifyStoryContext(idea, row.data, now);
      return link ? [link] : [];
    }),
  ]);
  const sources: IdeaSource[] = [
    ...working.flatMap((d) => d.sources),
    ...links
      .filter(
        (l) =>
          ["problem", "historical", "closed-unverified", "resolved"].includes(
            l.quality,
          ) && /^https:\/\/github\.com\/.+\/issues\/\d+$/.test(l.url),
      )
      .map((l) => ({ url: l.url, kind: "issue" as const })),
    ...checks
      .filter((c) => c.data.kind === "issue")
      .map((c) => ({ url: c.data.url, kind: "issue" as const })),
  ];
  const fresh =
    process.env.NODE_ENV === "test" && !fetcher
      ? []
      : await refreshMemorySources(
          sources,
          checks.map((r) => r.data),
          now,
          guard,
          fetcher,
        );
  const allChecks = [...checks.map((r) => r.data), ...fresh];
  const assessments = working.map((idea) =>
    assessIdea(idea, links, allChecks, decisions, now),
  );
  await guard();
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7202634)`);
    for (const data of automatic)
      await tx
        .insert(ideaMemory)
        .values({ id: data.id, data })
        .onConflictDoNothing();
    for (const data of fresh)
      await tx
        .insert(ideaSourceChecks)
        .values({ id: data.id, data })
        .onConflictDoNothing();
    const known = new Set(
      (await tx.select({ id: ideaLinks.id }).from(ideaLinks)).map((r) => r.id),
    );
    const pendingLinks = links.filter((data) => !known.has(data.id));
    for (let index = 0; index < pendingLinks.length; index += 100)
      await tx
        .insert(ideaLinks)
        .values(
          pendingLinks
            .slice(index, index + 100)
            .map((data) => ({ id: data.id, data })),
        )
        .onConflictDoNothing();
    if (assessments.length)
      await tx
        .insert(ideaAssessments)
        .values(assessments.map((data) => ({ id: data.id, data })))
        .onConflictDoNothing();
  });
  return getIdeaMemory(now);
}
