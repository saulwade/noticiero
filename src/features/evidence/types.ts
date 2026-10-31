export type EvidenceSource = "hn" | "github" | "cfpb" | "profeco";
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
};
