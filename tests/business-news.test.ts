import { describe, expect, it } from "vitest";
import {
  businessFeeds,
  parseBusinessFeed,
  MAX_FEED_BYTES,
} from "@/features/business-news/feeds";
import {
  exportPage,
  parseExportQuery,
  verifyNewsSecret,
} from "@/features/business-news/export";
const now = new Date("2026-11-04T22:00:00Z");
const xml = (
  title: string,
  description = "",
  date = "Wed, 04 Nov 2026 15:00:00 GMT",
  link = "https://expansion.mx/empresas/noticia?utm_source=rss",
) =>
  `<rss version="2.0"><channel><title>Fuente</title><item><title>${title}</title><link>${link.replace(/&/g, "&amp;")}</link><description>${description}</description><pubDate>${date}</pubDate></item></channel></rss>`;
async function story() {
  return (
    await parseBusinessFeed(
      xml("Walmart anuncia nueva campaña en México", "Campaña para ecommerce."),
      businessFeeds[1],
      now,
    )
  )[0];
}
describe("archivo separado empresarial", () => {
  it("conserva identidad, original y fechas sin copiar cuerpos ni inventar intención", async () => {
    const x = await story();
    expect(x.canonicalUrl).toBe("https://expansion.mx/empresas/noticia");
    expect(x.originalUrl).toContain("utm_source=rss");
    expect(x.countryEvidence?.country).toBe("MX");
    expect(x.companyEvidence).toContainEqual({
      name: "Walmart",
      basis: "text_mention",
    });
    expect(x.buyingIntent).toBe("unknown");
    expect(x).not.toHaveProperty("excerpt");
    expect(JSON.stringify(x)).not.toContain("Campaña para ecommerce.");
  });
  it("no infiere país del editor y separa revisiones sin cambiar ID del artículo", async () => {
    const a = (
      await parseBusinessFeed(
        xml("Adobe lanza editor para creadores"),
        businessFeeds[1],
        now,
      )
    )[0];
    const b = (
      await parseBusinessFeed(
        xml("Adobe lanza editor para creadores", "Nueva versión"),
        businessFeeds[1],
        now,
      )
    )[0];
    expect(a.countryEvidence).toBeNull();
    expect(a.id).toBe(b.id);
    expect(a.revisionId).not.toBe(b.revisionId);
  });
  it("no confunde pie editorial mexicano con ubicación de la noticia", async () => {
    const [x] = await parseBusinessFeed(
      xml(
        "Adobe lanza editor",
        "Una herramienta global. La entrada Adobe lanza editor se publicó primero en Marketing4eCommerce México.",
        undefined,
        "https://marketing4ecommerce.mx/adobe",
      ),
      businessFeeds[2],
      now,
    );
    expect(x.countryEvidence).toBeNull();
  });
  it("descarta atribuciones y Nuevo México al identificar país", async () => {
    for (const [title, description] of [
      ["Adobe lanza editor", "Fuente: Marketing4eCommerce México."],
      ["Amazon abre tiendas en Nuevo México", ""],
      ["Amazon abre tiendas en New Mexico", ""],
    ]) {
      const [x] = await parseBusinessFeed(
        xml(title, description),
        businessFeeds[1],
        now,
      );
      expect(x.countryEvidence).toBeNull();
    }
  });
  it("detecta una marca fuera del catálogo sólo como mención", async () => {
    const [x] = await parseBusinessFeed(
      xml("Flying Tiger invertirá en México para abrir tiendas"),
      businessFeeds[1],
      now,
    );
    expect(x.companyEvidence).toContainEqual({
      name: "Flying Tiger",
      basis: "text_mention",
    });
  });
  it("una fecha o tema corregidos generan revisión, manteniendo la identidad del artículo", async () => {
    const a = (
      await parseBusinessFeed(
        xml("Adobe lanza producto", "", "Wed, 04 Nov 2026 15:00:00 GMT"),
        businessFeeds[1],
        now,
      )
    )[0];
    const b = (
      await parseBusinessFeed(
        xml("Adobe lanza producto", "", "Wed, 04 Nov 2026 16:00:00 GMT"),
        businessFeeds[1],
        now,
      )
    )[0];
    const c = (
      await parseBusinessFeed(
        xml("Adobe lanza producto").replace(
          "</item>",
          "<category>Marketing</category></item>",
        ),
        businessFeeds[1],
        now,
      )
    )[0];
    expect(a.id).toBe(b.id);
    expect(a.id).toBe(c.id);
    expect(a.revisionId).not.toBe(b.revisionId);
    expect(a.revisionId).not.toBe(c.revisionId);
  });
  it.each([
    "Elecciones y Trump: empresas opinan",
    "Vacantes de marketing en México",
    "Pensionados reciben aguinaldo",
  ])("descarta ruido: %s", async (title) => {
    expect(await parseBusinessFeed(xml(title), businessFeeds[1], now)).toEqual(
      [],
    );
  });
  it.each([
    "invalid",
    "Thu, 05 Nov 2026 15:00:00 GMT",
    "Mon, 01 Jan 2024 10:00:00 GMT",
    "",
  ])("no inventa fechas: %s", async (date) => {
    expect(
      await parseBusinessFeed(
        xml("Marcas y marketing", "", date),
        businessFeeds[1],
        now,
      ),
    ).toEqual([]);
  });
  it("rechaza destinos ajenos, secretos en URLs, DTD y tamaño excesivo", async () => {
    for (const url of [
      "https://private.example/marketing",
      "https://expansion.mx/empresas?token=secret",
      "https://expansion.mx/empresas#access_token=SHOULD_NOT_EXPORT",
      "http://expansion.mx/empresas",
    ])
      expect(
        await parseBusinessFeed(
          xml("Campaña de marcas", "", undefined, url),
          businessFeeds[1],
          now,
        ),
      ).toEqual([]);
    await expect(
      parseBusinessFeed("x".repeat(MAX_FEED_BYTES + 1), businessFeeds[1], now),
    ).rejects.toThrow();
    await expect(
      parseBusinessFeed(
        '<!DOCTYPE rss [<!ENTITY a "x">]>' + xml("Marcas"),
        businessFeeds[1],
        now,
      ),
    ).rejects.toThrow();
  });
});
describe("exportación acotada", () => {
  const key = "unit-test-news-export-secret-only-32-chars";
  it("sólo acepta el secreto dedicado y falla cerrado sin configuración", () => {
    expect(verifyNewsSecret("Bearer " + key, key)).toBe(true);
    for (const bad of [null, "Bearer wrong", key])
      expect(verifyNewsSecret(bad, key)).toBe(false);
    expect(verifyNewsSecret("Bearer " + key, "")).toBe(false);
  });
  it("valida límites, filtros y calendarios", () => {
    for (const query of [
      "limit=101",
      "limit=0",
      "country=US",
      "topic=private",
      "sourceId=private",
      "publishedFrom=2026-02-30",
      "publishedFrom=2026-11-05&publishedTo=2026-11-01",
      "unknown=1",
    ])
      expect(() => parseExportQuery(new URLSearchParams(query))).toThrow();
  });
  it("página estable con snapshot, sin filtrar datos extra y con cursor ligado a filtros", async () => {
    const x = await story();
    const values = [
      {
        ...x,
        observedAt: "2026-11-04T20:00:00.000Z",
        archiveSequence: 1,
        privateNote: "NO_COMPARTIR",
      },
      {
        ...x,
        id: "b",
        revisionId: "b",
        archiveSequence: 2,
        observedAt: "2026-11-04T21:01:00.000Z",
      },
      {
        ...x,
        id: "c",
        revisionId: "c",
        archiveSequence: 3,
        observedAt: "2026-11-04T23:00:00.000Z",
      },
    ];
    const query = parseExportQuery(new URLSearchParams("limit=1"));
    const first = exportPage(values, query, key, now, 2);
    expect(first.items).toHaveLength(1);
    expect(JSON.stringify(first)).not.toContain("NO_COMPARTIR");
    const next = parseExportQuery(
      new URLSearchParams("limit=1&cursor=" + first.nextCursor),
    );
    expect(exportPage(values, next, key, now).items.map((s) => s.id)).toEqual([
      "b",
    ]);
    expect(() =>
      exportPage(values, { ...next, country: "MX" }, key, now),
    ).toThrow();
    expect(() =>
      exportPage(values, { ...next, cursor: next.cursor + "X" }, key, now),
    ).toThrow();
    expect(() =>
      exportPage(values, next, key, new Date("2026-11-06T22:00:00Z")),
    ).toThrow();
  });
});
