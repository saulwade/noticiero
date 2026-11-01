import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import type {
  AutomationInput,
  AutomationReport,
} from "../src/features/finance/automatic-types";

const MAX_OUTPUT = 500_000;
export async function runQuant(
  input: AutomationInput,
): Promise<AutomationReport> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.FINANCE_PYTHON ?? "python3",
      [path.resolve("scripts/finance_quant.py")],
      {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          OPENBLAS_NUM_THREADS: "1",
          OMP_NUM_THREADS: "1",
          MKL_NUM_THREADS: "1",
          PYTHONDONTWRITEBYTECODE: "1",
        },
      },
    );
    const chunks: Buffer[] = [];
    let bytes = 0;
    const timer = setTimeout(() => child.kill("SIGKILL"), 90_000);
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT) child.kill("SIGKILL");
      else chunks.push(chunk);
    });
    // Never relay stderr: numerical/runtime exceptions can include private inputs.
    child.stderr.resume();
    child.on("error", () => {
      clearTimeout(timer);
      reject(new Error("No se pudo iniciar el motor cuantitativo."));
    });
    child.stdin.on("error", () => {});
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 || bytes > MAX_OUTPUT)
        return reject(
          new Error(
            "El motor no produjo un informe válido en el tiempo disponible.",
          ),
        );
      try {
        resolve(
          JSON.parse(
            Buffer.concat(chunks).toString("utf8"),
          ) as AutomationReport,
        );
      } catch {
        reject(new Error("El motor no produjo un informe válido."));
      }
    });
    child.stdin.end(JSON.stringify(input));
  });
}

async function remote(
  action: string,
  attemptId: string,
  report?: AutomationReport,
) {
  const origin = process.env.APP_URL ?? "https://noticiero-self.vercel.app";
  const url = new URL("/api/operations/finance", origin);
  if (url.protocol !== "https:" || !process.env.OPS_REPORT_SECRET)
    throw new Error("Falta la conexión privada del análisis automático.");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPS_REPORT_SECRET}`,
    },
    body: JSON.stringify({ action, attemptId, ...(report ? { report } : {}) }),
    redirect: "error",
    signal: AbortSignal.timeout(action === "prepare" ? 240_000 : 30_000),
  });
  if (!response.ok)
    throw new Error("El servicio privado no confirmó el análisis.");
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_OUTPUT)
    throw new Error("Respuesta privada demasiado grande.");
  return JSON.parse(text);
}

export async function automaticFinance() {
  const attemptId = randomUUID();
  let prepared = false;
  try {
    const input: AutomationInput = await remote("prepare", attemptId);
    prepared = true;
    const report = await runQuant(input);
    await remote("publish", attemptId, report);
    console.log(
      "Análisis cuantitativo guardado; la propuesta no ejecuta operaciones.",
    );
  } catch {
    if (prepared) {
      await remote("failed", attemptId).catch(() => {});
    }
    throw new Error(
      "No se completó el análisis automático; se conserva el historial anterior.",
    );
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  automaticFinance().catch(() => {
    console.error(
      "No se completó el análisis automático; consulta el estado privado de Noticiero.",
    );
    process.exitCode = 1;
  });
