export type EvidenceSource = "hn" | "github" | "cfpb" | "profeco" | "sfc-co";
export type EvidenceRecord = {
  revision?: number;
  id: string;
  externalId: string;
  source: EvidenceSource;
  sourceName: string;
  url: string;
  title: string;
  quote: string;
  occurredAt: string;
  capturedAt: string;
  language: "es" | "en" | "unknown";
  kind: "community" | "complaint" | "statistic";
  country?: string;
  countryBasis?: string;
  authorKey?: string;
  product?: string;
  issue?: string;
  segment?: string;
  historical?: boolean;
  resolution?: "resolved" | "unresolved" | "unknown";
  period?: string;
  aggregateCount?: number;
  caseStatus?: "open" | "closed";
};
export type ConnectorState = {
  blocked?: boolean;
  id: EvidenceSource;
  status: "ok" | "error" | "limited" | "waiting";
  checkedAt: string;
  count: number;
  message: string;
  cursor?: string;
};
export type ConnectorBatch = {
  records: EvidenceRecord[];
  state: ConnectorState;
};
export type EvidenceReview = {
  id: string;
  decision: "useful" | "rejected" | "duplicate" | "wrong-segment";
  note: string;
  at: string;
};
export type GroundedField = { value: string; quote: string };
export type ProblemDossier = {
  id: string;
  label: string;
  scope?: import("@/features/research/problem-scope").ProblemScope;
  status: "isolated" | "repeated" | "contrasted" | "validating";
  evidenceIds: string[];
  countries: string[];
  languages: string[];
  sourceFamilies: string[];
  identifiedAuthors: number;
  anonymousCases: number;
  reasons: string[];
  firstSeen: string;
  lastSeen: string;
  activity: { days: number; publishedCases: number; capturedCases: number }[];
  fields: {
    segment?: GroundedField;
    task?: GroundedField;
    obstacle?: GroundedField;
    frequency?: GroundedField;
    consequence?: GroundedField;
    workaround?: GroundedField;
  };
  alternatives: string[];
  contradictions: string[];
  mexicoHypothesis: string;
  experiment: string;
  questions: string[];
};
export type EvidenceWeeklyReport = {
  id: string;
  from: string;
  to: string;
  generatedAt: string;
  provisional: boolean;
  markdown: string;
};
export type EvidenceData = {
  records: EvidenceRecord[];
  reviews: EvidenceReview[];
  dossiers: ProblemDossier[];
  sources: ConnectorState[];
  reports: EvidenceWeeklyReport[];
  totalRecords: number;
  storageLimited: boolean;
  shortlist?: ResearchLead[];
  coverage?: {
    country: string;
    cases: number;
    statistics: number;
    latestDate: string;
  }[];
};
export type ResearchLead = {
  id: string;
  label: string;
  product: string;
  segment: string;
  countries: string[];
  historical: boolean;
  authors: number;
  anonymousCases: number;
  obstacle: string;
  gaps: string[];
  nextStep: string;
  evidence: {
    quote: string;
    url: string;
    source: string;
    occurredAt: string;
  }[];
};
