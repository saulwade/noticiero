import type { StockLink } from "./stock-types";

export type ResearchIssuer = {
  symbol: string;
  name: string;
  cik: string;
  exchange: string;
  aliases: string[];
};
// Identity checked against SEC company_tickers_exchange.json, 2026-11-01.
// This research universe does not create holdings or consume briefing quote slots.
export const researchIssuers: ResearchIssuer[] = [
  {
    symbol: "MSFT",
    name: "Microsoft",
    cik: "0000789019",
    exchange: "NASDAQ",
    aliases: ["microsoft", "azure"],
  },
  {
    symbol: "GOOGL",
    name: "Alphabet",
    cik: "0001652044",
    exchange: "NASDAQ",
    aliases: ["google", "alphabet"],
  },
  {
    symbol: "AMZN",
    name: "Amazon",
    cik: "0001018724",
    exchange: "NASDAQ",
    aliases: ["amazon", "aws"],
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    cik: "0001045810",
    exchange: "NASDAQ",
    aliases: ["nvidia"],
  },
  {
    symbol: "INTC",
    name: "Intel",
    cik: "0000050863",
    exchange: "NASDAQ",
    aliases: ["intel"],
  },
  {
    symbol: "QCOM",
    name: "Qualcomm",
    cik: "0000804328",
    exchange: "NASDAQ",
    aliases: ["qualcomm", "snapdragon"],
  },
  {
    symbol: "MU",
    name: "Micron",
    cik: "0000723125",
    exchange: "NASDAQ",
    aliases: ["micron"],
  },
  {
    symbol: "CLS",
    name: "Celestica",
    cik: "0001030894",
    exchange: "NYSE",
    aliases: ["celestica"],
  },
  {
    symbol: "ALAB",
    name: "Astera Labs",
    cik: "0001736297",
    exchange: "NASDAQ",
    aliases: ["astera labs"],
  },
  {
    symbol: "NBIS",
    name: "Nebius",
    cik: "0001513845",
    exchange: "NASDAQ",
    aliases: ["nebius"],
  },
  {
    symbol: "CRWV",
    name: "CoreWeave",
    cik: "0001769628",
    exchange: "NASDAQ",
    aliases: ["coreweave"],
  },
  {
    symbol: "VRT",
    name: "Vertiv",
    cik: "0001674101",
    exchange: "NYSE",
    aliases: ["vertiv"],
  },
  {
    symbol: "ETN",
    name: "Eaton",
    cik: "0001551182",
    exchange: "NYSE",
    aliases: ["eaton"],
  },
  {
    symbol: "TT",
    name: "Trane Technologies",
    cik: "0001466258",
    exchange: "NYSE",
    aliases: ["trane technologies", "liquidstack"],
  },
  {
    symbol: "CROX",
    name: "Crocs",
    cik: "0001334036",
    exchange: "NASDAQ",
    aliases: ["crocs", "heydude", "hey dude"],
  },
];
export function findResearchIssuers(text: string) {
  const financial =
    /\b(stocks?|shares?|earnings|revenue|guidance|acciones|resultados|ingresos)\b/i.test(
      text,
    );
  return researchIssuers.filter(
    (issuer) =>
      issuer.aliases.some((alias) =>
        new RegExp(`\\b${alias}\\b`, "i").test(text),
      ) ||
      new RegExp(
        `(?:\\$|\\b(?:NASDAQ|NYSE)\\s*:\\s*)${issuer.symbol}\\b`,
        "i",
      ).test(text) ||
      (issuer.symbol.length >= 3 &&
        financial &&
        new RegExp(`\\b${issuer.symbol}\\b`).test(text)),
  );
}
type Edge = StockLink & { toSymbol: string; trigger: RegExp };
const infrastructure =
  /\b(data cent(?:er|re)s?|tpu|capex|capital spending|capital expenditure|compute capacity|gpu infrastructure|ai factor(?:y|ies)|power capacity|liquid cooling|dsx|infraestructura|centro(?:s)? de datos|gasto de capital|capacidad de computo)\b/i;
const coolingSource =
  "https://nvidianews.nvidia.com/news/european-ecosystem-builds-worlds-most-efficient-ai-factories-with-nvidia-dsx";
