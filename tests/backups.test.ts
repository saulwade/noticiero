import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import {
  backupColumns,
  backupManifest,
  openBackup,
  sealBackup,
  type BackupSnapshot,
} from "@/features/backups/format";
import {
  restoreSnapshot,
  type RestoreTarget,
} from "@/features/backups/database";
import { migrations } from "@/db/schema";
const snapshot = (): BackupSnapshot => ({
  version: 1,
  createdAt: "2026-10-29T10:00:00Z",
  tables: Object.keys(backupColumns).map((name) => ({
    name,
    rows:
      name === "saved_items"
        ? [{ id: "a", data: { id: "a", note: "Nota privada" } }]
        : name === "interviews"
          ? [
              {
                id: "i",
                data: { alias: "Persona A", notes: "Contradicción importante" },
              },
            ]
          : name === "finance_sync"
            ? [
                {
                  id: "fx:USD/MXN",
                  data: {
                    id: "fx:USD/MXN",
                    status: "ok",
                    asOf: "2026-10-29",
                    value: "20",
                    provider: "Frankfurter",
                  },
                },
              ]
            : [],
  })),
});
describe("respaldo independiente cifrado", () => {
  it("cubre todas las tablas de contenido y excluye las credenciales y leases", () => {
    const tables = migrations
      .map((sql) => sql.match(/EXISTS (\w+)/)?.[1])
      .filter((name) => name !== "leases")
      .sort();
    expect(Object.keys(backupColumns).sort()).toEqual(tables);
    expect(backupColumns.leases).toBeUndefined();
  });
  it("restaura notas e entrevistas con autenticidad y recuentos completos", async () => {
    const key = randomBytes(32).toString("base64");
    const bytes = sealBackup(snapshot(), key);
    expect(bytes.toString()).not.toContain("Nota privada");
    expect(
      backupManifest(openBackup(bytes, key), bytes).counts.interviews,
    ).toBe(1);
    const db = new PGlite();
    const adapt = (
      client: Pick<PGlite, "query" | "transaction">,
    ): RestoreTarget => ({
      exec: (s, p) => client.query(s, p),
      rows: async (s) => (await client.query<Record<string, unknown>>(s)).rows,
      transaction: (work) =>
        client.transaction((tx) => work(adapt(tx as unknown as PGlite))),
    });
    try {
      await restoreSnapshot(openBackup(bytes, key), adapt(db));
      const result = await db.query<{ data: { notes: string } }>(
        "SELECT data FROM interviews",
      );
      expect(result.rows[0].data.notes).toBe("Contradicción importante");
      const financial = await db.query<{ data: { value: string } }>(
        "SELECT data FROM finance_sync",
      );
      expect(financial.rows[0].data.value).toBe("20");
      await expect(restoreSnapshot(snapshot(), adapt(db))).rejects.toThrow(
        "base vacía",
      );
      expect((await db.query("SELECT * FROM interviews")).rows).toHaveLength(1);
    } finally {
      await db.close();
    }
  });
  it("rechaza manipulación, clave equivocada y respaldos incompletos", () => {
    const key = randomBytes(32).toString("base64");
    const bytes = sealBackup(snapshot(), key);
    const changed = Buffer.from(bytes);
    changed[changed.length - 1] ^= 1;
    expect(() => openBackup(changed, key)).toThrow();
    expect(() =>
      openBackup(bytes, randomBytes(32).toString("base64")),
    ).toThrow();
    const incomplete = snapshot();
    incomplete.tables.pop();
    expect(() => sealBackup(incomplete, key)).toThrow();
  });
});
