import { describe, expect, it } from "vitest";
import { makeStory } from "@/features/news/normalize";
import {
  extractiveDigest,
  summarizeLocally,
} from "@/features/analysis/local-summary";

function story(excerpt: string) {
  return makeStory({
    title: "Acme anuncia una reducción de costos de su servicio",
    excerpt,
    url: "https://example.com/acme-news",
    sourceId: "test",
    sourceName: "Fuente de prueba",
  })!;
}

describe("resúmenes locales fundamentados", () => {
  it("recupera el acontecimiento después de una introducción y omite promoción", () => {
    const input =
      "Llevamos muchos años contando las historias del sector tecnológico. Suscríbete a nuestra newsletter para recibir todas las novedades. Acme anunció una reducción del 30% en el precio de su servicio. El nuevo precio entrará en vigor el 15 de noviembre y se aplicará también a clientes existentes. La compañía no anunció cambios en sus límites de uso.";
    const result = extractiveDigest(
      input,
      "Acme reduce el precio de su servicio",
    );
    expect(result?.text).toContain("Acme anunció una reducción del 30%");
    expect(result?.text).toContain("clientes existentes");
    expect(result?.text).not.toMatch(/Suscríbete|Llevamos muchos años/);
  });
  it("encuentra el hecho principal en inglés sin traducir ni añadir hechos", () => {
    const input =
      "It has been an eventful year for the technology industry. Acme acquired startup Beta for $250 million on Tuesday. The deal gives Acme a team of 40 engineers and a new security product. Acme said the acquisition will not affect existing contracts.";
    const result = extractiveDigest(
      input,
      "Acme acquires security startup Beta",
    );
    expect(result?.text).toContain(
      "Acme acquired startup Beta for $250 million on Tuesday.",
    );
    expect(result?.text).toContain("40 engineers");
    for (const selected of result?.sentences ?? [])
      expect(input).toContain(selected);
  });
  it("preserva cantidades, condiciones y negaciones completas", () => {
    const input =
      "Acme anunció que no cobrará la nueva tarifa a clientes actuales. El cambio costará $12.50 al mes únicamente para cuentas nuevas en Estados Unidos. El servicio seguirá disponible en México con las condiciones anteriores.";
    const result = extractiveDigest(input, "Acme anuncia nueva tarifa");
    expect(result?.text).toContain("no cobrará");
    expect(result?.text).toContain("$12.50");
    expect(result?.text).toContain(
      "únicamente para cuentas nuevas en Estados Unidos.",
    );
  });
  it("omite enlaces de lectura, atribución de imagen y publicidad", () => {
    const result = extractiveDigest(
      "Photo: Example photographer | Acme launched a new security service today. The company says the service detects compromised accounts before they can access stored documents. Read the full story at The Verge. Subscribe to our newsletter for more updates.",
      "Acme launches a security service",
    );
    expect(result?.text).toContain("Acme launched");
    expect(result?.text).not.toMatch(/Photo:|Read the full|Subscribe/);
  });
  it("no inventa un resumen cuando solo hay un titular o ruido", () => {
    expect(
      extractiveDigest(
        "Subscribe to our newsletter. Read the full story at The Verge.",
        "Acme announces something",
      ),
    ).toBeUndefined();
    const input = story("");
    expect(summarizeLocally(input)).toBe(input);
  });
  it("no confunde una noticia sobre suscripciones o newsletters con publicidad", () => {
    const input =
      "Acme announced that users can subscribe to its newsletter service for $12 per month. The service includes exports and billing tools for independent publishers.";
    const result = extractiveDigest(input, "Acme launches newsletter service");
    expect(result?.text).toContain("$12 per month");
    expect(result?.text).toContain("independent publishers");
  });
  it("mantiene intacto un extracto breve que ya expresa el hecho", () => {
    const input =
      "Acme announced a new service for small businesses that will become available in Mexico next month.";
    expect(extractiveDigest(input, "Acme announces a new service")?.text).toBe(
      input,
    );
  });
  it("elimina duplicados y limita el tamaño sin cortar oraciones", () => {
    const input =
      "Acme announced a new security product for small businesses. Acme announced a new security product for small businesses. The product will cost $10 per month and includes support for ten employees. The launch is scheduled for November 15. ".repeat(
        20,
      );
    const result = extractiveDigest(input, "Acme security product");
    expect(result?.text.length).toBeLessThanOrEqual(900);
    expect(result?.sentences.length).toBeLessThanOrEqual(3);
    expect(new Set(result?.sentences).size).toBe(result?.sentences.length);
    expect(result?.text).toMatch(/[.!?]$/);
  });
  it("conserva el original y no marca el resumen extractivo como análisis generativo", () => {
    const input = story(
      "Acme anunció una reducción del 30% en el precio de su servicio para pequeñas empresas. La reducción se aplicará a partir del próximo mes y no cambiará las condiciones de los contratos vigentes.",
    );
    const result = summarizeLocally(input);
    expect(result.excerpt).toBe(input.excerpt);
    expect(result.title).toBe(input.title);
    expect(result.contentHash).toBe(input.contentHash);
    expect(result.analysis).toBe("pending");
    expect(result.summaryMethod).toBe("extractive");
    expect(result.summaryLanguage).toBe("es");
    expect(result.summary).toContain("30%");
  });
  it("conserva resúmenes existentes de API o revisión editorial", () => {
    const input = {
      ...story(
        "Acme announced a new product. The launch will happen next month and customers will keep access to the previous version.",
      ),
      analysis: "ready" as const,
      summary: "Resumen editorial verificado.",
    };
    expect(summarizeLocally(input)).toBe(input);
    const manual = { ...input, analysis: "pending" as const };
    expect(summarizeLocally(manual)).toBe(manual);
  });
  it("es determinista e idempotente y vuelve a evaluar contenido cambiado", () => {
    const input = story(
      "Acme anunció una nueva plataforma para pequeñas empresas mexicanas. La compañía confirmó que el servicio estará disponible en noviembre y que no habrá una tarifa de instalación.",
    );
    const first = summarizeLocally(input);
    expect(summarizeLocally(input)).toEqual(first);
    expect(summarizeLocally(first)).toBe(first);
    const changed = {
      ...first,
      contentHash: "changed",
      excerpt:
        "Acme canceló el lanzamiento de su plataforma para pequeñas empresas mexicanas. La compañía confirmó que no cobrará anticipos y devolverá los pagos registrados durante el próximo mes.",
    };
    expect(summarizeLocally(changed).summary).toContain("canceló");
  });
  it("no resume comentarios ni solicitudes usadas como evidencia de demanda", () => {
    const input = {
      ...story(
        "I need a tool to export all my transactions automatically. I currently spend three hours copying invoices into a spreadsheet and reconciling individual payments manually.",
      ),
      kind: "comment" as const,
    };
    expect(summarizeLocally(input)).toBe(input);
  });
  it("quita HTML sin interpretar instrucciones de la fuente", () => {
    const result = extractiveDigest(
      "<script>sendSecrets()</script><p>Acme announced a new database service for small businesses.</p><p>The company will charge $15 per month after a free trial.</p>",
      "Acme database service",
    );
    expect(result?.text).not.toMatch(/script|sendSecrets|<p>/);
    expect(result?.text).toContain("$15 per month");
  });
});