export const stockEdges: Edge[] = [
  {
    id: "goog-cls-tpu",
    fromSymbol: "GOOGL",
    fromName: "Alphabet",
    toSymbol: "CLS",
    kind: "supplier",
    trigger: infrastructure,
    description:
      "Celestica documentó fabricación de infraestructura TPU para Google.",
    mechanism:
      "Si aumenta el despliegue TPU contratado, podría cambiar la utilización y los ingresos del fabricante.",
    counterpoint:
      "Capacidad anunciada no equivale a ingresos reconocidos; revisar margen, concentración de cliente y calendario.",
    sourceUrl:
      "https://celestica.gcs-web.com/news-releases/news-release-details/celestica-announces-fourth-quarter-and-fy-2025-financial-results",
    sourceDate: "2026-01-28",
  },
  {
    id: "msft-nbis-cloud",
    fromSymbol: "MSFT",
    fromName: "Microsoft",
    toSymbol: "NBIS",
    kind: "supplier",
    trigger: infrastructure,
    description: "Nebius publicó un acuerdo de capacidad GPU con Microsoft.",
    mechanism:
      "La demanda de capacidad podría afectar la entrega de servicios y financiación de infraestructura del proveedor.",
    counterpoint:
      "Entrega, disponibilidad, financiación y cláusulas de terminación pueden impedir que el contrato se convierta en caja.",
    sourceUrl:
      "https://nebius.com/newsroom/nebius-announces-multi-billion-dollar-agreement-with-microsoft-for-ai-infrastructure",
    sourceDate: "2025-09-08",
  },
  {
    id: "amzn-alab-connectivity",
    fromSymbol: "AMZN",
    fromName: "Amazon",
    toSymbol: "ALAB",
    kind: "partner",
    trigger: infrastructure,
    description:
      "Astera Labs presentó un acuerdo comercial y warrants vinculados a Amazon.",
    mechanism:
      "Cambios en infraestructura pueden afectar pedidos de conectividad y el cumplimiento de condiciones comerciales.",
    counterpoint:
      "El warrant no demuestra ventas de cada proyecto; revisar hitos, dilución y concentración del cliente.",
    sourceUrl:
      "https://www.sec.gov/Archives/edgar/data/1736297/000110465926012606/tm265461d1_8k.htm",
    sourceDate: "2026-02-10",
  },
  {
    id: "openai-crwv-cloud",
    fromSymbol: "OPENAI",
    fromName: "OpenAI",
    toSymbol: "CRWV",
    kind: "supplier",
    trigger: infrastructure,
    description: "CoreWeave anunció capacidad de infraestructura para OpenAI.",
    mechanism:
      "Cambios en demanda de cómputo podrían afectar utilización e ingresos del proveedor contratado.",
    counterpoint:
      "Revisar deuda, gasto de capital, condiciones de entrega y concentración; crecer ingresos no garantiza flujo libre positivo.",
    sourceUrl:
      "https://www.coreweave.com/news/coreweave-announces-agreement-with-openai-to-deliver-ai-infrastructure",
    sourceDate: "2025-03-10",
  },
  ...[
    ["VRT", "Vertiv", "refrigeración"],
    ["ETN", "Eaton", "energía"],
    ["TT", "Trane Technologies", "refrigeración"],
  ].map(([toSymbol, name, channel]) => ({
    id: `nvda-${toSymbol.toLowerCase()}-infrastructure`,
    fromSymbol: "NVDA",
    fromName: "NVIDIA",
    toSymbol,
    kind: "partner" as const,
    trigger: infrastructure,
    description: `${name} figura en el ecosistema documentado de ${channel} para infraestructura NVIDIA.`,
    mechanism: `Si los proyectos de centros de datos se ejecutan, podría cambiar la demanda de ${channel}; comprobar pedidos específicos.`,
    counterpoint:
      "Una colaboración o diseño de referencia no prueba un contrato de suministro ni su importe; puede haber retrasos o competencia.",
    sourceUrl: coolingSource,
    sourceDate: "2026-10-21",
  })),
  {
    id: "heydude-crox-brand",
    fromSymbol: "HEYDUDE",
    fromName: "HEYDUDE",
    toSymbol: "CROX",
    kind: "brand",
    trigger: /\b(heydude|hey dude)\b/i,
    description:
      "Crocs cerró la adquisición de HEYDUDE en 2022; es una marca, no una acción independiente.",
    mechanism:
      "Cambios en ventas o integración de la marca pueden afectar los resultados consolidados de Crocs.",
    counterpoint:
      "El cierre histórico no es una adquisición nueva ni demuestra una subida bursátil actual; contrastar segmentos y deuda.",
    sourceUrl:
      "https://www.sec.gov/Archives/edgar/data/1334036/000133403622000014/exhibit991pressrelease21722.htm",
    sourceDate: "2022-02-17",
  },
];
