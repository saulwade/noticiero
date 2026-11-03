import { describe, it, expect } from "vitest";
import { keywordSummary } from "@/features/research/keyword-summary";
describe("palabras clave sin inflar revisiones", () => {
  it("cuenta documentos y normaliza variantes sin modificar el archivo", () => {
    const rows = [
      {
        id: "a1",
        storyId: "a",
        at: "2026-11-01T18:00:00Z",
        keywords: ["agent", "agents", "pro", "says"],
      },
      {
        id: "a2",
        storyId: "a",
        at: "2026-11-02T18:00:00Z",
        keywords: ["agents", "agent", "claude"],
      },
      {
        id: "b",
        storyId: "b",
        at: "2026-11-02T18:00:00Z",
        keywords: ["agentes", "models"],
      },
    ];
    const original = JSON.stringify(rows),
      result = keywordSummary(rows, "2026-11-01", "2026-11-02");
    expect(result.documents).toBe(2);
    expect(result.keywords).toContainEqual({ term: "agente", documents: 2 });
    expect(result.keywords).not.toContainEqual({ term: "says", documents: 1 });
    expect(JSON.stringify(rows)).toBe(original);
  });
  it("no usa revisiones posteriores a la fecha de corte", () => {
    const rows = [
      {
        id: "a1",
        storyId: "a",
        at: "2026-11-01T18:00:00Z",
        keywords: ["apple"],
      },
      {
        id: "a2",
        storyId: "a",
        at: "2026-11-03T18:00:00Z",
        keywords: ["google"],
      },
    ];
    expect(keywordSummary(rows, "2026-11-01", "2026-11-01").keywords).toEqual([
      { term: "apple", documents: 1 },
    ]);
  });
});
