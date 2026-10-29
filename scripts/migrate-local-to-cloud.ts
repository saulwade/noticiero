import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import { migrations } from "../src/db/schema";
import { backupColumns } from "../src/features/backups/format";

// Run against a restored backup, never a second process on the live PGlite folder.
const metadata = JSON.parse(
  await readFile(".data/backups/latest-check.json", "utf8"),
);
const env = parseEnv(await readFile(".vercel/.env.cloud.local", "utf8"));
const connection = env.DATABASE_URL ?? env.POSTGRES_URL;
if (!connection || !new URL(connection).hostname.endsWith(".neon.tech"))
  throw new Error("Se requiere la conexión privada del nuevo Neon.");
const source = new PGlite(metadata.restore);
const target = postgres(connection, {
  max: 1,
  prepare: false,
  connect_timeout: 15,
});
const tables = Object.keys(backupColumns);
try {
  for (const statement of migrations) await source.exec(statement);
  for (const statement of migrations) await target.unsafe(statement);
  const counts: Record<string, number> = {};
  await target.begin(async (tx) => {
    for (const table of tables) {
      const [count] = await tx`SELECT count(*) AS total FROM ${tx(table)}`;
      if (Number(count.total) !== 0)
        throw new Error(
          `Destino no vacío: ${table}. No se sobrescribió ningún dato.`,
        );
    }
    for (const table of tables) {
      const { rows } = await source.query<Record<string, unknown>>(
        `SELECT * FROM ${table}`,
      );
      counts[table] = rows.length;
      for (const row of rows) {
        const values = Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            key === "data" || key === "idea_ids"
              ? target.json(JSON.parse(JSON.stringify(value)))
              : typeof value === "number"
                ? value
                : String(value),
          ]),
        );
        await tx`INSERT INTO ${tx(table)} ${tx(values)}`;
      }
      const [check] = await tx`SELECT count(*) AS total FROM ${tx(table)}`;
      if (Number(check.total) !== rows.length)
        throw new Error(`Verificación fallida: ${table}`);
    }
  });
  const verified = {
    migratedAt: new Date().toISOString(),
    backup: metadata.backup,
    counts,
    leaseTransferred: false,
  };
  await writeFile(
    ".data/backups/cloud-migration.json",
    JSON.stringify(verified, null, 2),
  );
  console.log(JSON.stringify(verified));
} catch (error) {
  console.error(
    "La migración se detuvo sin publicar el dashboard.",
    (error as { code?: string }).code ?? (error as Error).name,
  );
  process.exitCode = 1;
} finally {
  await source.close();
  await target.end();
}
