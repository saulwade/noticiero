import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb, resultRows } from "@/db/client";
import { leases } from "@/db/schema";
export const alphaSlotName = "alpha-vantage-request-slot";
type Timing = { clock?: () => Date; wait?: (ms: number) => Promise<void> };
type Reservation =
  | { status: "granted"; token: string }
  | { status: "busy" }
  | { status: "quota" };

// Reserve one request owner, not a future timestamp: slow DB/worker dispatch must
// never compress multiple requests into a burst. Network and sleep stay outside transactions.
export async function acquireAlphaRequest(
  clock?: () => Date,
): Promise<Reservation> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7202634)`);
    const time =
      clock?.() ??
      (
        resultRows(await tx.execute(sql`SELECT clock_timestamp() AS at`)) as {
          at: Date;
        }[]
      )[0].at;
    const now = time instanceof Date ? time : new Date(time);
    const previous = (
      await tx.select().from(leases).where(eq(leases.name, alphaSlotName))
    )[0];
    if (previous && previous.expiresAt.getTime() > now.getTime())
      return { status: "busy" };
    const day = now.toISOString().slice(0, 10);
    const budget = await tx.execute(
      sql`INSERT INTO usage(key,amount) VALUES (${`quote:${day}`},1) ON CONFLICT(key) DO UPDATE SET amount=usage.amount+1 WHERE usage.amount<20 RETURNING key`,
    );
    if (!resultRows(budget).length) return { status: "quota" };
    const slot = {
      name: alphaSlotName,
      token: randomUUID(),
      expiresAt: new Date(now.getTime() + 60_000),
    };
    await tx
      .insert(leases)
      .values(slot)
      .onConflictDoUpdate({ target: leases.name, set: slot });
    return { status: "granted", token: slot.token };
  });
}
export async function releaseAlphaRequest(token: string, clock?: () => Date) {
  const db = await getDb();
  const at = clock?.();
  if (at)
    await db.execute(
      sql`UPDATE leases SET expires_at=${new Date(at.getTime() + 1500).toISOString()}::timestamptz WHERE name=${alphaSlotName} AND token=${token}`,
    );
  else
    await db.execute(
      sql`UPDATE leases SET expires_at=clock_timestamp()+INTERVAL '1500 milliseconds' WHERE name=${alphaSlotName} AND token=${token}`,
    );
}
export const waitForAlphaSlot = async (ms: number) => {
  if (ms > 0) await new Promise<void>((resolve) => setTimeout(resolve, ms));
};
export async function withAlphaRequest<T>(
  request: () => Promise<T>,
  timing: Timing = {},
): Promise<{ ok: true; value: T } | { ok: false }> {
  const deadline = Date.now() + 30_000;
  for (let attempt = 0; attempt <= 20; attempt++) {
    const reservation = await acquireAlphaRequest(timing.clock);
    if (reservation.status === "quota") return { ok: false };
    if (reservation.status === "busy") {
      if (attempt === 20 || Date.now() >= deadline) return { ok: false };
      await (timing.wait ?? waitForAlphaSlot)(1500);
      continue;
    }
    try {
      return { ok: true, value: await request() };
    } finally {
      await releaseAlphaRequest(reservation.token, timing.clock);
    }
  }
  return { ok: false };
}
