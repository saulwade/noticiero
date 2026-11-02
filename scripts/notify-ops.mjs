import { operationMessage } from "./lib/ops-messages.mjs";
const origin = "https://noticiero-self.vercel.app";
const repository = process.env.GITHUB_REPOSITORY;
if (!repository || !/^saulwade\/noticiero-ops$/.test(repository))
  throw new Error("Repositorio de operaciones inesperado.");
const headers = {
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
};
async function github(path, method = "GET", body) {
  const response = await fetch(
    `https://api.github.com/repos/${repository}${path}`,
    {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) throw new Error("No se pudo registrar el aviso en GitHub.");
  return response.status === 204 ? null : response.json();
}

let findings = [];
try {
  const response = await fetch(`${origin}/api/operations/check`, {
    headers: { Authorization: `Bearer ${process.env.OPS_MONITOR_SECRET}` },
    signal: AbortSignal.timeout(30000),
    redirect: "error",
  });
  if (![200, 503].includes(response.status)) throw new Error();
  const data = await response.json();
  if (!Array.isArray(data.findings) || typeof data.ok !== "boolean")
    throw new Error();
  findings = data.findings.map(operationMessage);
} catch {
  findings = [
    "Noticiero no responde al monitor o rechazó la comprobación. Revisa su disponibilidad y configuración.",
  ];
}
if (process.env.BACKUP_STATUS === "failed")
  findings.push("El workflow de respaldo no pudo completar todas sus etapas.");
if (process.env.OPS_TEST_ALERT === "true")
  findings = [
    "Prueba solicitada del aviso: no representa un fallo real de la aplicación.",
  ];
const title = "Noticiero: revisión operativa necesaria";
try {
  const issues = await github("/issues?state=open&per_page=100");
  const existing = issues.find(
    (issue) => issue.title === title && !issue.pull_request,
  );
  if (findings.length) {
    const body = [
      "Aviso automático de Noticiero.",
      "",
      ...new Set(findings.map((message) => `- ${message}`)),
      "",
      `Revisar: https://github.com/${repository}/actions`,
      "",
      "Este aviso no incluye noticias, notas, entrevistas ni credenciales. Se cierra automáticamente cuando el monitor confirma recuperación.",
    ].join("\n");
    if (existing) {
      if (existing.body !== body)
        await github(`/issues/${existing.number}`, "PATCH", { body });
    } else
      await github("/issues", "POST", { title, body, assignees: ["saulwade"] });
    console.error("Se registró un aviso privado de operaciones.");
    process.exitCode = 1;
  } else {
    if (existing)
      await github(`/issues/${existing.number}`, "PATCH", {
        state: "closed",
        state_reason: "completed",
      });
    console.log(
      "Actualizaciones y respaldo dentro del plazo; sin avisos activos.",
    );
  }
} catch {
  console.error(
    "No se pudo actualizar el aviso privado. Revisa el workflow en GitHub.",
  );
  process.exitCode = 1;
}
