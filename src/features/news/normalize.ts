import { createHash } from "node:crypto";
import type { Category, Story } from "@/lib/types";
import { findCompanies } from "@/features/market/company-catalog";

export function plainText(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) => {
      const point =
        code[0].toLowerCase() === "x"
          ? parseInt(code.slice(1), 16)
          : Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : " ";
    })
    .replace(/\s+/g, " ")
    .trim();
}
export function safePublicUrl(input?: string): string | undefined {
  if (!input) return;
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password) return;
    const host = url.hostname.toLowerCase();
    if (
      !host.includes(".") ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
      host.includes(":") ||
      /(^|\.)(localhost|local|internal|test|invalid)$/.test(host) ||
      host.endsWith(".local")
    )
      return;
    return url.href;
  } catch {
    return;
  }
}
export function canonicalUrl(input: string): string {
  const url = new URL(input);
  for (const key of [...url.searchParams.keys()])
    if (/^(utm_|fbclid$|gclid$|ref$|ref_src$)/.test(key))
      url.searchParams.delete(key);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.searchParams.sort();
  return url.href.replace(/\/$/, "");
}
export function hash(input: string) {
  return createHash("sha256").update(input).digest("hex").slice(0, 24);
}
export function classify(text: string): Category {
  if (
    /\b(ai|artificial intelligence|llm|openai|anthropic|claude|chatgpt|inteligencia artificial|machine learning|gemini)\b/i.test(
      text,
    )
  )
    return "IA";
  if (/\b(chip|chips|semiconductor|nvidia|amd|intel|gpu|tsmc)\b/i.test(text))
    return "Chips";
  if (
    /\b(hack|hacked|breach|malware|vulnerability|security|ransomware|cybersecurity)\b/i.test(
      text,
    )
  )
    return "Seguridad";
  if (
    /\b(finance|financial|bank|banks|banking|payments?|lending|loan|loans|credit|mortgage|inflation|interest rates?|federal reserve|fintech|finanzas|financiero|banca|crédito)\b/i.test(
      text,
    )
  )
    return "Finanzas";
  if (
    /\b(payroll|bookkeeping|inventory|logistics|supply chain|procurement|small business|smb|pymes|nómina|inventario|contabilidad|conciliación|logística)\b/i.test(
      text,
    )
  )
    return "Operaciones";
  if (
    /\b(startup|funding|raises|seed|series [a-d]|show hn|launch)\b/i.test(text)
  )
    return "Startups";
  if (
    /\b(stock|revenue|earnings|acquisition|antitrust|billion|market|ipo|layoffs)\b/i.test(
      text,
    )
  )
    return "Negocios";
  return "Software";
}
export function makeStory(input: {
  title: string;
  url: string;
  excerpt?: string;
  sourceId: string;
  sourceName: string;
  publishedAt?: string;
  imageUrl?: string;
  score?: number;
}): Story | undefined {
  const safeUrl = safePublicUrl(input.url);
  const title = plainText(input.title).slice(0, 400);
  if (!safeUrl || !title) return;
  const url = canonicalUrl(safeUrl);
  const excerpt = plainText(input.excerpt ?? "").slice(0, 9000);
  const published = new Date(input.publishedAt ?? Date.now());
  const publishedAt =
    Number.isNaN(published.getTime()) ||
    published.getTime() > Date.now() + 3600000
      ? new Date().toISOString()
      : published.toISOString();
  return {
    id: hash(url),
    url,
    title,
    originalTitle: title,
    excerpt,
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    publishedAt,
    detectedAt: new Date().toISOString(),
    imageUrl: safePublicUrl(input.imageUrl),
    imageCredit: input.imageUrl ? input.sourceName : undefined,
    coverage: excerpt.length > 150 ? "excerpt" : "headline",
    analysis: "pending",
    category: classify(`${title} ${excerpt.slice(0, 300)}`),
    companies: findCompanies(`${title} ${excerpt}`),
    references: [{ name: input.sourceName, url }],
    score: input.score ?? 0,
    contentHash: hash(`${title}\n${excerpt}`),
  };
}
