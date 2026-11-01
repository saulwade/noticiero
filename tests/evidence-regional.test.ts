import { describe, expect, it, vi } from "vitest";
import {
  collectColombia,
  collectProfeco,
  PROFECO_RESOURCE,
} from "@/features/evidence/regional-connectors";
import { buildDossiers } from "@/features/evidence/engine";

const now = new Date("2026-11-01T16:00:00Z");
const row = {
  id_expediente: "2026_123",
  fecha_ingreso: "2026-07-15T00:00:00",
  nombre_comercial: "Comercio público",
  giro: "Comercio electrónico",
  motivo_reclamacion: "Negativa a la devolución de depósito",
  estado_procesal: "No conciliada",
};
const json = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
  });
const profeco = (records: unknown[]) =>
  json({ success: true, result: { records } });
const total = {
  a_o_creacion: "2026",
  mes_creacion: "9",
  motivo: "Transacción no reconocida",
  producto: "Cuenta de ahorro",
  total: "823",
};

describe("fuentes oficiales regionales acotadas", () => {
  it("consulta el datastore mexicano con campos permitidos, no el CSV completo", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(profeco([row]));
    const batch = await collectProfeco(undefined, now, fetcher);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.origin).toBe("https://www.datos.gob.mx");
    expect(url.searchParams.get("resource_id")).toBe(PROFECO_RESOURCE);
    expect(url.searchParams.get("limit")).toBe("20");
    expect(url.searchParams.get("fields")).not.toMatch(
      /correo|telefono|domicilio/,
    );
    expect(batch.records[0]).toMatchObject({
      source: "profeco",
      kind: "complaint",
      country: "MX",
      occurredAt: "2026-07-15",
      historical: true,
      resolution: "unresolved",
    });
    expect(batch.records[0].authorKey).toBeUndefined();
    expect(batch.records[0].quote).toContain("sin narrativa personal");
    expect(batch.state.message).toContain("antecedentes");
  });
  it("descarta fechas futuras, calendario inválido y datos personales no solicitados", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      profeco([
        {
          ...row,
          id_expediente: "future",
          fecha_ingreso: "8240-01-05T00:00:00",
        },
        {
          ...row,
          id_expediente: "invalid",
          fecha_ingreso: "2026-02-30T00:00:00",
        },
        {
          ...row,
          Nombre: "Persona privada",
          Email: "private@example.com",
          Telefono: "5555555555",
        },
      ]),
    );
    const batch = await collectProfeco(undefined, now, fetcher);
    expect(batch.records).toHaveLength(1);
    expect(JSON.stringify(batch.records)).not.toMatch(
      /Persona privada|private@example|5555555555/,
    );
    expect(batch.state.message).toContain("2 filas descartadas");
  });
  it("pagina la muestra sin multiplicar voces ni solicitar más de veinte filas", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
      profeco(
        Array.from({ length: 20 }, (_, i) => ({
          ...row,
          id_expediente: String(i),
        })),
      ),
    );
    const first = await collectProfeco(undefined, now, fetcher);
    const next = await collectProfeco(
      first.state,
      new Date(now.getTime() + 7 * 3600000),
      fetcher,
    );
    expect(
      new URL(String(fetcher.mock.calls[1][0])).searchParams.get("offset"),
    ).toBe("20");
    expect(next.records).toHaveLength(20);
    expect(first.records.map((r) => r.id)).toEqual(
      next.records.map((r) => r.id),
    );
  });
  it("alterna la cabecera con antecedentes y no queda atascado en el límite", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        profeco(
          Array.from({ length: 20 }, (_, i) => ({
            ...row,
            id_expediente: String(i),
          })),
        ),
      );
    const first = await collectProfeco(undefined, now, fetcher);
    const second = await collectProfeco(first.state, now, fetcher);
    await collectProfeco(second.state, now, fetcher);
    expect(
      fetcher.mock.calls.map((c) =>
        new URL(String(c[0])).searchParams.get("offset"),
      ),
    ).toEqual(["0", "20", "0"]);
    const capped = await collectProfeco(
      {
        ...first.state,
        cursor: JSON.stringify({ offset: 10000, headNext: false }),
      },
      now,
      fetcher,
    );
    expect(JSON.parse(capped.state.cursor!).offset).toBe(20);
    expect(JSON.parse(capped.state.cursor!).headNext).toBe(true);
  });
  it("un expediente conciliado no sigue contando como dolor activo", async () => {
    const batch = await collectProfeco(
      undefined,
      now,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          profeco([{ ...row, estado_procesal: "Conciliada" }]),
        ),
    );
    const dossier = buildDossiers(batch.records, [], now)[0];
    expect(dossier.anonymousCases).toBe(0);
    expect(dossier.contradictions).toHaveLength(1);
  });
  it("una respuesta de esquema incompatible conserva el cursor y devuelve error", async () => {
    const previous = {
      id: "profeco" as const,
      status: "limited" as const,
      checkedAt: "",
      count: 20,
      message: "sample",
      cursor: JSON.stringify({ offset: 40 }),
    };
    const batch = await collectProfeco(
      previous,
      now,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(json({ success: false, result: { records: [] } })),
    );
    expect(batch.state.status).toBe("error");
    expect(batch.state.cursor).toBe(previous.cursor);
    expect(batch.records).toEqual([]);
  });
  it("respeta Retry-After sin perder posición ni volver a consultar", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("", { status: 429, headers: { "retry-after": "86400" } }),
      );
    const previous = {
      id: "profeco" as const,
      status: "limited" as const,
      checkedAt: "",
      count: 20,
      message: "sample",
      cursor: JSON.stringify({ offset: 40 }),
    };
    const batch = await collectProfeco(previous, now, fetcher);
    expect(batch.state.blocked).toBe(true);
    expect(JSON.parse(batch.state.cursor!).offset).toBe(40);
    await collectProfeco(
      batch.state,
      new Date(now.getTime() + 7 * 3600000),
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("Colombia conserva cantidades mensuales como estadísticas, nunca personas", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json([total]));
    const batch = await collectColombia(undefined, now, fetcher);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.origin).toBe("https://www.datos.gov.co");
    expect(url.searchParams.get("$limit")).toBe("20");
    expect(batch.records[0]).toMatchObject({
      kind: "statistic",
      country: "CO",
      period: "2026-09",
      aggregateCount: 823,
      occurredAt: "2026-09-01",
    });
    expect(buildDossiers(batch.records, [], now)).toEqual([]);
    expect(batch.records[0].authorKey).toBeUndefined();
    expect(batch.state.message).toContain("no testimonios");
  });
  it("rechaza meses, totales y fechas imposibles sin crear estadísticas", async () => {
    const batch = await collectColombia(
      undefined,
      now,
      vi.fn<typeof fetch>().mockResolvedValue(
        json([
          { ...total, mes_creacion: "13" },
          { ...total, a_o_creacion: "2027" },
          { ...total, total: "-4" },
          { ...total, total: "1.5" },
        ]),
      ),
    );
    expect(batch.records).toEqual([]);
  });
  it("acota respuestas grandes y conserva el archivo ante fallos de red", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("{}", { headers: { "content-length": "2000000" } }),
      );
    expect((await collectColombia(undefined, now, fetcher)).state.status).toBe(
      "error",
    );
    expect(
      (
        await collectProfeco(
          undefined,
          now,
          vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")),
        )
      ).records,
    ).toEqual([]);
  });
});
