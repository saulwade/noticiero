import { describe, it, expect } from "vitest";
import { buildDossiers, problemContext } from "@/features/evidence/engine";
import { problemScope } from "@/features/research/problem-scope";
import { classifySignal } from "@/features/research/signals";
import { terms } from "@/features/research/vector";
import type { EvidenceRecord } from "@/features/evidence/types";
const now = new Date("2026-11-07T16:00:00Z");
const record = (id: string, quote: string): EvidenceRecord => ({
  id,
  externalId: id,
  source: "github",
  sourceName: "GitHub",
  title: "Bug",
  quote,
  url: `https://github.com/n8n-io/n8n/issues/${id}`,
  kind: "community",
  language: "en",
  product: "n8n-io/n8n",
  authorKey: `github:${id}`,
  occurredAt: now.toISOString(),
  capturedAt: now.toISOString(),
});
describe("regresiones de las capturas del siete de noviembre", () => {
  it("una configuración OAuth correcta no eclipsa el fallo real de interfaz", () => {
    expect(
      problemScope(
        "OAuth is configured with the correct policy. The navigation tabs jitter horizontally in Safari.",
      )?.mechanism,
    ).toBe("interface-layout");
    expect(
      problemScope(
        "OAuth is configured with the correct policy. I cannot load our workflow.",
      )?.mechanism,
    ).not.toBe("oauth-policy");
  });
  it("un antecedente manual no oculta un fallo actual distinto", () => {
    expect(
      problemContext(
        record(
          "current",
          "Before I had to manually export invoices. Now our export integration is broken and I cannot download any invoice.",
        ),
      ).accepted,
    ).toBe(true);
  });
  it("separa credenciales eliminadas, políticas OAuth y una barra que tiembla", () => {
    const records = [
      record(
        "1",
        "When the credential referenced by a node is deleted, execution fails: Credential with ID does not exist.",
      ),
      record(
        "2",
        "OAuth sign-in fails because the project credential type policy ignores the explicit allow rule.",
      ),
      record(
        "3",
        "The navigation tabs (Workflows / Credentials) jitter horizontally in Safari.",
      ),
    ];
    expect(buildDossiers(records, [], now)).toHaveLength(3);
    expect(
      new Set(records.map((r) => problemContext(r).scope?.mechanism)).size,
    ).toBe(3);
  });
  it("no combina importaciones sobrescritas, codificación CSV y un error aritmético", () => {
    const texts = [
      "I cannot import transactions because the import overwrites existing transactions.",
      "CSV Export character encoding issue: French accented characters are corrupted.",
      "I cannot import transactions because safeNumber can't safely perform arithmetic with number.",
    ];
    const rows = texts.map((t, i) => ({
      ...record(String(i), t),
      product: "actualbudget/actual",
    }));
    expect(buildDossiers(rows, [], now)).toHaveLength(3);
    expect(problemScope(texts[0])?.mechanism).toBe("import-overwrite");
    expect(problemScope(texts[1])?.mechanism).toBe("export-encoding");
  });
  it("tareas técnicas genéricas quedan aisladas; una misma causa explícita puede repetirse", () => {
    const vague = [
      record("1", "I cannot use credentials in our workflow."),
      record("2", "Our workflow has a credential error."),
    ];
    expect(buildDossiers(vague, [], now)).toHaveLength(2);
    const specific = [
      record(
        "3",
        "Our CSV export fails because accented characters have the wrong encoding.",
      ),
      record(
        "4",
        "I cannot export CSV: accented characters are corrupted by encoding.",
      ),
    ];
    expect(buildDossiers(specific, [], now)).toHaveLength(1);
    expect(buildDossiers(specific, [], now)[0].identifiedAuthors).toBe(2);
  });
  it("no atribuye como dolor actual una reflexión, una respuesta de soporte o un proceso sustituido", () => {
    for (const quote of [
      "I am optimistic because even if the above fails I can keep adding tools for myself.",
      "You receive a response: You are contacting us from an email address that differs from the one registered to your account.",
      "As mentioned by my colleague, regrettably we are unable to restore the account or provide access to the domain in this case.",
      "Before I had to manually recategorize transactions in a spreadsheet and build lookups by hand.",
    ])
      expect(classifySignal(quote)).toBeUndefined();
    expect(
      classifySignal(
        "I still manually recategorize transactions in a spreadsheet every week.",
      ),
    ).toBe("workaround");
  });
  it("preserva una solicitud operativa española y no usa causas negadas", () => {
    expect(
      classifySignal(
        "No puedo descargar los CFDI del SAT porque la solicitud devuelve un error.",
      ),
    ).toBe("pain");
    expect(
      problemScope("This is not an encoding issue. I cannot export invoices.")
        ?.mechanism,
    ).not.toBe("export-encoding");
  });
  it("quita conectores y restos editoriales pero conserva conceptos de negocio", () => {
    expect(
      terms(
        "but after if full read next now so verge story ve around company year IA facturas clientes seguridad",
      ),
    ).toEqual(["ia", "factura", "cliente", "seguridad"]);
  });
});
