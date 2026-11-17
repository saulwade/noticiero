import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/research/memory/route";
import { allowed } from "@/lib/access";
import { getIdeaMemory } from "@/features/idea-memory/service";
vi.mock("@/lib/access", () => ({ allowed: vi.fn() }));
vi.mock("@/features/idea-memory/service", () => ({ getIdeaMemory: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(allowed).mockResolvedValue(true);
  vi.mocked(getIdeaMemory).mockResolvedValue({
    version: "idea-memory-v1",
    definitions: [],
    decisions: [],
    assessments: [],
    assessmentCount: 0,
    linkedRevisions: 0,
    sourceCheckCount: 0,
  });
});
it("exige sesión y no accede a memoria privada antes de autorizar", async () => {
  vi.mocked(allowed).mockResolvedValue(false);
  expect(
    (
      await GET(
        new Request("https://noticiero-self.vercel.app/api/research/memory"),
      )
    ).status,
  ).toBe(401);
  expect(getIdeaMemory).not.toHaveBeenCalled();
});
it("exporta memoria sin caché y permite consultar el historial", async () => {
  const result = await GET(
    new Request(
      "https://noticiero-self.vercel.app/api/research/memory?history=1",
    ),
  );
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toContain("no-store");
  expect(getIdeaMemory).toHaveBeenCalledWith(expect.any(Date), true);
  const md = await GET(
    new Request(
      "https://noticiero-self.vercel.app/api/research/memory?format=md",
    ),
  );
  expect(md.headers.get("content-type")).toContain("text/markdown");
  expect(await md.text()).toContain("Memoria de ideas");
});
it("rechaza formatos desconocidos sin cambiar datos", async () => {
  expect(
    (
      await GET(
        new Request(
          "https://noticiero-self.vercel.app/api/research/memory?format=html",
        ),
      )
    ).status,
  ).toBe(400);
  expect(getIdeaMemory).not.toHaveBeenCalled();
});
it("valida el cursor y rechaza consultas parciales", async () => {
  expect(
    (
      await GET(
        new Request(
          "https://noticiero-self.vercel.app/api/research/memory?history=1&before=invalid&beforeId=x",
        ),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await GET(
        new Request(
          "https://noticiero-self.vercel.app/api/research/memory?before=2026-11-16T00:00:00Z&beforeId=x",
        ),
      )
    ).status,
  ).toBe(400);
  expect(getIdeaMemory).not.toHaveBeenCalled();
});
