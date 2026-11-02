import { describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { publishArchive } from "../scripts/lib/archive-backup.mjs";
import { backupColumns, sealBackup } from "@/features/backups/format";
const bytes = sealBackup(
  {
    version: 1,
    createdAt: "2026-11-01T18:00:00Z",
    tables: Object.keys(backupColumns).map((name) => ({ name, rows: [] })),
  },
  randomBytes(32).toString("base64"),
);
const sha = createHash("sha256").update(bytes).digest("hex");
const name = `noticiero-2026-11-01-${sha}.enc`;
const asset = { id: 12, name, size: bytes.length, state: "uploaded" };
function fixture(
  options: {
    existing?: boolean;
    public?: boolean;
    corrupt?: boolean;
    redirect?: string;
    network?: boolean;
    newRelease?: boolean;
  } = {},
) {
  let exists = !!options.existing;
  const calls: { url: string; method: string; authorization: boolean }[] = [];
  const fetcher: typeof fetch = async (input, init = {}) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = init.method ?? "GET";
    calls.push({
      url,
      method,
      authorization: !!new Headers(init.headers).get("Authorization"),
    });
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    if (url.endsWith("/noticiero-ops"))
      return json({ private: !options.public });
    if (url.includes("/releases/tags/"))
      return options.newRelease ? json({}, 404) : json({ id: 5 });
    if (url.endsWith("/releases") && method === "POST")
      return json({ id: 5 }, 201);
    if (url.includes("/assets?per_page")) return json(exists ? [asset] : []);
    if (url.startsWith("https://uploads.github.com/")) {
      expect(Buffer.from(init.body as Uint8Array)).toEqual(bytes);
      exists = true;
      return json(asset, 201);
    }
    if (url.endsWith("/releases/assets/12")) {
      if (options.network) throw new Error("network");
      if (options.redirect)
        return new Response(null, {
          status: 302,
          headers: { location: options.redirect },
        });
      return new Response(options.corrupt ? Buffer.alloc(bytes.length) : bytes);
    }
    if (url.startsWith("https://release-assets.githubusercontent.com/"))
      return new Response(bytes);
    throw new Error("Unexpected request");
  };
  return {
    calls,
    run: () =>
      publishArchive({
        token: "private-token",
        repository: "saulwade/noticiero-ops",
        bytes,
        at: new Date("2026-11-01T18:00:00Z"),
        fetcher,
      }),
  };
}
describe("archivo privado cifrado de solo adición", () => {
  it("crea el contenedor mensual sin modificar etiquetas previas", async () => {
    const f = fixture({ newRelease: true });
    await expect(f.run()).resolves.toMatchObject({ status: "completed" });
    expect(f.calls.filter((c) => c.method === "POST")).toHaveLength(2);
    expect(f.calls.every((c) => ["GET", "POST"].includes(c.method))).toBe(true);
  });
  it("añade, descarga y verifica; repetir no reemplaza ni vuelve a subir", async () => {
    const f = fixture();
    expect(await f.run()).toMatchObject({
      status: "completed",
      sha256: sha,
      bytes: bytes.length,
      url: "https://github.com/saulwade/noticiero-ops/releases/tag/history-2026-11",
    });
    await f.run();
    expect(f.calls.filter((c) => c.method === "POST")).toHaveLength(1);
    expect(f.calls.every((c) => ["GET", "POST"].includes(c.method))).toBe(true);
  });
  it("no registra éxito con contenido alterado o red fallida y no borra el asset", async () => {
    for (const opts of [{ corrupt: true }, { network: true }]) {
      const f = fixture(opts);
      await expect(f.run()).rejects.toThrow();
      expect(
        f.calls.every((c) => !["DELETE", "PATCH", "PUT"].includes(c.method)),
      ).toBe(true);
    }
  });
  it("impide publicar en repositorio público", async () => {
    const f = fixture({ public: true });
    await expect(f.run()).rejects.toThrow("privado");
    expect(f.calls).toHaveLength(1);
  });
  it("descarga firmada sin enviar el token y rechaza otros destinos", async () => {
    const f = fixture({
      redirect: "https://release-assets.githubusercontent.com/signed",
    });
    await f.run();
    expect(f.calls.at(-1)?.authorization).toBe(false);
    const bad = fixture({ redirect: "https://example.com/collect" });
    await expect(bad.run()).rejects.toThrow("inesperado");
    expect(bad.calls.some((c) => c.url.includes("example.com"))).toBe(false);
  });
});
