import type { ResearchModel, Story } from "@/lib/types";

const stopwords = new Set(
  "the a an and or to of for in on at by with from that this these those it its is are was were be been being as i we you they he she my our your their me us them not no do does did have has had can could would should will just very really also more most much many some any all about into than then there here when where what which who why how out up down over under through again get got use using used want need looking anyone ask show hn tool tools solution solutions problem problems please thanks thank help new people like make work works one two something things thing know way de del la el los las un una unos unas y o que qué en por para con sin al es son fue ser se mi mis nuestra nuestro tus su sus este esta estos estas hay como cómo mas más muy ya pero porque quiero necesito busco alguien hacer tengo tiene tiene esto eso asi así herramienta herramientas solución soluciones problema problemas ayuda favor gracias gente forma día días time times today".split(
    /\s+/,
  ),
);
const aliases: Record<string, string> = {
  llm: "ia",
  llms: "ia",
  ai: "ia",
  intelligence: "ia",
  inteligencia: "ia",
  tokens: "token",
  pricing: "coste",
  costs: "coste",
  cost: "coste",
  expensive: "coste",
  caro: "coste",
  caros: "coste",
  precio: "coste",
  precios: "coste",
  costo: "coste",
  costos: "coste",
  invoices: "factura",
  invoice: "factura",
  facturas: "factura",
  billing: "factura",
  documents: "documento",
  document: "documento",
  documentos: "documento",
  spreadsheets: "hoja",
  spreadsheet: "hoja",
  excel: "hoja",
  integration: "integracion",
  integrations: "integracion",
  integraciones: "integracion",
  workflows: "flujo",
  workflow: "flujo",
  procesos: "flujo",
  proceso: "flujo",
  developers: "desarrollador",
  developer: "desarrollador",
  desarrolladores: "desarrollador",
  security: "seguridad",
  secure: "seguridad",
  customers: "cliente",
  customer: "cliente",
  clientes: "cliente",
  meetings: "reunion",
  meeting: "reunion",
  reuniones: "reunion",
  transcriptions: "transcripcion",
  transcription: "transcripcion",
};
export function terms(text: string): string[] {
  const words =
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/https?:\/\/\S+/g, " ")
      .match(/[a-z][a-z0-9-]{1,35}/g) ?? [];
  return words
    .filter((word) => !stopwords.has(word))
    .map((word) => (Object.hasOwn(aliases, word) ? aliases[word] : word));
}
export function trainModel(
  previous: ResearchModel | undefined,
  stories: Story[],
  now = new Date(),
): ResearchModel {
  const documents = { ...(previous?.documents ?? {}) };
  for (const story of stories) {
    if (documents[story.id]?.hash === story.contentHash) continue;
    documents[story.id] = {
      hash: story.contentHash,
      terms: [
        ...new Set(
          terms(`${story.originalTitle ?? story.title} ${story.excerpt}`),
        ),
      ].slice(0, 250),
      observedAt: story.detectedAt,
    };
  }
  const bounded = Object.fromEntries(
    Object.entries(documents)
      .sort((a, b) => b[1].observedAt.localeCompare(a[1].observedAt))
      .slice(0, 2000),
  );
  const documentFrequency: Record<string, number> = Object.create(null);
  for (const doc of Object.values(bounded))
    for (const term of doc.terms)
      documentFrequency[term] = (documentFrequency[term] ?? 0) + 1;
  return {
    version: 1,
    documents: bounded,
    documentFrequency,
    updatedAt: now.toISOString(),
  };
}
export function vector(
  tokens: string[],
  model: ResearchModel,
): Record<string, number> {
  const counts: Record<string, number> = Object.create(null);
  for (const token of tokens) counts[token] = (counts[token] ?? 0) + 1;
  const total = Object.keys(model.documents).length;
  for (const key of Object.keys(counts))
    counts[key] =
      (1 + Math.log(counts[key])) *
      (Math.log((1 + total) / (1 + (model.documentFrequency[key] ?? 0))) + 1);
  const norm = Math.sqrt(
    Object.values(counts).reduce((sum, value) => sum + value * value, 0),
  );
  return Object.fromEntries(
    Object.entries(counts).map(([key, value]) => [
      key,
      norm ? value / norm : 0,
    ]),
  );
}
export function cosine(a: Record<string, number>, b: Record<string, number>) {
  return Object.entries(a).reduce(
    (sum, [term, value]) =>
      sum + value * (Object.hasOwn(b, term) ? b[term] : 0),
    0,
  );
}
export function keywords(tokens: string[], model: ResearchModel, limit = 6) {
  return Object.entries(vector(tokens, model))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}
