import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  allowed: vi.fn(),
  sameOrigin: vi.fn(),
  get: vi.fn(),
  action: vi.fn(),
}));
vi.mock("@/lib/access", () => ({
  allowed: fake.allowed,
  sameOrigin: fake.sameOrigin,
}));
vi.mock("@/features/finance/service", () => ({
  getFinanceData: fake.get,
  financeAction: fake.action,
}));
import { GET, POST } from "@/app/api/finance/route";
beforeEach(() => {
  vi.clearAllMocks();
  fake.allowed.mockResolvedValue(true);
  fake.sameOrigin.mockReturnValue(true);
  fake.get.mockResolvedValue({ summary: { valueMxn: "0" } });
  fake.action.mockResolvedValue({ message: "Guardado" });
});
describe("API financiera privada", () => {
  it("cierra lectura y escritura sin acceso y no consulta los saldos", async () => {
    fake.allowed.mockResolvedValue(false);
    expect(
      (await GET(new Request("https://example.com/api/finance"))).status,
    ).toBe(401);
    expect(
      (
        await POST(
          new Request("https://example.com/api/finance", {
            method: "POST",
            body: "{}",
          }),
        )
      ).status,
    ).toBe(403);
    expect(fake.get).not.toHaveBeenCalled();
    expect(fake.action).not.toHaveBeenCalled();
  });
  it("rechaza escrituras de otro origen y limita bytes reales sin content-length", async () => {
    fake.sameOrigin.mockReturnValue(false);
    expect(
      (
        await POST(
          new Request("https://example.com/api/finance", {
            method: "POST",
            body: "{}",
          }),
        )
      ).status,
    ).toBe(403);
    fake.sameOrigin.mockReturnValue(true);
    expect(
      (
        await POST(
          new Request("https://example.com/api/finance", {
            method: "POST",
            body: "界".repeat(400000),
          }),
        )
      ).status,
    ).toBe(413);
    expect(fake.action).not.toHaveBeenCalled();
  });
  it("no filtra SQL, credenciales o detalles de red y desactiva caché", async () => {
    fake.action.mockRejectedValue(
      Object.assign(
        new Error("password authentication failed for user private-account"),
        { code: "28P01" },
      ),
    );
    const response = await POST(
      new Request("https://example.com/api/finance", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toContain(
      "private-account",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(
      (await GET(new Request("https://example.com/api/finance"))).headers.get(
        "cache-control",
      ),
    ).toBe("private, no-store");
  });
});
