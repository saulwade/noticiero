export const MEMORY_VERSION = "idea-memory-v1";
export type IdeaSource = { url: string; kind: "competitor" | "issue" };
export type IdeaDefinition = {
  id: string;
  title: string;
  hypothesis: string;
  origin: "review" | "automatic";
  createdAt: string;
  match: { scopeKey?: string; groups: string[][] };
  sources: IdeaSource[];
};
export type IdeaDecision = {
  id: string;
  ideaId: string;
  at: string;
  actor: "research-review";
  decision: "watch" | "investigate" | "pause" | "discard";
  reason: string;
  references: string[];
  // Known aliases/products are context, never independent customer voices.
  excludedAuthors: string[];
  excludedUrls: string[];
  matchOverride?: IdeaDefinition["match"];
};
export type QualityKind =
  | "problem"
  | "historical"
  | "resolved"
  | "closed-unverified"
  | "promotion"
  | "context"
  | "statistic"
  | "rejected";
export type IdeaEvidence = {
  id: string;
  ideaId: string;
  recordId: string;
  revision?: number;
  caseKey: string;
  url: string;
  quote: string;
  title: string;
  sourceFamily: string;
  kind: "community" | "complaint" | "statistic" | "news";
  authorKey?: string;
  country?: string;
  occurredAt: string;
  dateBasis?: "source_updated";
  capturedAt: string;
  classifiedAt: string;
  mechanism: string;
  mechanismLabel?: string;
  quality: QualityKind;
  reasons: string[];
  fields: Partial<
    Record<"frequency" | "consequence" | "workaround" | "buyer", string>
  >;
};
export type IdeaSourceCheck = {
  id: string;
  url: string;
  kind: IdeaSource["kind"];
  checkedAt: string;
  status: "ok" | "error" | "rate-limited";
  retryAt?: string;
  contentHash?: string;
  excerpt?: string;
  issueState?: "open" | "closed";
  stateReason?: "completed" | "not_planned" | "reopened" | null;
  sourceUpdatedAt?: string;
  references?: string[];
  message: string;
};
export type MemoryMechanism = {
  key: string;
  label: string;
  cases: number;
  publicAccounts: number;
  anonymousCases: number;
  sourceFamilies: number;
};
export type IdeaAssessment = {
  id: string;
  ideaId: string;
  version: string;
  asOf: string;
  inputHash: string;
  decision: "watch" | "investigate" | "pause" | "discard";
  rationale: string[];
  gaps: string[];
  totals: {
    cases: number;
    revisions: number;
    activeCases: number;
    publicAccounts: number;
    anonymousCases: number;
    historical: number;
    resolved: number;
    closedUnverified: number;
    promotions: number;
    context: number;
    statistics: number;
    rejected: number;
    mexicoCases: number;
    quantifiedConsequences: number;
    buyerStatements: number;
  };
  weekly: {
    currentCases: number;
    previousCases: number;
    newAccounts: number;
    newCaptures: number;
    historicalImports: number;
    revisions: number;
    repeatedMechanisms: number;
  };
  mechanisms: MemoryMechanism[];
  evidence: IdeaEvidence[];
  contradictions: IdeaEvidence[];
  sources: {
    url: string;
    status: "pending" | "ok" | "changed" | "stale" | "error";
    checkedAt?: string;
    message: string;
  }[];
  journalIds: string[];
};
export type IdeaMemoryData = {
  version: string;
  definitions: IdeaDefinition[];
  decisions: IdeaDecision[];
  assessments: IdeaAssessment[];
  assessmentCount: number;
  linkedRevisions: number;
  sourceCheckCount: number;
  updatedAt?: string;
  historyPage?: { limit: number; next?: { before: string; beforeId: string } };
};
