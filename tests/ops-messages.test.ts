import { expect, it } from "vitest";
import { operationMessage } from "../scripts/lib/ops-messages.mjs";
it("escala el aviso de espacio en GitHub al pasar del 70% al 85% sin copiar texto privado", () => {
  const before = operationMessage({
    id: "storage-database",
    message: "Aviso preventivo: alcanzó el 70%",
  });
  const after = operationMessage({
    id: "storage-database",
    message:
      "Prioritario: alcanzó el 85%. Texto privado que no debe compartirse",
  });
  expect(before).toContain("70%");
  expect(after).toContain("85%");
  expect(after).not.toBe(before);
  expect(after).not.toContain("Texto privado");
  expect(operationMessage({ id: "unknown", message: "secreto" })).not.toContain(
    "secreto",
  );
});
