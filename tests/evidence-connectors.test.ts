import { describe, expect, it, vi } from "vitest";
import {
  collectCfpb,
  collectGithub,
  GITHUB_EVIDENCE_REPOSITORIES,
} from "@/features/evidence/connectors";
import { parseProfecoCsv } from "@/features/evidence/profeco";
import type { ConnectorState } from "@/features/evidence/types";

const now = new Date("2026-10-31T20:00:00Z");
// Reduced fixture from the public, unauthenticated API smoke test on 2026-10-31.
const complaint = {
  _id: "31470720",
  _source: {
    complaint_id: "31470720",
    date_received: "2026-10-30T21:41:14.000Z",
    product: "Credit reporting or other personal consumer reports",
    issue: "Improper use of your report",
    sub_issue: "Reporting company used your report improperly",
    zip_code: "93933",
    state: "CA",
    submitted_via: "Web",
    company: "Experian Information Solutions Inc.",
  },
  sort: [1793396474000, "31470720"],
};
const issue = {
  id: 6135761413,
  number: 42840,
  repository_url: "https://api.github.com/repos/n8n-io/n8n",
  html_url: "https://github.com/n8n-io/n8n/issues/42840",
  title:
    "Switch node has new timezone conversion error that is embedded in the node.",
  body: "Workflow cannot be activated because required inputs are not connected.",
  created_at: "2026-10-31T14:11:27Z",
  updated_at: "2026-10-31T18:59:29Z",
  user: { login: "greysolve", type: "User" },
};
function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}
function cfpb(data: unknown[] = [complaint], total = data.length) {
  return {
    hits: { total: { value: total, relation: "eq" }, hits: data },
    _meta: { license: "CC0", is_data_stale: false },
  };
}
function github(items = [issue], total = items.length) {
  return { total_count: total, incomplete_results: false, items };
}
function state(id: "cfpb" | "github", cursor: string): ConnectorState {
  return {
    id,
    status: "ok",
    cursor,
    checkedAt: "2026-10-30T20:00:00Z",
    count: 1,
    message: "previous",
  };
}

