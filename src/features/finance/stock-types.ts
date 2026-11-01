import type { AutomationHistory } from "./automatic-types";
import type { CompanyResearch } from "./types";

export type StockLink = {
  id: string;
  fromSymbol: string;
  fromName: string;
  kind: "supplier" | "customer" | "brand" | "partner";
  description: string;
  mechanism: string;
  counterpoint: string;
  sourceUrl: string;
  sourceDate: string;
};
export type StockCandidate = {
  symbol: string;
  name: string;
  cik: string;
  exchange: string;
  origin: "direct" | "related";
  events: {
    id: string;
    title: string;
    url: string;
    sourceName: string;
    publishedAt: string;
  }[];
  links: StockLink[];
  facts?: CompanyResearch;
  history?: AutomationHistory;
};
export type StockContext = {
  version: 1;
  asOf: string;
  candidates: StockCandidate[];
  warnings: string[];
};
export type StockMetric = {
  key: string;
  label: string;
  value: number;
  unit: "ratio" | "USD";
  period: string;
  factIndexes: number[];
};
export type StockAnalysis = {
  symbol: string;
  status: "available" | "partial" | "pending";
  factId?: string;
  metrics: StockMetric[];
  findings: string[];
  questions: string[];
  statistics?: {
    observations: number;
    from: string;
    to: string;
    annualizedVolatility: number;
    maximumDrawdown: number;
    cumulativeReturn: number;
    currency: "MXN";
  };
};
export type StockResearchReport = {
  context: StockContext;
  analyses: StockAnalysis[];
  caveat: string;
};
