import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { migrations } from "../src/db/schema";
import { editionFor } from "../src/lib/time";
const dir = path.join(process.cwd(), ".data", "e2e-postgres");
const pkg = JSON.parse(await fs.readFile("package.json", "utf8"));
if (pkg.name !== "noticiero")
  throw new Error("Ejecuta las pruebas desde el proyecto Noticiero.");
await fs.rm(dir, { recursive: true, force: true });
const db = new PGlite(dir);
try {
  for (const statement of migrations) await db.exec(statement);
  const edition = {
    ...editionFor(),
    storyIds: [],
    publishedAt: new Date().toISOString(),
    partial: false,
  };
  await db.query("INSERT INTO editions(key,data) VALUES($1,$2::jsonb)", [
    edition.key,
    JSON.stringify(edition),
  ]);
} finally {
  await db.close();
}
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    process.env.E2E_PORT ?? "3101",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, NOTICIERO_E2E: "1", DATABASE_URL: "" },
  },
);
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
