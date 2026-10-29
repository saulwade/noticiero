import fs from "node:fs/promises";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import { openBackup } from "../src/features/backups/format";
import {
  restoreSnapshot,
  type RestoreTarget,
} from "../src/features/backups/database";
const [input, temporaryPath] = process.argv.slice(2);
const key = process.env.BACKUP_ENCRYPTION_KEY;
if (!input || !key)
  throw new Error("Indica el archivo y la clave en el entorno privado.");
const snapshot = openBackup(await fs.readFile(input), key);
if (temporaryPath) {
  // Refuse any existing directory, including the live embedded database.
  try {
    await fs.stat(temporaryPath);
    throw new Error("La carpeta de restauración ya existe.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const db = new PGlite(temporaryPath);
  const adapt = (
    client: Pick<PGlite, "query" | "transaction">,
  ): RestoreTarget => ({
    exec: (s, p) => client.query(s, p),
    rows: async (s) => (await client.query<Record<string, unknown>>(s)).rows,
    transaction: (work) =>
      client.transaction((tx) => work(adapt(tx as unknown as PGlite))),
  });
  try {
    await restoreSnapshot(snapshot, adapt(db));
    console.log("Restauración temporal verificada; recuentos completos.");
  } finally {
    await db.close();
  }
} else {
  if (!process.env.RESTORE_DATABASE_URL)
    throw new Error(
      "Indica RESTORE_DATABASE_URL para una base vacía o una carpeta temporal nueva.",
    );
  const db = postgres(process.env.RESTORE_DATABASE_URL, {
    max: 1,
    prepare: false,
    onnotice: () => {},
  });
  const adapt = (
    client: postgres.Sql | postgres.TransactionSql,
  ): RestoreTarget => ({
    exec: (s, p) => client.unsafe(s, p as postgres.ParameterOrJSON<never>[]),
    rows: async (s) => Array.from(await client.unsafe(s)),
    transaction: (work) =>
      "begin" in client
        ? ((client as postgres.Sql).begin((tx) =>
            work(adapt(tx)),
          ) as Promise<never>)
        : work(adapt(client)),
  });
  try {
    await restoreSnapshot(snapshot, adapt(db));
    console.log("Restauración completada y verificada.");
  } finally {
    await db.end();
  }
}