describe("conectores públicos acotados", () => {
  it("adapta el esquema CFPB real, conserva recepción original y no inventa narrativa ni autor", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json(cfpb()));
    const result = await collectCfpb(undefined, now, fetcher);
    expect(result.state.status).toBe("ok");
    expect(result.records[0]).toMatchObject({
      id: "cfpb:31470720",
      kind: "complaint",
      country: "US",
      occurredAt: "2026-10-30",
      capturedAt: now.toISOString(),
    });
    expect(result.records[0].quote).toContain(
      "Categoría declarada (sin narrativa pública)",
    );
    expect(result.records[0].authorKey).toBeUndefined();
    expect(JSON.stringify(result.records)).not.toMatch(
      /93933|Experian|submitted_via/,
    );
    const [request, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const url = new URL(request);
    expect(url.searchParams.get("size")).toBe("20");
    expect(url.searchParams.has("format")).toBe(false);
    expect(init.credentials).toBe("omit");
    expect(JSON.stringify(init.headers)).not.toMatch(/Authorization/i);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("consulta ventana incremental CFPB y distingue narrativa publicada de categorías", async () => {
    const narrative = "I could not access my account after repeated requests.";
    const fetcher = vi.fn<typeof fetch>(async () =>
      json(
        cfpb([
          {
            ...complaint,
            _source: {
              ...complaint._source,
              complaint_what_happened: narrative,
            },
          },
        ]),
      ),
    );
    const result = await collectCfpb(
      state("cfpb", "2026-10-30T21:41:14.000Z"),
      now,
      fetcher,
    );
    expect(
      new URL(fetcher.mock.calls[0][0] as unknown as string).searchParams.get(
        "date_received_min",
      ),
    ).toBe("2026-09-30");
    expect(result.records[0].quote).toBe(narrative);
    expect(result.state.cursor).toBe("2026-10-30");
  });
  it("marca muestras incompletas y datos CFPB desactualizados", async () => {
    const result = await collectCfpb(undefined, now, async () =>
      json({ ...cfpb([complaint], 2000), _meta: { is_data_stale: true } }),
    );
    expect(result.state.status).toBe("limited");
    expect(result.state.blocked).not.toBe(true);
    expect(result.state.message).toContain("desactualizados");
  });
  it("conserva el día administrativo CFPB aunque la API lo codifique con zona y hora", async () => {
    for (const date_received of [
      "2026-10-30",
      "2026-10-30T00:00:00Z",
      "2026-10-30T23:00:00-05:00",
    ]) {
      const result = await collectCfpb(undefined, now, async () =>
        json(
          cfpb([
            { ...complaint, _source: { ...complaint._source, date_received } },
          ]),
        ),
      );
      expect(result.records[0].occurredAt).toBe("2026-10-30");
      expect(result.state.cursor).toBe("2026-10-30");
    }
  });
  it("calcula corte y fechas futuras CFPB con el calendario de la fuente cerca de medianoche UTC", async () => {
    const beforeAgencyMidnight = new Date("2026-10-31T02:00:00Z");
    const fetcher = vi.fn<typeof fetch>(async () => json(cfpb()));
    const result = await collectCfpb(undefined, beforeAgencyMidnight, fetcher);
    expect(result.records[0].occurredAt).toBe("2026-10-30");
    expect(
      new URL(fetcher.mock.calls[0][0] as string).searchParams.get(
        "date_received_min",
      ),
    ).toBe("2026-09-30");
    const future = await collectCfpb(
      undefined,
      beforeAgencyMidnight,
      async () =>
        json(
          cfpb([
            {
              ...complaint,
              _source: {
                ...complaint._source,
                date_received: "2026-10-31T00:00:00Z",
              },
            },
          ]),
        ),
    );
    expect(future.state.status).toBe("error");
    expect(future.records).toEqual([]);
  });
  it("adapta GitHub real, restringe repositorios y conserva created_at al avanzar por updated_at", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json(github()));
    const previous = state("github", "2026-10-30T00:00:00.000Z");
    const result = await collectGithub(previous, now, fetcher);
    expect(result.records[0]).toMatchObject({
      id: "github:6135761413",
      authorKey: "github:greysolve",
      occurredAt: "2026-10-31T14:11:27.000Z",
      product: "n8n-io/n8n",
    });
    expect(result.records[0].country).toBeUndefined();
    expect(result.state.cursor).toBe("2026-10-31T18:59:29.000Z");
    const query = new URL(fetcher.mock.calls[0][0] as unknown as string)
      .searchParams;
    for (const repo of GITHUB_EVIDENCE_REPOSITORIES)
      expect(query.get("q")).toContain(`repo:${repo}`);
    expect(query.get("q")).toContain(
      `is:issue is:public updated:>=${previous.cursor}`,
    );
    expect(query.get("per_page")).toBe("20");
  });
  it("excluye PRs, bots declarados, bots de nombre y autores borrados", async () => {
    const items = [
      issue,
      {
        ...issue,
        id: 2,
        pull_request: {},
        html_url: "https://github.com/n8n-io/n8n/pull/42840",
      },
      { ...issue, id: 3, user: { login: "robot", type: "Bot" } },
      { ...issue, id: 4, user: { login: "dependabot[bot]", type: "User" } },
      { ...issue, id: 5, user: null },
    ];
    const result = await collectGithub(undefined, now, async () =>
      json(github(items as (typeof issue)[])),
    );
    expect(result.records).toHaveLength(1);
    expect(result.state.status).toBe("ok");
  });
  it("rechaza repositorios fuera de lista y conserva cursor ante esquema malformado", async () => {
    const previous = state("github", "2026-10-30T00:00:00.000Z");
    for (const item of [
      {
        ...issue,
        repository_url: "https://api.github.com/repos/private/secret",
      },
      { ...issue, created_at: "invalid" },
      { ...issue, created_at: "2026-02-30T10:00:00Z" },
      { ...issue, html_url: "https://example.com/phishing" },
    ]) {
      const result = await collectGithub(previous, now, async () =>
        json(github([item])),
      );
      expect(result.records).toEqual([]);
      expect(result.state).toMatchObject({
        status: "error",
        cursor: previous.cursor,
      });
    }
  });
  it("no avanza cursor de GitHub cuando la búsqueda indica resultados incompletos", async () => {
    const previous = state("github", "2026-10-30T00:00:00.000Z");
    const result = await collectGithub(previous, now, async () =>
      json({ ...github(), incomplete_results: true }),
    );
    expect(result.records).toHaveLength(1);
    expect(result.state).toMatchObject({
      status: "limited",
      cursor: previous.cursor,
    });
  });
  it("respeta Retry-After entre ejecuciones sin reintentos ni nueva petición", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response("rate limit", {
          status: 429,
          headers: { "retry-after": "120" },
        }),
    );
    const limited = await collectGithub(
      state("github", "2026-10-30T00:00:00Z"),
      now,
      fetcher,
    );
    const paused = await collectGithub(
      limited.state,
      new Date(now.getTime() + 60_000),
      fetcher,
    );
    expect(limited.state.status).toBe("limited");
    expect(limited.state.blocked).toBe(true);
    expect(paused.state.blocked).toBe(true);
    expect(paused.state.message).toContain("2026-10-31T20:02:00.000Z");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(paused.records).toEqual([]);
  });
  it("respeta reset de cuota GitHub y Retry-After con fecha HTTP", async () => {
    const reset = Math.floor(now.getTime() / 1000) + 180;
    const result = await collectGithub(
      undefined,
      now,
      async () =>
        new Response(null, {
          status: 403,
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(reset),
          },
        }),
    );
    expect(result.state.message).toContain("2026-10-31T20:03:00.000Z");
    const cfpbResult = await collectCfpb(
      undefined,
      now,
      async () =>
        new Response(null, {
          status: 429,
          headers: { "retry-after": "Sat, 31 Oct 2026 20:05:00 GMT" },
        }),
    );
    expect(cfpbResult.state.message).toContain("2026-10-31T20:05:00.000Z");
  });
  it("aísla errores HTTP, JSON y red sin filtrar mensajes de la fuente", async () => {
    const previous = state("cfpb", "2026-10-30T00:00:00.000Z");
    for (const fetcher of [
      async () => new Response("private upstream details", { status: 500 }),
      async () => new Response("invalid json"),
      async () => {
        throw new Error("sensitive network details");
      },
    ]) {
      const result = await collectCfpb(previous, now, fetcher);
      expect(result.state).toMatchObject({
        status: "error",
        cursor: previous.cursor,
      });
      expect(result.records).toEqual([]);
      expect(result.state.message).not.toMatch(/private|sensitive/);
    }
  });
  it("limita bytes anunciados y bytes reales aunque no haya Content-Length", async () => {
    for (const response of [
      new Response("{}", { headers: { "content-length": "2000000" } }),
      new Response("x".repeat(1_048_577)),
    ]) {
      const result = await collectCfpb(undefined, now, async () => response);
      expect(result.state.status).toBe("error");
      expect(result.records).toEqual([]);
    }
  });
  it("rechaza filas CFPB malformadas en vez de tratar respuesta vacía como válida", async () => {
    for (const data of [
      {},
      { hits: { hits: [] } },
      cfpb([
        {
          ...complaint,
          _source: { ...complaint._source, complaint_id: "not-an-id" },
        },
      ]),
    ]) {
      expect(
        (await collectCfpb(undefined, now, async () => json(data))).state
          .status,
      ).toBe("error");
    }
  });
});

