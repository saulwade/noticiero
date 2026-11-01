import type {
  FinanceNewsWorkspace,
  FinanceNewsEvent,
  FinanceNewsReview,
} from "./research-types";
export type Currency = "MXN" | "USD";
export type Instrument = {
  id: string;
  symbol: string;
  name: string;
  kind: "stock" | "etf" | "bond";
  currency: Currency;
  exchange: string;
  fractional: boolean;
  country?: string;
  sector?: string;
  sourceUrl?: string;
  cik?: string;
  createdAt: string;
};
export type MovementKind =
  | "deposit"
  | "withdrawal"
  | "buy"
  | "sell"
  | "dividend"
  | "interest"
  | "fee"
  | "tax"
  | "exchange"
  | "split";
export type Movement = {
  sequence?: number;
  id: string;
  kind: MovementKind;
  date: string;
  currency: Currency;
  amount: string;
  instrumentId?: string;
  quantity?: string;
  price?: string;
  fee: string;
  fxRate?: string;
  note: string;
  createdAt: string;
  reversesId?: string;
};
export type FinanceSyncState = {
  id: string;
  label: string;
  provider: string;
  instrumentId?: string;
  status: "running" | "ok" | "error" | "configuration" | "manual";
  message: string;
  session?: string;
  lastAttempt?: string;
  lastSuccess?: string;
  asOf?: string;
  value?: string;
  leaseToken?: string;
  leaseUntil?: string;
  scanCursor?: string;
  scanComplete?: boolean;
};
export type FinanceMarketStatus = {
  alphaVantageConfigured: boolean;
  expectedPriceSession: string;
  sources: FinanceSyncState[];
};
export type FinanceMark = {
  id: string;
  kind: "price" | "fx";
  instrumentId?: string;
  value: string;
  asOf: string;
  source: string;
  sourceUrl?: string;
  capturedAt: string;
  automatic?: boolean;
  provider?: "alpha-vantage" | "frankfurter";
};
export type FinancePolicy = {
  monthlyContributionMxn: string;
  targets: { instrumentId: string; weight: number }[];
  approved: boolean;
  updatedAt: string;
};
export type FinancePosition = {
  instrumentId: string;
  quantity: string;
  price?: string;
  asOf?: string;
  valueMxn?: string;
  weight?: number;
};
export type FinanceSummary = {
  asOf: string;
  complete: boolean;
  cash: Record<Currency, string>;
  knownValueMxn: string;
  valueMxn?: string;
  contributionsMxn?: string;
  withdrawalsMxn?: string;
  pnlMxn?: string;
  positions: FinancePosition[];
  warnings: string[];
  allocation: { label: string; valueMxn: string; weight?: number }[];
  proposal: {
    status: "blocked" | "review";
    label: string;
    reason: string;
    amountMxn: string;
    items: { instrumentId: string; amountMxn: string; afterWeight: number }[];
    missing: string[];
  };
  performance: { twr?: number; mwr?: number; reason: string };
};
export type FinanceThesis = {
  id: string;
  instrumentId: string;
  statement: string;
  risks: string;
  invalidators: string;
  horizon: string;
  sources: { title: string; url: string }[];
  createdAt: string;
};
export type FinanceDecision = {
  id: string;
  date: string;
  action: string;
  reason: string;
  alternatives: string;
  revisitWhen: string;
  createdAt: string;
  snapshot: {
    summary: FinanceSummary;
    policy?: FinancePolicy;
    marks: FinanceMark[];
    instruments: Instrument[];
    theses?: FinanceThesis[];
    research?: CompanyResearch[];
    news?: FinanceNewsEvent[];
    newsReviews?: FinanceNewsReview[];
  };
};
export type FinancialFact = {
  label: string;
  value: number;
  unit: string;
  start?: string;
  end: string;
  filed: string;
  accession: string;
  form: string;
  url: string;
};
export type CompanyResearch = {
  id: string;
  instrumentId: string;
  capturedAt: string;
  source: string;
  facts: FinancialFact[];
  warnings: string[];
};
export type FinanceData = {
  newsResearch?: FinanceNewsWorkspace;
  market?: FinanceMarketStatus;
  relatedNews?: {
    instrumentId: string;
    title: string;
    url: string;
    sourceName: string;
    publishedAt: string;
  }[];
  counts?: {
    movements: number;
    marks: number;
    theses: number;
    decisions: number;
    policyVersions?: number;
    policyBytes?: number;
  };
  viewLimited?: boolean;
  instruments: Instrument[];
  movements: Movement[];
  marks: FinanceMark[];
  policy?: FinancePolicy;
  theses: FinanceThesis[];
  decisions: FinanceDecision[];
  research: CompanyResearch[];
  summary: FinanceSummary;
};
