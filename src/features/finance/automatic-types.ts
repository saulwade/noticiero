import type { FinanceNewsEvent } from "./research-types";
import type { StockContext, StockResearchReport } from "./stock-types";

export type AutomationProfile = {
  id: string;
  version: number;
  initialCapitalMxn: string;
  monthlyContributionMxn: string;
  horizonYears: number;
  riskPreference: "unconfirmed" | "cautious" | "balanced" | "growth";
  reserveExcluded: true;
  broker: {
    name: string;
    verified: boolean;
    fractional?: boolean;
    feePercent?: number;
    fxSpreadPercent?: number;
  };
  updatedAt: string;
};
export type AutomationAsset = {
  symbol: string;
  name: string;
  role: "global-equity" | "short-usd-treasury" | "mxn-cash";
  currency: "USD" | "MXN";
  sourceUrl: string;
};
export type AutomationHistory = {
  id: string;
  symbol: string;
  provider: string;
  currency: "USD" | "MXN";
  adjusted: boolean;
  capturedAt: string;
  sourceUrl: string;
  points: {
    date: string;
    close: string;
    adjustedClose: string;
    fxMxn: string;
    fxDate?: string;
  }[];
  fxSourceUrl?: string;
  warnings: string[];
  reference?: AutomationReference;
};
export type AutomationReference = {
  symbol: string;
  price: string;
  currency: "USD" | "MXN";
  fxMxn: string;
  fxSession?: string;
  fxSourceUrl?: string;
  session: string;
  capturedAt: string;
  sourceUrl: string;
};
export type AutomationInput = {
  stockResearch?: StockContext;
  version: 1;
  engineVersion?: string;
  inputHash: string;
  asOf: string;
  profile: AutomationProfile;
  assets: AutomationAsset[];
  histories: AutomationHistory[];
  references: AutomationReference[];
  portfolio: {
    hasMovements: boolean;
    complete: boolean;
    valueMxn?: string;
    cashMxn: string;
    positions: { symbol: string; valueMxn?: string; quantity: string }[];
    movementHash: string;
  };
  news: FinanceNewsEvent[];
  dataWarnings: string[];
};
export type AutomaticAllocation = {
  symbol: string;
  name: string;
  weight: number; // Fraction: 0.6 means 60%. Never percentage points.
  amountMxn: string;
  quantity?: string;
  price?: string;
  priceSession?: string;
  reason: string;
  sourceUrl: string;
};
export type AutomationReport = {
  stockResearch?: StockResearchReport;
  actualRisk?: {
    weights: { symbol: string; weight: number }[];
    maximumWeightDrift: number;
    risk: AutomationReport["risk"];
    scenarios: AutomationReport["scenarios"];
  };
  evaluation?: {
    method: string;
    folds: number;
    attemptedFolds: number;
    infeasibleFolds: number;
    trainingWeeks: number;
    testWeeks: number;
    estimatedVolatility?: number;
    realizedVolatility?: number;
    baselineRealizedVolatility?: number;
    breaches: number;
    caveat: string;
  };
  version: 1;
  id: string;
  inputHash: string;
  asOf: string;
  engineVersion: string;
  status: "provisional" | "review" | "insufficient-data";
  headline: string;
  conclusion: string;
  action: "prepare" | "maintain" | "contribute" | "review-risk" | "wait";
  reasons: string[];
  initial: {
    budgetMxn: string;
    items: AutomaticAllocation[];
    cashRemainderMxn: string;
  };
  contribution: {
    budgetMxn: string;
    items: AutomaticAllocation[];
    cashRemainderMxn: string;
    reason: string;
  };
  risk: {
    observations: number;
    frequency: "weekly";
    from?: string;
    to?: string;
    annualizedVolatility?: number;
    maximumDrawdown?: number;
    historicalReturn?: number;
    concentration: number;
    covarianceMethod: string;
    riskContributions: { symbol: string; share: number }[];
    correlations: { a: string; b: string; value: number }[];
    caveats: string[];
  };
  scenarios: {
    label: string;
    returnPercent: number;
    endValueMxn: string;
    assumption: string;
  }[];
  projections: {
    years: number;
    lowerMxn: string;
    medianMxn: string;
    upperMxn: string;
    method: string;
    caveat: string;
  }[];
  alternatives: {
    label: string;
    weights: { symbol: string; weight: number }[];
    rationale: string;
  }[];
  news: {
    id: string;
    title: string;
    url: string;
    sourceName: string;
    publishedAt: string;
    mechanism: string;
    implication: string;
  }[];
  warnings: string[];
  nextReview: {
    daily: string;
    contribution: string;
    strategy: string;
    triggers: string[];
  };
  methodology: string[];
};
export type AutomationWorkspace = {
  status: "not-configured" | "pending" | "ready" | "stale" | "error";
  message: string;
  lastSuccess?: string;
  current?: AutomationReport;
  history: AutomationReport[];
  totalReports: number;
  staleReason?: string;
  archive?: {
    profiles: AutomationProfile[];
    histories: AutomationHistory[];
    inputs: AutomationInput[];
  };
};
