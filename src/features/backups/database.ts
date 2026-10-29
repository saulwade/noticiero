import type postgres from "postgres";
import { backupColumns, validateSnapshot, type BackupSnapshot } from "./format";
import { migrations } from "@/db/schema";

export async function captureSnapshot(
  client: postgres.Sql,
): Promise<BackupSnapshot> {
  return client.begin(
    "isolation level repeatable read read only",
    async (tx) => {
      const tables = [];
      for (const name of Object.keys(backupColumns)) {
        const rows = await tx`SELECT * FROM ${tx(name)}`;
        tables.push({
          name,
          rows: Array.from(rows) as Record<string, unknown>[],
        });
      }
      return validateSnapshot({
        version: 1,
        createdAt: new Date().toISOString(),
        tables,
      });
    },
  ) as Promise<BackupSnapshot>;
}
// The target interface also supports the disposable PGlite restore used in tests.
export type RestoreTarget = {
  exec: (statement: string, params?: unknown[]) => Promise<unknown>;
  transaction: <T>(work: (target: RestoreTarget) => Promise<T>) => Promise<T>;
  rows: (statement: string) => Promise<Record<string, unknown>[]>;
};
export async function restoreSnapshot(raw: unknown, target: RestoreTarget) {
  const snapshot = validateSnapshot(raw);
  await target.transaction(async (tx) => {
    for (const statement of migrations) await tx.exec(statement);
    for (const name of [...Object.keys(backupColumns), "leases"]) {
      const rows = await tx.rows(
        `SELECT count(*)::int AS count FROM "${name}"`,
      );
      if (Number(rows[0]?.count) !== 0)
        throw new Error(
          "La restauración exige una base vacía. No se sobrescribieron datos.",
        );
    }
    for (const table of snapshot.tables) {
      const columns = backupColumns[table.name];
      for (const row of table.rows) {
        const params = columns.map((column) =>
          column === "data" || column === "idea_ids"
            ? JSON.stringify(row[column])
            : row[column],
        );
        const placeholders = columns
          .map(
            (column, index) =>
              `$${index + 1}${column === "data" || column === "idea_ids" ? "::jsonb" : ""}`,
          )
          .join(",");
        await tx.exec(
          `INSERT INTO "${table.name}" (${columns.map((column) => `"${column}"`).join(",")}) VALUES (${placeholders})`,
          params,
        );
      }
      const rows = await tx.rows(
        `SELECT count(*)::int AS count FROM "${table.name}"`,
      );
      if (Number(rows[0]?.count) !== table.rows.length)
        throw new Error("El recuento restaurado no coincide.");
    }
  });
}
