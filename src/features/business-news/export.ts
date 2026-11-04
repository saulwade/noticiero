import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hash } from "@/features/news/normalize";
import { businessFeeds } from "./feeds";
import {
  businessTopics,
  type ArchivedBusinessNews,
  type BusinessNews,
  type BusinessTopic,
} from "./types";

export type ExportQuery = {
  limit: number;
  publishedFrom?: string;
  publishedTo?: string;
  sourceId?: string;
  country?: "MX";
  topic?: BusinessTopic;
  cursor?: string;
};
const queryKeys = new Set([
  "limit",
  "publishedFrom",
  "publishedTo",
  "sourceId",
  "country",
  "topic",
  "cursor",
]);
const localCursorKey = randomBytes(32).toString("hex");
export function cursorKey() {
  return (
    process.env.NEWS_EXPORT_SECRET || process.env.AUTH_SECRET || localCursorKey
  );
}
export function verifyNewsSecret(
  header: string | null,
  secret = process.env.NEWS_EXPORT_SECRET ?? "",
) {
  if (secret.length < 32 || !header || header.length > 1024) return false;
  const actual = Buffer.from(header),
    expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function date(value: string | null) {
  if (value === null) return;
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(value))
    throw new Error("Fecha ISO requerida.");
  const parsed = new Date(value);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value.slice(0, 10)
  )
    throw new Error("Fecha inválida.");
  return parsed.toISOString();
}
export function parseExportQuery(params: URLSearchParams): ExportQuery {
  for (const key of params.keys())
    if (!queryKeys.has(key) || params.getAll(key).length !== 1)
      throw new Error("Parámetro no permitido.");
  const limit = params.get("limit") ?? "50";
  if (!/^\d{1,3}$/.test(limit) || Number(limit) < 1 || Number(limit) > 100)
    throw new Error("Límite de 1 a 100.");
  const sourceId = params.get("sourceId") ?? undefined;
  const topic = params.get("topic") ?? undefined;
  const country = params.get("country") ?? undefined;
  if (sourceId !== undefined && !businessFeeds.some((s) => s.id === sourceId))
    throw new Error("Fuente desconocida.");
  if (topic !== undefined && !businessTopics.includes(topic as BusinessTopic))
    throw new Error("Tema desconocido.");
  if (country !== undefined && country !== "MX")
    throw new Error("País no permitido.");
  const publishedFrom = date(params.get("publishedFrom")),
    publishedTo = date(params.get("publishedTo"));
  if (publishedFrom && publishedTo && publishedFrom >= publishedTo)
    throw new Error("Rango de fechas inválido.");
  const cursor = params.get("cursor") ?? undefined;
  if (cursor !== undefined && (!cursor || cursor.length > 2048))
    throw new Error("Cursor inválido.");
  return {
    limit: Number(limit),
    publishedFrom,
    publishedTo,
    sourceId,
    topic: topic as BusinessTopic | undefined,
    country: country as "MX" | undefined,
    cursor,
  };
}
type Window = {
  asOf: string;
  snapshotSequence: number;
  lastSequence?: number;
  filterHash: string;
};
function filterHash(query: ExportQuery) {
  return hash(
    JSON.stringify({
      limit: query.limit,
      publishedFrom: query.publishedFrom,
      publishedTo: query.publishedTo,
      sourceId: query.sourceId,
      country: query.country,
      topic: query.topic,
    }),
  );
}
function signature(payload: string, key: string) {
  return createHmac("sha256", key).update(payload).digest("base64url");
}
function encode(window: Window, key: string) {
  const raw = Buffer.from(JSON.stringify(window)).toString("base64url");
  return `${raw}.${signature(raw, key)}`;
}
export function exportWindow(
  query: ExportQuery,
  key: string,
  now = new Date(),
  snapshotSequence = 0,
): Window {
  if (!query.cursor)
    return {
      asOf: now.toISOString(),
      snapshotSequence,
      filterHash: filterHash(query),
    };
  const parts = query.cursor.split(".");
  if (parts.length !== 2 || !/^[\w-]+$/.test(parts[0]))
    throw new Error("Cursor inválido.");
  const expected = Buffer.from(signature(parts[0], key)),
    actual = Buffer.from(parts[1]);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("Cursor inválido.");
  let w: Window;
  try {
    w = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    throw new Error("Cursor inválido.");
  }
  const at = Date.parse(w.asOf);
  if (
    !Number.isFinite(at) ||
    at > now.getTime() ||
    now.getTime() - at > 86400_000 ||
    w.filterHash !== filterHash(query) ||
    !Number.isSafeInteger(w.snapshotSequence) ||
    w.snapshotSequence < 0 ||
    !Number.isSafeInteger(w.lastSequence) ||
    w.lastSequence! < 1 ||
    w.lastSequence! > w.snapshotSequence
  )
    throw new Error("Cursor caducado o filtros distintos.");
  return w;
}
// Deliberate projection. Do not replace with a spread of stored data or DashboardData.
export function publicNews(n: BusinessNews): BusinessNews {
  return {
    id: n.id,
    revisionId: n.revisionId,
    canonicalUrl: n.canonicalUrl,
    originalUrl: n.originalUrl,
    title: n.title,
    sourceId: n.sourceId,
    sourceName: n.sourceName,
    publishedAt: n.publishedAt,
    observedAt: n.observedAt,
    queriedAt: n.queriedAt,
    contentHash: n.contentHash,
    countryEvidence: n.countryEvidence
      ? {
          country: "MX",
          basis: "explicit_mention",
          mention: n.countryEvidence.mention,
        }
      : null,
    companyEvidence: n.companyEvidence.map((c) => ({
      name: c.name,
      basis: "text_mention",
    })),
    topics: n.topics.filter((t) => businessTopics.includes(t)),
    briefParaphrase: n.briefParaphrase,
    summaryMethod: "headline_context_rules",
    dateProvenance: "feed_declared",
    buyingIntent: "unknown",
  };
}
export function exportPage(
  records: ArchivedBusinessNews[],
  query: ExportQuery,
  key: string,
  now = new Date(),
  snapshotSequence = Math.max(0, ...records.map((n) => n.archiveSequence)),
) {
  const window = exportWindow(query, key, now, snapshotSequence);
  const eligible = records
    .filter(
      (n) =>
        n.archiveSequence <= window.snapshotSequence &&
        n.archiveSequence > (window.lastSequence ?? 0) &&
        (!query.publishedFrom || n.publishedAt >= query.publishedFrom) &&
        (!query.publishedTo || n.publishedAt < query.publishedTo) &&
        (!query.sourceId || n.sourceId === query.sourceId) &&
        (!query.country || n.countryEvidence?.country === query.country) &&
        (!query.topic || n.topics.includes(query.topic)),
    )
    .sort((a, b) => a.archiveSequence - b.archiveSequence);
  const items = eligible.slice(0, query.limit).map(publicNews);
  const last = eligible.slice(0, query.limit).at(-1);
  return {
    schemaVersion: "noticiero-business-news-v1",
    exportedAt: now.toISOString(),
    snapshotAt: window.asOf,
    items,
    nextCursor:
      eligible.length > query.limit && last
        ? encode({ ...window, lastSequence: last.archiveSequence }, key)
        : null,
    coverage: {
      scope: "separate_mexican_business_feeds",
      articleBodies: false,
      images: false,
      summaryMethod: "headline_context_rules",
      buyingIntent: "unknown",
      countryBasis: "explicit_text_mention_only",
      publicationDates: "feed_declared_not_independently_verified",
      reuse:
        "Links, attribution and rule-based context only; source rights remain with the publisher.",
    },
  };
}
