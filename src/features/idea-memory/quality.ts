import { hash } from "@/features/news/normalize";
import { problemContext } from "@/features/evidence/engine";
import {
  evidenceCaseKey,
  evidenceFamily,
  latestEvidenceVersions,
} from "@/features/evidence/versions";
import {
  authoredText,
  normalizedText,
} from "@/features/research/evidence-text";
import {
  isEditorialReflection,
  isSelfPromotion,
} from "@/features/research/content-quality";
import type { EvidenceRecord, EvidenceReview } from "@/features/evidence/types";
import {
  MEMORY_VERSION,
  type IdeaDefinition,
  type IdeaDecision,
  type IdeaEvidence,
} from "./types";
import type { Story } from "@/lib/types";

const contexts = new WeakMap<
  EvidenceRecord,
  ReturnType<typeof problemContext>
>();
const contextFor = (record: EvidenceRecord) => {
  let value = contexts.get(record);
  if (!value) {
    value = problemContext(record);
    contexts.set(record, value);
  }
  return value;
};

/** News is context, never a customer's independent statement. */
export function classifyStoryContext(
  idea: IdeaDefinition,
  story: Story,
  now: Date,
): IdeaEvidence | undefined {
  if (
    ["comment", "question"].includes(story.kind ?? "news") ||
    idea.match.scopeKey ||
    ![story.publishedAt, story.detectedAt].every(
      (at) =>
        Number.isFinite(Date.parse(at)) && Date.parse(at) <= now.getTime(),
    )
  )
    return;
  const record: EvidenceRecord = {
    id: story.id,
    externalId: story.id,
    source: "hn",
    sourceName: story.sourceName,
    url: story.url,
    title: story.originalTitle ?? story.title,
    quote: story.excerpt,
    occurredAt: story.publishedAt,
    capturedAt: story.detectedAt,
    language: "unknown",
    kind: "community",
  };
  if (!matchesIdea(idea, record)) return;
  return {
    id: hash(
      `${MEMORY_VERSION}:${idea.id}:news:${story.id}:${story.contentHash}`,
    ),
    ideaId: idea.id,
    recordId: `news:${story.id}:${story.contentHash}`,
    caseKey: `news:${story.id}`,
    url: canonicalSourceUrl(story.url),
    quote: story.excerpt.slice(0, 1200),
    title: record.title,
    sourceFamily: `news:${story.sourceId}`,
    kind: "news",
    occurredAt: story.publishedAt,
    capturedAt: story.detectedAt,
    classifiedAt: now.toISOString(),
    mechanism: `context:${story.id}`,
    quality: "context",
    reasons: [
      "Noticia/contexto editorial; no se cuenta como queja ni cliente independiente.",
    ],
    fields: {},
  };
}

/** Normalize only identity/tracking. Distinct issue URLs remain distinct cases. */
export function canonicalSourceUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return value;
    for (const key of [...url.searchParams.keys()])
      if (/^(utm_|tl$|ref$|trk$|email_)/i.test(key))
        url.searchParams.delete(key);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}
