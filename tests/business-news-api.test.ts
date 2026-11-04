import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { GET } from "@/app/api/news/export/route";
import { allowed } from "@/lib/access";
import { readBusinessExport } from "@/features/business-news/service";
vi.mock("@/lib/access", () => ({ allowed: vi.fn() }));
vi.mock("@/features/business-news/service", () => ({
  readBusinessExport: vi.fn(),
}));
const secret = "dedicated-news-read-only-test-credential-32";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEWS_EXPORT_SECRET", secret);
  vi.mocked(allowed).mockResolvedValue(false);
  vi.mocked(readBusinessExport).mockResolvedValue({ items: [] } as never);
});
afterEach(() => vi.unstubAllEnvs());
describe("API de sólo noticias", () => {
  it("falla cerrada, incluso con tokens de otras funciones, sin leer la base", async () => {
    for (const token of [undefined, "cron-test-token", "ops-test-token"]) {
      const response = await GET(
        new Request("https://example.test/api/news/export", {
          headers: token ? { authorization: `Bearer ${token}` } : {},
        }),
      );
      expect(response.status).toBe(401);
    }
    expect(readBusinessExport).not.toHaveBeenCalled();
  });
  it("acepta token exclusivo sin dar sesión o permisos para otros endpoints", async () => {
    const response = await GET(
      new Request("https://example.test/api/news/export?limit=10", {
        headers: { authorization: `Bearer ${secret}` },
      }),
    );
    expect(response.status).toBe(200);
    expect(allowed).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(readBusinessExport).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 }),
      secret,
    );
  });
  it("valida antes de leer y no devuelve detalles de excepción", async () => {
    const headers = { authorization: `Bearer ${secret}` };
    expect(
      (
        await GET(
          new Request("https://example.test/api/news/export?limit=999", {
            headers,
          }),
        )
      ).status,
    ).toBe(400);
    expect(readBusinessExport).not.toHaveBeenCalled();
    vi.mocked(readBusinessExport).mockRejectedValue(
      new Error("DATABASE-private-credential"),
    );
    const response = await GET(
      new Request("https://example.test/api/news/export", { headers }),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("credential");
  });
});
