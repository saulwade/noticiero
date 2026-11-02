import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { publishArchive } from "./lib/archive-backup.mjs";
const input = ".data/backups/cloud-latest.enc";
const output = `${input}.archive.json`;
try {
  const bytes = await fs.readFile(input);
  const manifest = JSON.parse(
    await fs.readFile(`${input}.manifest.json`, "utf8"),
  );
  if (
    !bytes.subarray(0, 20).toString().startsWith("NOTICIERO_BACKUP_V1\n") ||
    bytes.length !== manifest.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== manifest.sha256
  )
    throw new Error("El respaldo local no coincide con su manifiesto.");
  const archive = await publishArchive({
    bytes,
    token: process.env.GITHUB_TOKEN,
    repository: process.env.GITHUB_REPOSITORY,
  });
  await fs.writeFile(output, JSON.stringify(archive), { mode: 0o600 });
  console.log("Archivo histórico cifrado añadido y verificado por descarga.");
} catch {
  await fs.writeFile(output, JSON.stringify({ status: "failed" }), {
    mode: 0o600,
  });
  console.error(
    "No se pudo verificar el archivo histórico. No se borró ni reemplazó ningún dato.",
  );
  process.exitCode = 1;
}
