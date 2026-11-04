import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getDb, resultRows } from "@/db/client";
import { businessNews, businessNewsSources } from "@/db/schema";
import {
  collectBusinessNews,
  MAX_BUSINESS_RECORDS,
  persistBusinessBatch,
  readBusinessExport,
} from "@/features/business-news/service";
import {
  businessFeeds,
  parseBusinessFeed,
} from "@/features/business-news/feeds";
const now = new Date("2026-11-04T22:00:00Z");
async function sample() {
  return (
    await parseBusinessFeed(
      '<rss version="2.0"><channel><title>Fuente</title><item><title>Flying Tiger invertirá en México para abrir tiendas</title><link>https://expansion.mx/empresas/tiger</link><pubDate>Wed, 04 Nov 2026 20:00:00 GMT</pubDate></item></channel></rss>',
      businessFeeds[1],
      now,
    )
  )[0];
}
beforeEach(async () => {
  if (process.env.DATABASE_URL)
    throw new Error("Usar sólo base de pruebas local.");
  const db = await getDb();
  await db.delete(businessNews);
  await db.delete(businessNewsSources);
  await db.execute(sql`DELETE FROM leases WHERE name='business-news'`);
});
describe("persistencia empresarial aislada", () => {
  it("una captura tardía con observedAt antiguo queda fuera del snapshot ya abierto", async () => {
    const n = await sample();
    await persistBusinessBatch([
      n,
      { ...n, id: "second", revisionId: "second" },
    ]);
    const first = await readBusinessExport({ limit: 1 }, "unit-only", now);
    await persistBusinessBatch([
      {
        ...n,
        id: "late",
        revisionId: "late",
        observedAt: "2026-11-04T19:00:00.000Z",
      },
    ]);
    const second = await readBusinessExport(
      { limit: 1, cursor: first.nextCursor! },
      "unit-only",
      now,
    );
    expect(second.items.map((r) => r.id)).toEqual(["second"]);
    expect(second.nextCursor).toBeNull();
    expect(
      (await readBusinessExport({ limit: 10 }, "unit-only", now)).items,
    ).toHaveLength(3);
    expect(JSON.stringify(first)).not.toContain("archiveSequence");
  });
  it("repetir una captura no duplica ni sobrescribe; una revisión conserva la anterior", async () => {
    const n = await sample();
    expect((await persistBusinessBatch([n])).added).toBe(1);
    expect(
      (await persistBusinessBatch([{ ...n, title: "No sobrescribir" }])).added,
    ).toBe(0);
    expect(
      (
        await persistBusinessBatch([
          {
            ...n,
            revisionId: "newrevision",
            contentHash: "newhash",
            title: "Revisión posterior",
          },
        ])
      ).added,
    ).toBe(1);
    const rows = await (await getDb()).select().from(businessNews);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === n.revisionId)?.data.title).toBe(n.title);
    const page = await readBusinessExport(
      { limit: 1, country: "MX" },
      "unit-only",
      now,
    );
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeTruthy();
    expect(page.items[0]).not.toHaveProperty("excerpt");
  });
  it("una fuente fallida conserva el archivo y deja que las demás terminen; respeta enfriamiento", async () => {
    const n = await sample();
    await persistBusinessBatch([n]);
    let calls = 0;
    const loader = async (s: (typeof businessFeeds)[number]) => {
      calls++;
      if (s.id === "mx-economista")
        throw new Error("private-secret-DO-NOT-EXPORT");
      return [{ ...n, revisionId: s.id, sourceId: s.id }];
    };
    const first = await collectBusinessNews(now, loader);
    expect(first.states.filter((s) => s.status === "error")).toHaveLength(1);
    expect(JSON.stringify(first)).not.toContain("private-secret");
    expect(first.states.filter((s) => s.status === "ok")).toHaveLength(2);
    await collectBusinessNews(new Date(now.getTime() + 3600000), loader);
    expect(calls).toBe(3);
    expect(await (await getDb()).select().from(businessNews)).toHaveLength(3);
  });
  it("el lease propio evita dos recopilaciones simultáneas", async () => {
    let started!: () => void;
    const begun = new Promise<void>((r) => {
      started = r;
    });
    let release!: () => void;
    const held = new Promise<void>((r) => {
      release = r;
    });
    const first = collectBusinessNews(now, async () => {
      started();
      await held;
      return [];
    });
    await begun;
    try {
      expect((await collectBusinessNews(now, async () => [])).skipped).toBe(
        true,
      );
    } finally {
      release();
      await first;
    }
  });
  it("al alcanzar capacidad conserva todas las filas y no activa crecimiento ni borrado", async () => {
    const db = await getDb();
    await db.execute(
      sql`INSERT INTO business_news(id,data) SELECT 'retained-'||i,jsonb_build_object('retained',true) FROM generate_series(1,${MAX_BUSINESS_RECORDS}) i`,
    );
    const result = await persistBusinessBatch([await sample()]);
    expect(result).toMatchObject({ added: 0, blocked: true, warning: true });
    const [row] = resultRows(
      await db.execute(sql`SELECT count(*)::int AS count FROM business_news`),
    ) as { count: number }[];
    expect(row.count).toBe(MAX_BUSINESS_RECORDS);
  });
});
