import { sql } from "drizzle-orm";
import { getDb, resultRows } from "@/db/client";
import { usage } from "@/db/schema";
import { eq } from "drizzle-orm";
export function monthKey(date = new Date()) {
  return `ai:${date.toISOString().slice(0, 7)}`;
}
export async function usedBudget() {
  const db = await getDb();
  return (
    (await db.select().from(usage).where(eq(usage.key, monthKey())))[0]
      ?.amount ?? 0
  );
}
export async function reserveBudget(
  amount: number,
  limit: number,
): Promise<boolean> {
  if (!Number.isFinite(amount) || amount < 0 || amount > limit) return false;
  const db = await getDb();
  const result = await db.execute(
    sql`INSERT INTO usage(key, amount) VALUES (${monthKey()}, ${amount}) ON CONFLICT(key) DO UPDATE SET amount = usage.amount + ${amount} WHERE usage.amount + ${amount} <= ${limit} RETURNING key`,
  );
  return resultRows(result).length > 0;
}
export async function settleBudget(reserved: number, actual: number) {
  // Never release a reservation after an ambiguous provider failure: it may have billed.
  const db = await getDb();
  await db.execute(
    sql`UPDATE usage SET amount = GREATEST(0, amount + ${Math.max(0, actual) - reserved}) WHERE key = ${monthKey()}`,
  );
}
