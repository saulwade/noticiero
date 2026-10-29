import { afterEach, describe, expect, it, vi } from "vitest";
import { localHost, sameOrigin, validCron } from "@/lib/access";
vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));
afterEach(() => vi.unstubAllEnvs());
describe("acceso privado", () => {
  it("solo permite loopback y nunca lo usa para omitir autenticación en Vercel", () => {
    vi.stubEnv("VERCEL", "");
    expect(localHost("localhost:3000")).toBe(true);
    expect(localHost("localhost.attacker.com")).toBe(false);
    vi.stubEnv("VERCEL", "1");
    expect(localHost("localhost:3000")).toBe(false);
  });
  it("rechaza escrituras con un origen externo", () => {
    expect(
      sameOrigin(
        new Request("http://localhost:3000/api/preferences", {
          headers: {
            host: "localhost:3000",
            origin: "https://attacker.example.com",
          },
        }),
      ),
    ).toBe(false);
  });
  it("exige la credencial de cron y falla cerrado cuando no está configurada", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(validCron(new Request("http://localhost"))).toBe(false);
    vi.stubEnv("CRON_SECRET", "unit-test-only");
    expect(
      validCron(
        new Request("http://localhost", {
          headers: { authorization: "Bearer wrong" },
        }),
      ),
    ).toBe(false);
    expect(
      validCron(
        new Request("http://localhost", {
          headers: { authorization: "Bearer unit-test-only" },
        }),
      ),
    ).toBe(true);
  });
});
