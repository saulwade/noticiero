import { sql } from "drizzle-orm";
import { getDb, resultRows } from "@/db/client";
type Executor = Pick<Awaited<ReturnType<typeof getDb>>, "execute">;
export async function assertFinanceCapacity(db: Executor) {
  const rows = resultRows(
    await db.execute(sql`SELECT COALESCE(sum(octet_length(data::text)),0)::bigint AS n FROM (
  SELECT data FROM finance_profiles UNION ALL SELECT data FROM finance_histories UNION ALL SELECT data FROM finance_automation_inputs UNION ALL SELECT data FROM finance_analyses UNION ALL SELECT data FROM finance_marks UNION ALL SELECT data FROM finance_instruments UNION ALL SELECT data FROM finance_movements UNION ALL SELECT data FROM finance_policies UNION ALL SELECT data FROM finance_theses UNION ALL SELECT data FROM finance_decisions UNION ALL SELECT data FROM finance_research UNION ALL SELECT data FROM finance_sync UNION ALL SELECT data FROM finance_news_events UNION ALL SELECT data FROM finance_news_reviews UNION ALL SELECT data FROM finance_news_briefs
 ) archive`),
  ) as { n: string | number }[];
  if (Number(rows[0]?.n ?? 0) > 50_000_000)
    throw new Error(
      "Archivo financiero completo. Se conserva el historial; exporta antes de ampliar capacidad.",
    );
}
