import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { captureSnapshot } from "../src/features/backups/database";
import { backupManifest, sealBackup } from "../src/features/backups/format";
const url = process.env.BACKUP_DATABASE_URL,
  key = process.env.BACKUP_ENCRYPTION_KEY;
if (!url || !key)
  throw new Error(
    "Configura las credenciales de respaldo en el entorno privado.",
  );
const output = process.argv[2] ?? ".data/backups/cloud-latest.enc";
const client = postgres(url, {
  max: 1,
  prepare: false,
  connect_timeout: 15,
  onnotice: () => {},
});
try {
  const snapshot = await captureSnapshot(client);
  const bytes = sealBackup(snapshot, key);
  if (bytes.length > 40000000)
    throw new Error(
      "El respaldo excede el límite conservador de almacenamiento.",
    );
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, bytes, { mode: 0o600 });
  await fs.writeFile(
    `${output}.manifest.json`,
    JSON.stringify(backupManifest(snapshot, bytes)),
    { mode: 0o600 },
  );
  console.log("Respaldo cifrado creado. No incluye credenciales de entorno.");
} catch {
  console.error(
    "No se pudo crear el respaldo. Revisa conexión, permisos y tamaño.",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
