import fs from "node:fs/promises";
const status =
  process.env.BACKUP_STATUS === "completed" ? "completed" : "failed";
let manifest = {};
if (status === "completed")
  manifest = JSON.parse(
    await fs.readFile(".data/backups/cloud-latest.enc.manifest.json", "utf8"),
  );
try {
  const response = await fetch(
    "https://noticiero-self.vercel.app/api/operations/backup",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPS_REPORT_SECRET}`,
      },
      body: JSON.stringify({
        status,
        runId: process.env.GITHUB_RUN_ID,
        ...manifest,
      }),
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    },
  );
  if (!response.ok) throw new Error();
  console.log("Estado del respaldo registrado en Noticiero.");
} catch {
  console.error("No se pudo registrar el estado del respaldo.");
  process.exitCode = 1;
}