describe("importación estricta PROFECO", () => {
  const header =
    "Número de expediente;Fecha de ingreso;Proveedor;Motivo de reclamación;Giro comercial;Nombre consumidor;Correo electrónico;CURP";
  const row =
    'EXP/2025/001;28/02/2025;"Empresa; con comillas ""México""";Cobro indebido;Telefonía;PERSONA PRIVADA;private@example.com;AAAA000101HDFXXX00';
  it("acepta BOM, acentos, punto y coma y comillas escapadas sin retener datos personales", () => {
    const [record] = parseProfecoCsv(`\uFEFF${header}\r\n${row}`, now);
    expect(record).toMatchObject({
      id: "profeco:EXP%2F2025%2F001",
      externalId: "EXP/2025/001",
      country: "MX",
      occurredAt: "2025-02-28",
      historical: true,
      issue: "Cobro indebido",
      product: 'Empresa; con comillas "México"',
    });
    expect(record.quote).toContain("sin narrativa personal");
    expect(record.authorKey).toBeUndefined();
    expect(JSON.stringify(record)).not.toMatch(
      /PERSONA PRIVADA|private@example|AAAA000101/,
    );
  });
  it("acepta esquema administrativo sin motivo sin inventarlo y fechas ISO", () => {
    const [record] = parseProfecoCsv(
      'expediente,fecha_ingreso,proveedor,giro,estado_procesal\nE-1,2026-10-01,"Comercio, SA",Servicios,En trámite',
      now,
    );
    expect(record.issue).toBeUndefined();
    expect(record.quote).toContain("Giro/sector: Servicios");
    expect(record.quote).toContain("Estado procesal: En trámite");
  });
  it("deduplica expedientes idénticos y rechaza duplicados contradictorios", () => {
    expect(parseProfecoCsv(`${header}\n${row}\n${row}`, now)).toHaveLength(1);
    expect(() =>
      parseProfecoCsv(
        `${header}\n${row}\n${row.replace("Cobro indebido", "Negativa de devolución")}`,
        now,
      ),
    ).toThrow("contradictorios");
  });
  it("compara fechas futuras e histórico PROFECO como días mexicanos cerca de medianoche UTC", () => {
    const beforeMexicoMidnight = new Date("2026-10-31T02:00:00Z");
    const csv = (date: string) =>
      `expediente,fecha_ingreso,proveedor,giro\nE-1,${date},Empresa,Servicios`;
    expect(
      parseProfecoCsv(csv("2026-10-30"), beforeMexicoMidnight)[0].occurredAt,
    ).toBe("2026-10-30");
    expect(() =>
      parseProfecoCsv(csv("2026-10-31"), beforeMexicoMidnight),
    ).toThrow("Fecha futura");
    expect(
      parseProfecoCsv(csv("2026-09-30"), beforeMexicoMidnight)[0].historical,
    ).toBe(false);
    expect(
      parseProfecoCsv(csv("2026-09-29"), beforeMexicoMidnight)[0].historical,
    ).toBe(true);
  });
  it("rechaza fechas imposibles, ambiguas, futuras y ausentes", () => {
    for (const value of [
      "31/02/2025",
      "29/02/2025",
      "31/04/2025",
      "2025-02-30",
      "02/03/25",
      "2026-12-01",
      "",
    ])
      expect(() =>
        parseProfecoCsv(`${header}\n${row.replace("28/02/2025", value)}`, now),
      ).toThrow(/Fecha/);
    expect(
      parseProfecoCsv(
        `${header}\n${row.replace("28/02/2025", "29/02/2024")}`,
        now,
      )[0].occurredAt,
    ).toBe("2024-02-29");
  });
  it("rechaza agregados, esquemas ambiguos, expedientes ausentes y filas rotas", () => {
    for (const csv of [
      "fecha,total\n2025-01-01,300",
      `${header}\n${row};extra`,
      `${header}\n${row.replace("EXP/2025/001", "")}`,
      `expediente,expediente,fecha_ingreso,proveedor,giro\n1,1,2025-01-01,Empresa,Comercio`,
      `${header}\n${row.slice(0, 20)}"broken`,
      `${header}\n${row.replace('""México"""', '""México"""garbage')}`,
    ])
      expect(() => parseProfecoCsv(csv, now)).toThrow();
  });
  it("omite texto libre y redacta identificadores si aparecen en campos estructurados", () => {
    const csv =
      "expediente,fecha_ingreso,proveedor,motivo,relato,telefono,domicilio\nE1,2025-01-01,Empresa,Cobro a test@example.com,Nombre privado,5512345678,Calle secreta";
    const [record] = parseProfecoCsv(csv, now);
    expect(record.quote).toContain("[dato personal omitido]");
    expect(JSON.stringify(record)).not.toMatch(
      /test@example|Nombre privado|5512345678|Calle secreta/,
    );
  });
  it("aplica máximos 1 MiB y 500 filas originales incluyendo duplicados", () => {
    expect(() => parseProfecoCsv("ñ".repeat(600_000), now)).toThrow("1 MiB");
    expect(() =>
      parseProfecoCsv(
        `${header}\n${Array.from({ length: 501 }, () => row).join("\n")}`,
        now,
      ),
    ).toThrow("500");
    expect(
      parseProfecoCsv(
        `${header}\n${Array.from({ length: 500 }, () => row).join("\n")}`,
        now,
      ),
    ).toHaveLength(1);
  });
});
