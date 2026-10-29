import { PGlite } from "@electric-sql/pglite";
import {
  drizzle as pgliteDrizzle,
  type PgliteDatabase,
} from "drizzle-orm/pglite";
import { drizzle as postgresDrizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import * as schema from "./schema";

type DB = PgliteDatabase<typeof schema>;
const globalDb = globalThis as typeof globalThis & {
  noticieroDb?: Promise<DB>;
};

async function connect(): Promise<DB> {
  let db: DB;
  if (process.env.DATABASE_URL) {
    const client = postgres(process.env.DATABASE_URL, {
      max: 3,
      prepare: false,
      connect_timeout: 15,
    });
    // The adapters expose the same PostgreSQL query surface used by this app.
    db = postgresDrizzle(client, { schema }) as unknown as DB;
  } else {
    if (process.env.VERCEL)
      throw new Error("Configura DATABASE_URL para el despliegue.");
    const dir = path.join(
      process.cwd(),
      ".data",
      process.env.NODE_ENV === "test" ? "test-postgres" : "postgres",
    );
    await mkdir(dir, { recursive: true });
    db = pgliteDrizzle(new PGlite(dir), { schema });
  }
  for (const statement of schema.migrations)
    await db.execute(sql.raw(statement));
  return db;
}
export function getDb(): Promise<DB> {
  globalDb.noticieroDb ??= connect().catch((error) => {
    globalDb.noticieroDb = undefined;
    throw error;
  });
  return globalDb.noticieroDb;
}
export function resultRows(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  return (result as { rows?: unknown[] }).rows ?? [];
}
