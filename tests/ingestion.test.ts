import { describe, it, expect } from "vitest";
import {
  canonicalUrl,
  makeStory,
  safePublicUrl,
  plainText,
  classify,
} from "@/features/news/normalize";
import { groupStories, sameEvent } from "@/features/news/deduplicate";
import { parseFeed } from "@/features/sources/rss";
import { findCompanies } from "@/features/market/company-catalog";
import { storyMatches, resolveStorySource } from "@/lib/story-identity";
import { isTechnologyStory } from "@/features/news/relevance";

describe("normalización de noticias externas", () => {
  it("filtra deportes y política general, conservando noticias tecnológicas", () => {
    expect(isTechnologyStory("Brewers win the World Series title")).toBe(false);
    expect(isTechnologyStory("The GOP final midterms push")).toBe(false);
    expect(isTechnologyStory("Nvidia releases new developer tools")).toBe(true);
  });
  it("deduplica URLs de seguimiento y anclas conservando los parámetros reales", () => {
    expect(
      canonicalUrl(
        "https://www.example.com/story?utm_source=mail&story=2&fbclid=x#section",
      ),
    ).toBe("https://example.com/story?story=2");
  });
  it.each([
    "http://example.com",
    "javascript:alert(1)",
    "https://localhost:3000",
    "https://127.0.0.1/x",
    "https://[::1]/",
    "https://user:password@example.com",
    "https://service.internal/",
    "file:///etc/passwd",
  ])("rechaza un enlace inseguro %s", (url) => {
    expect(safePublicUrl(url)).toBeUndefined();
  });
  it("elimina HTML y el contenido de scripts", () => {
    expect(
      plainText('<p>Hello &amp; news</p><script>alert("x")</script>'),
    ).toBe("Hello & news");
  });
  it("solo relaciona nombres o productos presentes y con límite de palabra", () => {
    expect(
      findCompanies("OpenAI and NVIDIA announce a developer tool"),
    ).toEqual(expect.arrayContaining(["OPENAI", "NVDA"]));
    expect(findCompanies("metaphor and amplitude")).not.toContain("META");
    expect(findCompanies("metaphor and amplitude")).not.toContain("AMD");
  });
  it("clasifica temas tecnológicos sin inventar cotizaciones", () => {
    expect(classify("Nvidia GPU semiconductor chip")).toBe("Chips");
    expect(classify("OpenAI releases a model")).toBe("IA");
    expect(classify("Ransomware attack")).toBe("Seguridad");
  });
});
describe("agrupación conservadora", () => {
  const make = (title: string, url: string, sourceName = "Source") =>
    makeStory({ title, url, sourceName, sourceId: sourceName })!;
  it("agrupa el mismo evento y conserva los enlaces a las dos fuentes", () => {
    const a = make(
      "Nvidia releases developer toolkit for next generation graphics",
      "https://a.example.com/story",
      "A",
    );
    const b = make(
      "Nvidia releases developer toolkit for next generation graphics",
      "https://b.example.com/story",
      "B",
    );
    const grouped = groupStories([a, b]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].references).toHaveLength(2);
    expect(storyMatches(grouped[0], a.id)).toBe(true);
    expect(storyMatches(grouped[0], b.id)).toBe(true);
    expect(a.references).toHaveLength(1);
  });
  it("conserva la identidad del evento cuando un titular se traduce", () => {
    const a = make(
      "Nvidia releases developer toolkit for next generation graphics",
      "https://a.example.com/a",
    );
    const b = make(
      "Nvidia releases developer toolkit for next generation graphics",
      "https://b.example.com/b",
    );
    a.title = "Nvidia presenta herramientas para desarrolladores";
    expect(groupStories([a, b])).toHaveLength(1);
  });
  it("atribuye evidencia al artículo exacto aunque otra cobertura represente al grupo", () => {
    const a = make(
      "Nvidia releases developer toolkit for next generation graphics",
      "https://a.example.com/a",
      "A",
    );
    const b = {
      ...make(
        "Nvidia releases developer toolkit for next generation graphics",
        "https://b.example.com/b",
        "B",
      ),
      score: 200,
    };
    const grouped = groupStories([a, b]);
    expect(grouped[0].id).toBe(b.id);
    expect(resolveStorySource(grouped, a.id)).toMatchObject({
      name: "A",
      url: a.url,
    });
    expect(resolveStorySource(grouped, "missing")).toBeUndefined();
  });
  it("no fusiona anuncios distintos por mencionar la misma empresa", () => {
    expect(
      sameEvent(
        make("Nvidia releases new graphics cards", "https://a.example.com/a"),
        make(
          "Nvidia faces antitrust investigation in Europe",
          "https://a.example.com/b",
        ),
      ),
    ).toBe(false);
  });
});
describe("lector RSS", () => {
  it("conserva extracto, fuente, fecha y fotografía sin ejecutar HTML", async () => {
    const raw = `<rss version="2.0"><channel><title>Test</title><item><title>Microsoft developer news</title><link>https://example.com/news?utm_source=rss</link><pubDate>${new Date().toUTCString()}</pubDate><description><![CDATA[<p>${"An original excerpt with technical evidence. ".repeat(7)}</p><img src="https://images.example.com/photo.jpg"/>]]></description></item></channel></rss>`;
    const stories = await parseFeed(raw, { id: "test", name: "Test" });
    expect(stories).toHaveLength(1);
    expect(stories[0].imageUrl).toBe("https://images.example.com/photo.jpg");
    expect(stories[0].coverage).toBe("excerpt");
    expect(stories[0].excerpt).not.toContain("<p>");
    expect(stories[0].companies).toContain("MSFT");
    expect(stories[0].url).not.toContain("utm_source");
  });
});
