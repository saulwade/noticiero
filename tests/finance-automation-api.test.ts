import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  prepare: vi.fn(),
  publish: vi.fn(),
  failed: vi.fn(),
}));
vi.mock("@/lib/access", () => ({ validServiceSecret: mocks.auth }));
vi.mock("@/features/finance/automatic-service", () => ({
  prepareAutomationInput: mocks.prepare,
  publishAutomationReport: mocks.publish,
  recordAutomationFailure: mocks.failed,
}));
import { POST } from "@/app/api/operations/finance/route";
const attemptId = "04315275-5524-4049-8a8c-f463a24b2fc3";
const request = (value: unknown) =>
  new Request("https://example.test/api/operations/finance", {
    method: "POST",
    body: JSON.stringify(value),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockReturnValue(true);
  mocks.prepare.mockResolvedValue({ inputHash: "private-context" });
  mocks.publish.mockResolvedValue({ message: "ok" });
});
describe("trabajo financiero privado", () => {
  it("no lee perfil ni publica sin credencial de servicio", async () => {
    mocks.auth.mockReturnValue(false);
    expect((await POST(request({ action: "prepare", attemptId }))).status).toBe(
      401,
    );
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.failed).not.toHaveBeenCalled();
  });
  it("vincula preparación, publicación y fallo a la ejecución identificada", async () => {
    const response = await POST(request({ action: "prepare", attemptId }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.prepare).toHaveBeenCalledWith(
      expect.any(Date),
      undefined,
      attemptId,
    );
    await POST(request({ action: "publish", attemptId, report: { id: "r" } }));
    expect(mocks.publish).toHaveBeenCalledWith(
      { id: "r" },
      expect.any(Date),
      attemptId,
    );
    await POST(request({ action: "failed", attemptId }));
    expect(mocks.failed).toHaveBeenCalledWith(
      undefined,
      expect.any(Date),
      attemptId,
    );
  });
  it("rechaza ejecuciones sin identidad y solicitudes enormes por bytes reales", async () => {
    expect((await POST(request({ action: "failed" }))).status).toBe(400);
    const huge = new Request("https://example.test/api/operations/finance", {
      method: "POST",
      body: "界".repeat(210_000),
    });
    expect((await POST(huge)).status).toBe(413);
    expect(mocks.failed).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
  it("no expone transporte, credenciales ni datos personales en errores", async () => {
    mocks.prepare.mockRejectedValue(
      new Error("postgres://private:password@host account-value secret"),
    );
    const response = await POST(request({ action: "prepare", attemptId }));
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toMatch(
      /password|postgres|account-value|secret/,
    );
  });
});
