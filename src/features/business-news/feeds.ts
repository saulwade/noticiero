import Parser from "rss-parser";
import {
  canonicalUrl,
  hash,
  plainText,
  safePublicUrl,
} from "@/features/news/normalize";
import { businessTopics, type BusinessNews, type BusinessTopic } from "./types";

export const businessFeeds = [
  {
    id: "mx-economista",
    name: "El Economista",
    url: "https://www.eleconomista.com.mx/rss/ultimas-noticias",
    host: "eleconomista.com.mx",
  },
  {
    id: "mx-expansion",
    name: "Expansión",
    url: "https://expansion.mx/rss",
    host: "expansion.mx",
  },
  {
    id: "mx-m4e",
    name: "Marketing4eCommerce México",
    url: "https://marketing4ecommerce.mx/feed/",
    host: "marketing4ecommerce.mx",
  },
] as const;
export type BusinessFeed = (typeof businessFeeds)[number];
export const MAX_FEED_BYTES = 2_000_000;
const patterns: Record<BusinessTopic, RegExp> = {
  marketing:
    /\b(marketing|mercadotecnia|publicidad|campa[ñn]as?|marcas?|branding|anunciantes?|linkedin)\b/i,
  creators:
    /\b(creadores?|influencers?|creators?|ugc|tiktok|youtube|contenido|capcut)\b/i,
  ecommerce:
    /\b(ecommerce|e-commerce|comercio electr[oó]nico|marketplaces?|retail|buen fin|tiendas?|consumidor|compras? en l[ií]nea)\b/i,
  launch: /\b(lanza|lanzan|lanzamiento|estrena|presenta|nuevo producto)\b/i,
  expansion:
    /\b(expansi[oó]n|expandir|expande|apertura|abrir[aá]|abre|nuevas sucursales|nuevos mercados)\b/i,
  funding:
    /\b(financiaci[oó]n|financiamiento|ronda|levanta capital|inversi[oó]n|adquisici[oó]n|adquiere|fusiona|startup|emprendimiento)\b/i,
  business:
    /\b(empresas?|negocios|corporativ[oa]|alianza|ingresos|ventas|resultados|servicios|clientes|ceo|fundador|proveedores?)\b/i,
};
const brands = [
  "Walmart",
  "Amazon",
  "Mercado Libre",
  "Liverpool",
  "Coppel",
  "Tiendanube",
  "Kavak",
  "Clip",
  "Openbank",
  "Santander",
  "Televisa",
  "AT&T",
  "Izzi",
  "Sky",
  "Banorte",
  "Getlinko",
  "Adobe",
  "TikTok",
  "Meta",
  "Google",
  "Unilever",
  "Bimbo",
  "Oxxo",
  "FEMSA",
];
const parser = new Parser();
export async function parseBusinessFeed(
  raw: string,
  source: BusinessFeed,
  now = new Date(),
): Promise<BusinessNews[]> {
  if (
    Buffer.byteLength(raw, "utf8") > MAX_FEED_BYTES ||
    /<!DOCTYPE|<!ENTITY/i.test(raw)
  )
    throw new Error("Feed no permitido.");
  const feed = await parser.parseString(raw);
  const observedAt = now.toISOString();
  return feed.items
    .slice(0, 100)
    .flatMap((item) => {
      const originalUrl = safePublicUrl(item.link);
      const title = plainText(item.title ?? "").slice(0, 400);
      const date = item.isoDate ?? item.pubDate;
      if (!originalUrl || !title || !date) return [];
      const parsed = new URL(originalUrl);
      if (
        parsed.hostname.replace(/^www\./, "") !== source.host ||
        parsed.hash !== "" ||
        [...parsed.searchParams.keys()].some((k) =>
          /token|secret|password|email|cookie|signature|auth|session|jwt|api[_-]?key/i.test(
            k,
          ),
        )
      )
        return [];
      const timestamp = Date.parse(date);
      if (
        !Number.isFinite(timestamp) ||
        timestamp > now.getTime() ||
        timestamp < now.getTime() - 7 * 86400_000
      )
        return [];
      // Descriptions classify context in memory; neither article bodies nor feed descriptions are stored/exported.
      const description = plainText(item.contentSnippet ?? item.content ?? "")
        .replace(
          /(?:La entrada|El art[ií]culo|The post)\b[\s\S]*?(?:se public[oó] primero|appeared first on)[\s\S]*$/i,
          "",
        )
        .replace(
          /(?:Fuente|Source|Cr[eé]ditos?|Publicado por|Published by)\s*:[\s\S]*$/i,
          "",
        )
        .trim()
        .slice(0, 800);
      // Broad news feeds contain politics and personal-finance how-tos: use the publisher's business sections too.
      if (
        source.id === "mx-economista" &&
        !/^\/(empresas|el-empresario|tecnologia)\//.test(parsed.pathname)
      )
        return [];
      if (
        source.id === "mx-expansion" &&
        !/^\/(empresas|mercadotecnia|emprendedores|tecnologia)\//.test(
          parsed.pathname,
        )
      )
        return [];
      if (
        /\b(elecci[oó]n(?:es)?|trump|sheinbaum|ebrard|congreso|aranceles?|d[eé]ficit comercial|detenci[oó]n|asesinato|f[uú]tbol|hor[oó]scopo|oferta laboral|vacantes?|pensiones?|pensionados?|aguinaldo|buz[oó]n tributario)\b/i.test(
          title,
        )
      )
        return [];
      const topics = businessTopics.filter((topic) =>
        patterns[topic].test(
          topic === "business"
            ? title
            : `${title} ${(item.categories ?? []).join(" ")}`,
        ),
      );
      if (!topics.length) return [];
      // A publisher's location is not evidence of the subject's country.
      const countryText =
        `${title} ${description.replace(/Marketing4eCommerce\s+M[eé]xico|Expansi[oó]n\s+M[eé]xico/gi, "")}`
          .replace(/\b(?:new|nuevo|nueva)\s+m[eé]xico\b/gi, "")
          .replace(/\b(?:golfo de|gulf of)\s+m[eé]xico\b/gi, "");
      const countryMention = countryText.match(
        /\b(?:m[eé]xico|mexican[oa]s?|cdmx|ciudad de m[eé]xico|monterrey|guadalajara)\b/i,
      )?.[0];
      const canonical = canonicalUrl(originalUrl);
      const id = hash(canonical);
      const contentHash = hash(
        JSON.stringify({
          title,
          description,
          publishedAt: new Date(timestamp).toISOString(),
          topics,
          countryMention,
          rules: "business-v1",
        }),
      );
      const revisionId = hash(`${source.id}:${id}:${contentHash}`);
      const namedPrefix = title.match(
        /^([\p{Lu}][\p{L}\p{N}&’'.-]*(?: [\p{L}\p{N}&’'.-]+){0,4})\s+(?:anuncia|invertir[aá]|invierte|lanza|lanzar[aá]|adquiere|compra|comprar[aá]|abre|abrir[aá]|expande|combinar[aá]|presenta|recibe|levanta)(?=\s|[.,:;!?]|$)/u,
      )?.[1];
      const companies = brands.filter((name) =>
        new RegExp(
          `(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}\\p{N}]|$)`,
          "iu",
        ).test(title),
      );
      if (
        namedPrefix &&
        !/^(el|la|los|las|un|una|se|nueva?|c[oó]mo|qu[eé])\b/i.test(namedPrefix)
      )
        companies.push(namedPrefix);
      const labels: Record<BusinessTopic, string> = {
        marketing: "marketing y marcas",
        creators: "creadores y contenido",
        ecommerce: "comercio electrónico",
        launch: "lanzamientos",
        expansion: "expansión empresarial",
        funding: "inversión y emprendimiento",
        business: "actividad empresarial",
      };
      return [
        {
          id,
          revisionId,
          canonicalUrl: canonical,
          originalUrl,
          title,
          sourceId: source.id,
          sourceName: source.name,
          publishedAt: new Date(timestamp).toISOString(),
          observedAt,
          queriedAt: observedAt,
          contentHash,
          countryEvidence: countryMention
            ? {
                country: "MX" as const,
                basis: "explicit_mention" as const,
                mention: countryMention,
              }
            : null,
          companyEvidence: [...new Set(companies)].map((name) => ({
            name,
            basis: "text_mention" as const,
          })),
          topics,
          briefParaphrase: `Contexto editorial sobre ${topics
            .slice(0, 3)
            .map((t) => labels[t])
            .join(
              ", ",
            )}${countryMention ? ", con una mención de México" : ""}. Revisar el enlace original para confirmar el alcance del anuncio.`,
          summaryMethod: "headline_context_rules" as const,
          dateProvenance: "feed_declared" as const,
          buyingIntent: "unknown" as const,
        },
      ];
    })
    .slice(0, 30);
}

export async function loadBusinessFeed(
  source: BusinessFeed,
  now = new Date(),
): Promise<BusinessNews[]> {
  const response = await fetch(source.url, {
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
    headers: {
      "User-Agent": "Noticiero/0.1 (personal RSS reader)",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  });
  if (!response.ok || !response.body) throw new Error("Fuente no disponible.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_FEED_BYTES) throw new Error("Feed demasiado grande.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return parseBusinessFeed(Buffer.concat(chunks).toString("utf8"), source, now);
}
