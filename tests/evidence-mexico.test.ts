import { describe, it, expect, vi } from "vitest";
import {
  collectGithubMexico,
  MEXICO_EVIDENCE_REPOSITORIES,
} from "@/features/evidence/connectors";
const now = new Date("2026-11-07T16:00:00Z");
const item = {
  id: 77,
  number: 12,
  title: "Error al descargar CFDI",
  body: "No puedo descargar los CFDI del SAT porque la solicitud falla.",
  html_url: "https://github.com/phpcfdi/sat-ws-descarga-masiva/issues/12",
  repository_url: "https://api.github.com/repos/phpcfdi/sat-ws-descarga-masiva",
  created_at: "2026-11-06T12:00:00Z",
  updated_at: "2026-11-07T12:00:00Z",
  user: { login: "example", type: "User" },
  state: "open",
};
const response = (items: unknown[] = [item]) =>
  new Response(
    JSON.stringify({
      total_count: items.length,
      incomplete_results: false,
      items,
    }),
  );
describe("muestra técnica pública CFDI México", () => {
  it("consulta repositorios verificados sin credenciales y usa cursor separado sin inferir país", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response());
    const result = await collectGithubMexico(undefined, now, fetcher);
    expect(result.state.id).toBe("github-mx");
    expect(result.records[0]).toMatchObject({
      source: "github",
      product: "phpcfdi/sat-ws-descarga-masiva",
      authorKey: "github:example",
      occurredAt: "2026-11-06T12:00:00.000Z",
    });
    expect(result.records[0].country).toBeUndefined();
    const [url, init] = fetcher.mock.calls[0];
    for (const repo of MEXICO_EVIDENCE_REPOSITORIES)
      expect(new URL(url as string).searchParams.get("q")).toContain(
        `repo:${repo}`,
      );
    expect(new URL(url as string).searchParams.get("per_page")).toBe("20");
    expect(JSON.stringify(init)).not.toContain("Authorization");
    const again = await collectGithubMexico(result.state, now, fetcher);
    expect(again.state.cursor).toBe(result.state.cursor);
  });
  it("respeta rate limit y no mezcla su estado con el conector global", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response("", { status: 429, headers: { "Retry-After": "3600" } }),
    );
    const result = await collectGithubMexico(undefined, now, fetcher);
    expect(result.state).toMatchObject({
      id: "github-mx",
      status: "limited",
      blocked: true,
    });
    await collectGithubMexico(
      result.state,
      new Date(now.getTime() + 1000),
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rechaza origen, fechas futuras y cuerpo excesivo conservando el historial", async () => {
    for (const invalid of [
      {
        ...item,
        repository_url: "https://api.github.com/repos/private/secret",
      },
      { ...item, updated_at: "2026-11-08T12:00:00Z" },
      { ...item, created_at: "invalid" },
    ]) {
      const result = await collectGithubMexico(undefined, now, async () =>
        response([invalid]),
      );
      expect(result.state.status).toBe("error");
      expect(result.records).toEqual([]);
    }
    const large = await collectGithubMexico(
      undefined,
      now,
      async () =>
        new Response("x", { headers: { "content-length": "1048577" } }),
    );
    expect(large.state.status).toBe("error");
  });
});
