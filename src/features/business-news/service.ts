import { sql, eq } from "drizzle-orm";
import { getDb, resultRows } from "@/db/client";
import { businessNews, businessNewsSources, leases } from "@/db/schema";
import { randomUUID } from "node:crypto";
import { businessFeeds, loadBusinessFeed, type BusinessFeed } from "./feeds";
import { exportPage, exportWindow, type ExportQuery } from "./export";
import type {
  ArchivedBusinessNews,
  BusinessNews,
  BusinessSourceState,
} from "./types";

export const MAX_BUSINESS_RECORDS = 20_000;
export const MAX_BUSINESS_BYTES = 16_000_000;
export async function persistBusinessBatch(records: BusinessNews[]) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('business-news-capacity'))`,
    );
    const [metrics] = resultRows(
      await tx.execute(
        sql`SELECT count(*)::int AS count, coalesce(sum(octet_length(data::text)),0)::bigint AS bytes, coalesce(max((data->>'archiveSequence')::bigint),0) AS sequence FROM business_news`,
      ),
    ) as { count: number; bytes: string; sequence: string }[];
    let count = Number(metrics.count),
      bytes = Number(metrics.bytes),
      sequence = Number(metrics.sequence),
      added = 0,
      blocked = false;
    for (const record of records) {
      if (
        (
          await tx
            .select({ id: businessNews.id })
            .from(businessNews)
            .where(eq(businessNews.id, record.revisionId))
        ).length
      )
        continue;
      // PostgreSQL jsonb adds whitespace; reserve beyond compact JSON's byte count.
      const size = Buffer.byteLength(JSON.stringify(record)) + 1024;
      if (count >= MAX_BUSINESS_RECORDS || bytes + size > MAX_BUSINESS_BYTES) {
        blocked = true;
        break;
      }
      const inserted = await tx
        .insert(businessNews)
        .values({
          id: record.revisionId,
          data: { ...record, archiveSequence: sequence + 1 },
        })
        .onConflictDoNothing()
        .returning({ id: businessNews.id });
      if (inserted.length) {
        added++;
        count++;
        sequence++;
        bytes += size;
      }
    }
    return {
      added,
      blocked,
      warning:
        count >= MAX_BUSINESS_RECORDS * 0.7 ||
        bytes >= MAX_BUSINESS_BYTES * 0.7,
    };
  });
}
export async function collectBusinessNews(
  now = new Date(),
  loader: (
    source: BusinessFeed,
    now: Date,
  ) => Promise<BusinessNews[]> = loadBusinessFeed,
) {
  const db = await getDb();
  const token = randomUUID();
  const acquired = resultRows(
    await db.execute(
      sql`INSERT INTO leases (name,token,expires_at) VALUES ('business-news',${token},NOW()+INTERVAL '5 minutes') ON CONFLICT (name) DO UPDATE SET token=EXCLUDED.token,expires_at=EXCLUDED.expires_at WHERE leases.expires_at<NOW() RETURNING token`,
    ),
  );
  if (!acquired.length) return { skipped: true, states: [] };
  try {
    const old = (await db.select().from(businessNewsSources)).map(
      (r) => r.data,
    );
    const due = businessFeeds.filter(
      (source) =>
        !old.some(
          (s) =>
            s.id === source.id && Date.parse(s.nextCheckAt) > now.getTime(),
        ),
    );
    const states = await Promise.all(
      due.map(async (source) => {
        const base = {
          id: source.id,
          name: source.name,
          checkedAt: now.toISOString(),
          nextCheckAt: new Date(now.getTime() + 6 * 3600000).toISOString(),
        };
        let state: BusinessSourceState;
        try {
          const records = await loader(source, now);
          const result = await persistBusinessBatch(records);
          state = {
            ...base,
            status: result.blocked ? "capacity" : "ok",
            received: records.length,
            added: result.added,
            message: result.blocked
              ? "Capacidad alcanzada; se conserva todo el archivo. No se activan cobros."
              : result.warning
                ? "Archivo sobre 70% del margen; revisar espacio. No se borran datos."
                : "RSS acotado; fechas declaradas por la fuente, sin artículos completos ni intención de compra inferida.",
          };
        } catch {
          state = {
            ...base,
            status: "error",
            received: 0,
            added: 0,
            message:
              "No se pudo actualizar esta fuente. Se conserva el archivo anterior; reintento en el siguiente ciclo disponible.",
          };
        }
        await db
          .insert(businessNewsSources)
          .values({ id: source.id, data: state })
          .onConflictDoUpdate({
            target: businessNewsSources.id,
            set: { data: state },
          });
        return state;
      }),
    );
    return { skipped: false, states };
  } finally {
    await db
      .delete(leases)
      .where(sql`${leases.name}='business-news' AND ${leases.token}=${token}`);
  }
}
export async function collectBusinessNewsSafely() {
  try {
    await collectBusinessNews();
  } catch {
    /* This separate archive must never block the existing edition or its research. */
  }
}
export async function readBusinessExport(
  query: ExportQuery,
  key: string,
  now = new Date(),
) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    // Same lock as inserts: snapshot high-water is chosen after all preceding writes commit.
    // In-flight fetches receive a higher sequence when they eventually persist.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('business-news-capacity'))`,
    );
    const [highWater] = resultRows(
      await tx.execute(
        sql`SELECT coalesce(max((data->>'archiveSequence')::bigint),0) AS sequence FROM business_news`,
      ),
    ) as { sequence: string }[];
    const sequence = Number(highWater.sequence);
    const window = exportWindow(query, key, now, sequence);
    const conditions = [
      sql`(data->>'archiveSequence')::bigint <= ${window.snapshotSequence}`,
      sql`(data->>'archiveSequence')::bigint > ${window.lastSequence ?? 0}`,
    ];
    if (query.publishedFrom)
      conditions.push(sql`data->>'publishedAt' >= ${query.publishedFrom}`);
    if (query.publishedTo)
      conditions.push(sql`data->>'publishedAt' < ${query.publishedTo}`);
    if (query.sourceId)
      conditions.push(sql`data->>'sourceId' = ${query.sourceId}`);
    if (query.country)
      conditions.push(
        sql`data->'countryEvidence'->>'country' = ${query.country}`,
      );
    if (query.topic) conditions.push(sql`data->'topics' ? ${query.topic}`);
    const rows = resultRows(
      await tx.execute(
        sql`SELECT data FROM business_news WHERE ${sql.join(conditions, sql` AND `)} ORDER BY (data->>'archiveSequence')::bigint LIMIT ${query.limit + 1}`,
      ),
    ) as { data: ArchivedBusinessNews }[];
    const sources = (await tx.select().from(businessNewsSources)).map(
      ({ data: s }) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        checkedAt: s.checkedAt,
        nextCheckAt: s.nextCheckAt,
        received: s.received,
        added: s.added,
        message: s.message,
      }),
    );
    return {
      ...exportPage(
        rows.map((r) => r.data),
        query,
        key,
        now,
        sequence,
      ),
      sources,
    };
  });
}
