import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { opportunities, opportunityEvents } from "@/db/schema";
import { hash } from "@/features/news/normalize";
import type { Opportunity, OpportunityEvent } from "@/lib/types";

type Writer = Pick<Awaited<ReturnType<typeof getDb>>, "select" | "insert">;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
const content = (idea: Opportunity) =>
  JSON.stringify(canonical({ ...idea, createdAt: "" }));

export async function recordOpportunity(
  db: Writer,
  idea: Opportunity,
  at: string,
) {
  const old = (
    await db.select().from(opportunities).where(eq(opportunities.id, idea.id))
  )[0]?.data;
  const history = (
    await db
      .select()
      .from(opportunityEvents)
      .where(sql`${opportunityEvents.data}->>'opportunityId' = ${idea.id}`)
      .limit(1)
  )[0];
  const append = async (
    snapshot: Opportunity,
    kind: OpportunityEvent["kind"],
    when: string,
  ) => {
    const event: OpportunityEvent = {
      id: hash(`${idea.id}:${when}:${content(snapshot)}`),
      opportunityId: idea.id,
      kind,
      at: when,
      idea: snapshot,
    };
    await db
      .insert(opportunityEvents)
      .values({ id: event.id, data: event })
      .onConflictDoNothing();
  };
  if (old && !history) await append(old, "discovered", old.createdAt);
  const data = { ...idea, createdAt: old?.createdAt ?? idea.createdAt };
  if (!old || content(old) !== content(data)) {
    await append(data, old ? "updated" : "discovered", at);
    await db
      .insert(opportunities)
      .values({ id: data.id, data })
      .onConflictDoUpdate({ target: opportunities.id, set: { data } });
  }
}
