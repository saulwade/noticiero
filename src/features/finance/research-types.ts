import type { Quote, Story } from "@/lib/types";
export type FinancialEventKind =
  | "earnings"
  | "regulation"
  | "security"
  | "funding"
  | "acquisition"
  | "products"
  | "infrastructure"
  | "macro"
  | "business";
export type FinanceNewsEvent = {
  evidenceId?: string;
  revision?: number;
  id: string;
  storyId: string;
  contentHash: string;
  engineVersion: string;
  relatedStoryIds?: string[];
  relatedUrls?: string[];
  title: string;
  url: string;
  sourceId: string;
  sourceName: string;
  publishedAt: string;
  capturedAt: string;
  category: Story["category"];
  coverage: Story["coverage"];
  excerpt: string;
  summary: string;
  summaryLanguage: "es" | "en" | "unknown";
  imageUrl?: string;
  companies: { symbol: string; name: string; private: boolean }[];
  eventKind: FinancialEventKind;
  topic: string;
  keywords: string[];
  mechanismHypothesis: string;
  questions: string[];
  missingEvidence: string[];
  tone: {
    label: "favorable" | "adverse" | "mixed" | "unclassified";
    positiveTerms: string[];
    negativeTerms: string[];
    method: string;
    caveat: string;
  };
};
export type FinanceNewsReview = {
  id: string;
  eventId: string;
  storyId: string;
  status: "investigate" | "monitor" | "discard";
  note: string;
  openQuestions: string;
  createdAt: string;
  snapshot: FinanceNewsEvent;
};
export type FinanceNewsBrief = {
  id: string;
  date: string;
  createdAt: string;
  engineVersion: string;
  eventIds: string[];
  eventCount: number;
  companyCounts: {
    symbol: string;
    name: string;
    count: number;
    private: boolean;
  }[];
  themes: { label: string; count: number }[];
  questions: string[];
  quoteContext: Quote[];
  caveat: string;
};
export type FinanceNewsWorkspace = {
  asOf?: string;
  eventVersions?: FinanceNewsEvent[];
  events: FinanceNewsEvent[];
  reviews: FinanceNewsReview[];
  briefs: FinanceNewsBrief[];
  totalEvents: number;
  totalVersions: number;
  totalReviews: number;
  totalBriefs: number;
  viewLimited: boolean;
  lastUpdatedAt?: string;
  message: string;
};