const contains = (text: string, term: string) => {
  const escaped = normalizedText(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(text);
};
export function matchesIdea(idea: IdeaDefinition, record: EvidenceRecord) {
  const text = normalizedText(
    `${record.title} ${authoredText(record.quote)} ${record.issue ?? ""} ${record.product ?? ""}`,
  );
  if (idea.match.scopeKey)
    return contextFor(record).scope?.key === idea.match.scopeKey;
  return idea.match.groups.some(
    (group) => group.length >= 2 && group.every((term) => contains(text, term)),
  );
}
export function classifyIdeaEvidence(
  idea: IdeaDefinition,
  record: EvidenceRecord,
  reviews: EvidenceReview[],
  decisions: IdeaDecision[],
  now: Date,
  retainEarlierMatch = false,
): IdeaEvidence | undefined {
  const matches = matchesIdea(idea, record);
  if (
    ![record.occurredAt, record.capturedAt].every(
      (date) =>
        Number.isFinite(Date.parse(date)) && Date.parse(date) <= now.getTime(),
    ) ||
    (!matches && !retainEarlierMatch)
  )
    return;
  const review = reviews
    .filter((r) => r.id === record.id && Date.parse(r.at) <= now.getTime())
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  const applicable = decisions.filter(
    (d) => d.ideaId === idea.id && Date.parse(d.at) <= now.getTime(),
  );
  const excluded = applicable.some(
    (d) =>
      d.excludedAuthors.includes(record.authorKey ?? "") ||
      d.excludedUrls.some(
        (url) => canonicalSourceUrl(url) === canonicalSourceUrl(record.url),
      ),
  );
  const own = authoredText(record.quote);
  const context = contextFor(record);
  const old = Date.parse(record.occurredAt) < now.getTime() - 30 * 86400000;
  const quality =
    review && review.decision !== "useful"
      ? "rejected"
      : record.kind === "statistic"
        ? "statistic"
        : excluded || isSelfPromotion(own)
          ? "promotion"
          : context.correction
            ? "resolved"
            : !matches ||
                /\/pull\/\d+(?:$|[?#])/.test(record.url) ||
                isEditorialReflection(own) ||
                !context.accepted ||
                !context.fields.obstacle
              ? "context"
              : record.caseStatus === "closed"
                ? "closed-unverified"
                : old
                  ? "historical"
                  : "problem";
  const fields: IdeaEvidence["fields"] = {};
  for (const key of ["frequency", "consequence", "workaround"] as const)
    if (context.fields[key]) fields[key] = context.fields[key]!.quote;
  // A potential role/task is not willingness to pay. Retain only the explicit sentence.
  const buyer = own
    .split(/(?<=[.!?])\s+/)
    .find((sentence) =>
      /\b(?:we bill (?:our )?(?:customers|clients)|i (?:run|own) (?:an? )?(?:agency|business)|our clients|nuestros clientes|cobramos a|soy (?:dueno|encargado))\b/i.test(
        normalizedText(sentence),
      ),
    );
  if (buyer) fields.buyer = buyer.slice(0, 500);
  return {
    id: hash(
      `${MEMORY_VERSION}:${idea.id}:${record.id}:${quality}:${review?.at ?? ""}`,
    ),
    ideaId: idea.id,
    recordId: record.id,
    revision: record.revision,
    caseKey: evidenceCaseKey(record),
    url: canonicalSourceUrl(record.url),
    quote: own.slice(0, 1200),
    title: record.title,
    sourceFamily: evidenceFamily(record.source),
    kind: record.kind,
    authorKey: record.authorKey,
    country: record.country,
    occurredAt: record.occurredAt,
    ...(record.dateBasis ? { dateBasis: record.dateBasis } : {}),
    capturedAt: record.capturedAt,
    classifiedAt: now.toISOString(),
    mechanism:
      context.scope?.mechanism && context.scope
        ? context.scope.key
        : `isolated:${evidenceCaseKey(record)}`,
    mechanismLabel: context.scope?.label,
    quality,
    reasons: [
      quality === "problem"
        ? "Obstáculo explícito reciente; cuenta/caso no verificado comercialmente."
        : {
            historical: "Antecedente de más de treinta días.",
            resolved: "La captura declara resolución.",
            "closed-unverified": "Cerrado sin resolución comprobada.",
            promotion:
              "Autor o publicación promociona una solución; no cuenta como demanda independiente.",
            context: "Contexto sin obstáculo propio suficientemente concreto.",
            statistic: "Agregado estadístico; no cuenta como persona.",
            rejected: "Evaluación humana excluye este registro.",
          }[quality],
    ],
    fields,
  };
}

/** Later revisions can remove an earlier match; keep history, not stale demand. */
export function linkIdeaEvidence(
  idea: IdeaDefinition,
  records: EvidenceRecord[],
  reviews: EvidenceReview[],
  decisions: IdeaDecision[],
  now: Date,
) {
  const eligible = records.filter((r) =>
    [r.occurredAt, r.capturedAt].every(
      (at) =>
        Number.isFinite(Date.parse(at)) && Date.parse(at) <= now.getTime(),
    ),
  );
  const links = eligible.flatMap((r) => {
    const link = classifyIdeaEvidence(idea, r, reviews, decisions, now);
    return link ? [link] : [];
  });
  const linkedCases = new Set(links.map((l) => l.caseKey));
  const linkedRecords = new Set(links.map((l) => l.recordId));
  for (const record of latestEvidenceVersions(eligible)) {
    if (
      !linkedCases.has(evidenceCaseKey(record)) ||
      linkedRecords.has(record.id)
    )
      continue;
    const link = classifyIdeaEvidence(
      idea,
      record,
      reviews,
      decisions,
      now,
      true,
    );
    if (link)
      links.push({
        ...link,
        reasons: [
          ...link.reasons,
          "La revisión más reciente sustituye el vínculo anterior aunque haya dejado de coincidir con la hipótesis.",
        ],
      });
  }
  return links;
}
