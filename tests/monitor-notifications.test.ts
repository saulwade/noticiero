import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";
type Scenario = {
  findings?: { id: string; message: string; severity?: string }[];
  body?: string;
  transport?: boolean;
  notifyFailure?: boolean;
  backupFailure?: boolean;
  testAlert?: boolean;
  malformed?: boolean;
};
function run(scenario: Scenario) {
  const script = pathToFileURL(path.resolve("scripts/notify-ops.mjs")).href;
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    const scenario=${JSON.stringify(scenario)};
    const calls=[];
    globalThis.fetch=async(url,init={})=>{
      if(String(url).endsWith('/api/operations/check')){
        if(scenario.transport)throw new Error('network');
        const findings=scenario.findings??[];
        return Response.json(scenario.malformed?{ok:true}:{ok:!findings.length,findings},{status:findings.length?503:200});
      }
      const method=init.method??'GET';
      if(method==='GET')return Response.json([{number:2,title:'Noticiero: revisión operativa necesaria',body:scenario.body??'Anterior'}]);
      calls.push({method,body:JSON.parse(init.body)});
      return Response.json({}, {status:scenario.notifyFailure?503:200});
    };
    await import(${JSON.stringify(script)});
    console.log(JSON.stringify(calls));
  `,
    ],
    {
      encoding: "utf8",
      env: {
        NODE_ENV: "test",
        GITHUB_REPOSITORY: "saulwade/noticiero-ops",
        GITHUB_TOKEN: "test-token",
        OPS_MONITOR_SECRET: "test-monitor",
        BACKUP_STATUS: scenario.backupFailure ? "failed" : "completed",
        OPS_TEST_ALERT: scenario.testAlert ? "true" : "false",
      },
    },
  );
  return {
    status: child.status,
    stderr: child.stderr,
    calls: JSON.parse(child.stdout.trim().split("\n").at(-1) ?? "[]") as {
      method: string;
      body: { body?: string; state?: string };
    }[],
  };
}
const warning = {
  id: "evidence-sfc-co",
  message: "Error de la API con contenido privado que no debe salir",
  severity: "warning",
};
it("mantiene el aviso real sin fallar el workflow ni repetir cambios de incidencia", () => {
  const first = run({ findings: [warning] });
  expect(first.status).toBe(0);
  expect(first.stderr).toContain("::warning::");
  expect(first.calls[0].body.body).toContain("Colombia");
  expect(first.calls[0].body.body).not.toContain("contenido privado");
  const repeat = run({ findings: [warning], body: first.calls[0].body.body });
  expect(repeat.status).toBe(0);
  expect(repeat.calls).toEqual([]);
});
it("reserva fallo real para críticos, desconocidos, transporte, respaldo, aviso y ensayo", () => {
  for (const scenario of [
    {
      findings: [
        warning,
        { id: "backup-failed", message: "fallo", severity: "critical" },
      ],
    },
    { findings: [{ id: "unknown", message: "sin clasificación" }] },
    { findings: [warning], transport: true },
    { findings: [warning], notifyFailure: true },
    { findings: [warning], backupFailure: true },
    { findings: [warning], testAlert: true },
    { malformed: true },
  ])
    expect(run(scenario).status).toBe(1);
});
it("solo cierra la incidencia al recuperarse, sin ocultar la advertencia pendiente", () => {
  const result = run({ findings: [] });
  expect(result.status).toBe(0);
  expect(result.calls[0].body.state).toBe("closed");
});
