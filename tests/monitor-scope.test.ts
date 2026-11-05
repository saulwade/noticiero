import { describe, it, expect } from "vitest";
import { monitorFailed, monitorScope } from "../scripts/lib/monitor-result.mjs";
describe("el resultado corresponde al trabajo que realmente falló", () => {
  const critical = [
    { id: "finance-fx-missing", severity: "critical", message: "FX pendiente" },
  ];
  it("conserva el fallo real del monitor y no convierte otra tarea completada en respaldo/cálculo fallido", () => {
    expect(monitorFailed(critical, { scope: monitorScope("monitor") })).toBe(
      true,
    );
    for (const job of ["backup", "finance"])
      expect(monitorFailed(critical, { scope: monitorScope(job) })).toBe(false);
  });
  it("no oculta fallos propios, fallos de acceso al monitor o avisos de prueba", () => {
    for (const flags of [
      { backupFailed: true },
      { transportFailed: true },
      { testAlert: true },
    ])
      expect(monitorFailed([], { ...flags, scope: "task" })).toBe(true);
  });
  it("un trabajo desconocido conserva el comportamiento de alerta crítico", () => {
    for (const job of [undefined, "unrecognized"])
      expect(monitorFailed(critical, { scope: monitorScope(job) })).toBe(true);
  });
});
