import { describe, it, expect } from "vitest";
import { classifySignal } from "@/features/research/signals";
import { problemContext, buildDossiers } from "@/features/evidence/engine";
import { problemScope } from "@/features/research/problem-scope";
import type { EvidenceRecord } from "@/features/evidence/types";
const now = new Date("2026-11-03T15:00:00Z");
const record = (
  id: string,
  quote: string,
  extra: Partial<EvidenceRecord> = {},
): EvidenceRecord => ({
  id,
  externalId: id,
  quote,
  title: "Reported problem",
  source: "github",
  sourceName: "GitHub",
  url: `https://github.com/example/tool/issues/${id}`,
  occurredAt: now.toISOString(),
  capturedAt: now.toISOString(),
  kind: "community",
  language: "en",
  authorKey: `github:${id}`,
  product: "Example",
  ...extra,
});
describe("segunda etapa de calidad", () => {
  it("excluye contratación sin descartar problemas reales de contratación", () => {
    expect(
      classifySignal(
        "We're looking for extraordinary builders: Senior Platform Security Engineer. Remote US, salary and equity.",
      ),
    ).toBeUndefined();
    expect(
      classifySignal("I cannot export payroll data from our HR app."),
    ).toBe("pain");
  });
  it("no convierte un caso hipotético ni una reflexión editorial en experiencia propia", () => {
    expect(
      classifySignal(
        "Let's say your account is blocked and I need a tool to access it.",
      ),
    ).toBeUndefined();
    expect(
      classifySignal(
        "I loved coding in the past, but I can't find a reason to anymore that's necessary.",
      ),
    ).toBeUndefined();
  });
  it("necesita una declaración de resolución, no sólo la palabra fixed", () => {
    expect(
      problemContext(
        record("1", "The app fails to load. Does it need to be fixed?"),
      ).correction,
    ).toBe(false);
    expect(
      problemContext(record("2", "The issue is fixed after upgrading."))
        .correction,
    ).toBe(true);
    expect(
      problemContext(record("3", "The issue is not fixed after upgrading."))
        .correction,
    ).toBe(false);
  });
  it("no convierte negaciones, futuros, condiciones ni consejos en resolución", () => {
    for (const text of [
      "This cannot be fixed by restarting the app.",
      "The issue will be resolved by the next release.",
      "If this is fixed by the next release, I can export invoices.",
      "The problem can be resolved by clearing cache.",
      "Si ya esta resuelto podremos exportar.",
      "I don't know whether it works now.",
      "Not sure whether account access works now.",
    ])
      expect(problemContext(record("modal", text)).correction).toBe(false);
    expect(
      problemContext(record("past", "Fixed by updating the app.")).correction,
    ).toBe(true);
  });
  it("conserva errores operativos fuera de la taxonomía sin inventar repetición", () => {
    const result = buildDossiers(
      [
        record("a", "The widget jitters in Safari when resizing."),
        record("b", "The widget jitters in Safari when resizing."),
      ],
      [],
      now,
    );
    expect(result).toHaveLength(2);
    expect(result.every((d) => d.status === "isolated")).toBe(true);
  });
  it("separa JWT, PAM, rotación, roles personalizados y RLS en el mismo producto", () => {
    const texts = [
      "Our API returns 401 PGRST303 after successful sign in.",
      "Our SQL editor fails with PAM authentication.",
      "Our pooler authentication fails after password rotation.",
      "Our custom PostgreSQL role cannot authenticate through Supavisor.",
      "Our INSERT fails because an RLS policy rejects writes.",
    ];
    const groups = buildDossiers(
      texts.map((t, i) =>
        record(String(i), t, { product: "supabase/supabase" }),
      ),
      [],
      now,
    );
    expect(groups).toHaveLength(5);
    expect(groups.every((g) => g.identifiedAuthors === 1)).toBe(true);
  });
  it("dos clientes con el mismo fallo y comprador sí conservan repetición", () => {
    const groups = buildDossiers(
      [
        record("a", "Our API returns 401 PGRST303 after sign in."),
        record("b", "Our API returns 401 PGRST303 after sign in."),
      ],
      [],
      now,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].identifiedAuthors).toBe(2);
  });
  it("no usa una causa descartada para agrupar el problema", () => {
    expect(
      problemScope(
        "Our API returns 401 PGRST303 after sign in; there was no password rotation.",
      )?.mechanism,
    ).toBe("jwt-validation");
    expect(
      problemScope("Our backup fails on Wi-Fi even though we do not use a VPN.")
        ?.mechanism,
    ).not.toBe("backup-vpn");
    expect(
      problemScope("Our backup fails when using a VPN connection.")?.mechanism,
    ).toBe("backup-vpn");
  });
  it("no une depósito, mercancía, garantía y reparación en posventa", () => {
    const texts = [
      "Negativa a la devolución de depósito",
      "Negativa a cambio o devolución",
      "Negativa a hacer efectiva la garantía",
      "Deficiencia en la reparación",
    ];
    const scopes = texts.map(
      (t) => problemScope(t, "Tienda", "Usuarios de tienda")?.key,
    );
    expect(new Set(scopes).size).toBe(4);
  });
});
