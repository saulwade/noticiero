import { beforeEach, describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { leases, usage } from "@/db/schema";
import {
  alphaSlotName,
  acquireAlphaRequest,
  releaseAlphaRequest,
  withAlphaRequest,
} from "@/features/market/request-budget";
const now = new Date("2026-10-31T04:00:00Z");
beforeEach(async () => {
  const db = await getDb();
  await db.delete(usage);
  await db.delete(leases).where(eq(leases.name, alphaSlotName));
});
describe("cuota y ritmo gratuitos compartidos", () => {
  it("usa el reloj de PostgreSQL y libera el turno real sin reloj simulado", async () => {
    const before = Date.now();
    const result = await withAlphaRequest(async () => 42);
    expect(result).toEqual({ ok: true, value: 42 });
    const rows = await (
      await getDb()
    )
      .select()
      .from(leases)
      .where(eq(leases.name, alphaSlotName));
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(before);
    expect((await (await getDb()).select().from(usage))[0].amount).toBe(1);
  });
  it("solo concede un dueño entre reservas concurrentes y no cobra los turnos ocupados", async () => {
    const requests = await Promise.all(
      Array.from({ length: 25 }, () => acquireAlphaRequest(() => now)),
    );
    expect(requests.filter((r) => r.status === "granted")).toHaveLength(1);
    expect(requests.filter((r) => r.status === "busy")).toHaveLength(24);
    expect((await (await getDb()).select().from(usage))[0].amount).toBe(1);
  });
  it("aplica veinte consultas como máximo, incluso si cada turno se libera", async () => {
    let time = now.getTime();
    for (let i = 0; i < 20; i++) {
      const result = await acquireAlphaRequest(() => new Date(time));
      expect(result.status).toBe("granted");
      if (result.status === "granted")
        await releaseAlphaRequest(result.token, () => new Date(time));
      time += 1500;
    }
    expect((await acquireAlphaRequest(() => new Date(time))).status).toBe(
      "quota",
    );
  });
  it("mantiene exclusión durante la respuesta y enfría después incluso si el proveedor falla", async () => {
    let time = now.getTime();
    const wait = vi.fn().mockImplementation(async (ms: number) => {
      time += ms;
    });
    await expect(
      withAlphaRequest(
        async () => {
          expect((await acquireAlphaRequest(() => new Date(time))).status).toBe(
            "busy",
          );
          throw new Error("provider failed");
        },
        { clock: () => new Date(time), wait },
      ),
    ).rejects.toThrow("provider failed");
    expect((await acquireAlphaRequest(() => new Date(time))).status).toBe(
      "busy",
    );
    time += 1500;
    expect((await acquireAlphaRequest(() => new Date(time))).status).toBe(
      "granted",
    );
  });
  it("toma el reloj después de una adquisición retrasada y un token anterior no libera otro turno", async () => {
    const db = await getDb();
    let unblock!: () => void;
    let blocked!: () => void;
    let time = now.getTime();
    const ready = new Promise<void>((r) => {
      blocked = r;
    });
    const gate = new Promise<void>((r) => {
      unblock = r;
    });
    const hold = db.transaction(async (tx) => {
      await tx.execute("SELECT 1");
      blocked();
      await gate;
    });
    await ready;
    const pending = acquireAlphaRequest(() => new Date(time));
    time += 10_000;
    unblock();
    await hold;
    const result = await pending;
    expect(result.status).toBe("granted");
    const row = (
      await db.select().from(leases).where(eq(leases.name, alphaSlotName))
    )[0];
    expect(row.expiresAt.getTime()).toBe(time + 60_000);
    await releaseAlphaRequest("wrong-token", () => new Date(time));
    expect((await acquireAlphaRequest(() => new Date(time))).status).toBe(
      "busy",
    );
  });
  it("el nuevo día UTC conserva el contador anterior y permite el siguiente turno tras enfriamiento", async () => {
    let time = Date.parse("2026-10-31T23:59:59.900Z");
    const first = await acquireAlphaRequest(() => new Date(time));
    if (first.status !== "granted") throw new Error("missing slot");
    await releaseAlphaRequest(first.token, () => new Date(time));
    time += 1500;
    expect((await acquireAlphaRequest(() => new Date(time))).status).toBe(
      "granted",
    );
    expect(
      (await (await getDb()).select().from(usage)).map((r) => r.key).sort(),
    ).toEqual(["quote:2026-10-31", "quote:2026-11-01"]);
  });
  it("la cola agotada no ejecuta el proveedor ni consume otra solicitud", async () => {
    const first = await acquireAlphaRequest(() => now);
    expect(first.status).toBe("granted");
    const request = vi.fn();
    expect(
      await withAlphaRequest(request, {
        clock: () => now,
        wait: async () => {},
      }),
    ).toEqual({ ok: false });
    expect(request).not.toHaveBeenCalled();
    expect((await (await getDb()).select().from(usage))[0].amount).toBe(1);
  });
});
