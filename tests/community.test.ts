import { afterEach, describe, expect, it, vi } from "vitest";
import { parseRequestsForStartups } from "@/features/sources/yc";
import { loadCommunity } from "@/features/sources/community";
afterEach(() => vi.unstubAllGlobals());
describe("fuentes de investigación", () => {
  it("conserva un enlace por propuesta de YC y no atribuye fecha de publicación inventada", () => {
    const docs = parseRequestsForStartups(
      '<div id="invoice"><h3><a href="#invoice">Invoice tools</a></h3><div>Teams need help with invoices.</div></div><div id="ai"><h3><a href="#ai">AI infrastructure</a></h3><div>Another editorial proposal.</div></div>',
    );
    expect(docs).toHaveLength(2);
    expect(docs[0].excerpt).toBe("Teams need help with invoices.");
    expect(docs[0].url).toBe("https://www.ycombinator.com/rfs#invoice");
    expect(docs[0].id).not.toBe(docs[1].id);
    expect(docs[0].kind).toBe("research");
    expect(docs[0].publishedAt).toBe(new Date(0).toISOString());
  });
  it("obtiene autores, raíces y enlaces exactos de comentarios; omite respuestas borradas", async () => {
    const time = Date.now() / 1000;
    const objects: Record<string, unknown> = {
      askstories: [1],
      "item/1": {
        id: 1,
        type: "story",
        time,
        by: "alice",
        title: "Ask HN: What tools do you need?",
        kids: [2, 3],
      },
      "item/2": {
        id: 2,
        type: "comment",
        time,
        by: "bob",
        text: "I need an invoice reconciliation tool.",
      },
      "item/3": { id: 3, type: "comment", time, deleted: true },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string) =>
          new Response(
            JSON.stringify(
              objects[url.replace(/^.*\/v0\//, "").replace(/\.json$/, "")],
            ),
            { status: 200 },
          ),
      ),
    );
    const docs = await loadCommunity("ask");
    expect(docs).toHaveLength(2);
    expect(docs[1]).toMatchObject({
      author: "bob",
      kind: "comment",
      threadId: "1",
      url: "https://news.ycombinator.com/item?id=2",
    });
  });
  it("marca error si todos los hilos fallan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("askstories")
          ? new Response("[1]")
          : new Response("failure", { status: 500 }),
      ),
    );
    await expect(loadCommunity("ask")).rejects.toThrow("hilos");
  });
});
