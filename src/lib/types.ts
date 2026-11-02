export const categories = [
  "IA",
  "Chips",
  "Startups",
  "Software",
  "Seguridad",
  "Negocios",
  "Finanzas",
  "Operaciones",
] as const;
export type Category = (typeof categories)[number];
export type SourceRef = { name: string; url: string; storyId?: string };
export type Story = {
  id: string;
  url: string;
  title: string;
  originalTitle?: string;
  relatedIds?: string[];
  sourceId: string;
  sourceName: string;
  publishedAt: string;
  detectedAt: string;
  excerpt: string;
  /** Community author's own text, retaining paragraph/quote boundaries for research. */
  authoredExcerpt?: string;
  summary?: string;
  summaryMethod?: "extractive";
  summaryLanguage?: "es" | "en" | "unknown";
  summaryVersion?: string;
  why?: string;
  category: Category;
  companies: string[];
  imageUrl?: string;
  imageCredit?: string;
  coverage: "headline" | "excerpt" | "article";
  analysis: "pending" | "ready";
  references: SourceRef[];
  score: number;
  contentHash: string;
  analysisHash?: string;
  kind?: "news" | "question" | "comment" | "launch" | "research";
  author?: string;
  threadId?: string;
};
export type Company = {
  symbol: string;
  name: string;
  aliases: string[];
  color: string;
  initials: string;
  private?: boolean;
};
export type Quote = {
  symbol: string;
  price: number;
  change: number;
  percent: number;
  currency: string;
  tradingDay: string;
  fetchedAt: string;
  provider: string;
};
export type Opportunity = {
  id: string;
  title: string;
  problem: string;
  customer: string;
  proposal: string;
  mvp: string;
  experiment: string;
  successSignal: string;
  whyNow: string;
  evidence: {
    storyId: string;
    reason: string;
    url?: string;
    sourceName?: string;
    quote?: string;
  }[];
  difficulty: "Baja" | "Media" | "Alta";
  confidence: "Exploratoria" | "Moderada";
  caveat: string;
  createdAt: string;
  engine?: "local" | "api";
  researchNoteId?: string;
};
export type ResearchSignal = {
  id: string;
  storyId: string;
  quote: string;
  kind: "request" | "pain" | "workaround";
  sourceName: string;
  url: string;
  title: string;
  author?: string;
  independenceKey: string;
  terms: string[];
  occurredAt: string;
  detectedAt: string;
  contentHash?: string;
};
export type ResearchNote = {
  id: string;
  label: string;
  keywords: string[];
  firstSeen: string;
  lastSeen: string;
  signalIds: string[];
  independentVoices: number;
  status: "isolated" | "repeated";
  journal: { date: string; added: number; totalVoices: number }[];
  scope?: import("@/features/research/problem-scope").ProblemScope;
};
export type ResearchModel = {
  version: number;
  documents: Record<
    string,
    { hash: string; terms: string[]; observedAt: string }
  >;
  documentFrequency: Record<string, number>;
  updatedAt: string;
};
export type DailyReport = {
  date: string;
  generatedAt: string;
  inputHash: string;
  provisional: boolean;
  documentCount: number;
  signalCount: number;
  newSignals: number;
  themes: {
    noteId: string;
    label: string;
    voices: number;
    signals: number;
    evidence?: ResearchSignal[];
  }[];
  opportunityIds: string[];
  sourceNames: string[];
  markdown: string;
  hypotheses?: Opportunity[];
  news?: { title: string; excerpt: string; url: string; sourceName: string }[];
};
export type ResearchData = {
  notes: ResearchNote[];
  signals: ResearchSignal[];
  reports: DailyReport[];
  documentsTracked: number;
  updatedAt?: string;
  history?: OpportunityEvent[];
  observations?: ResearchObservation[];
};
export type ResearchObservation = {
  id: string;
  storyId: string;
  title: string;
  excerpt: string;
  sourceName: string;
  url: string;
  category: Category;
  keywords: string[];
  at: string;
};
export type OpportunityEvent = {
  id: string;
  opportunityId: string;
  kind: "discovered" | "updated";
  at: string;
  idea: Opportunity;
  currentAssessment?: "supported" | "superseded";
};
export type ValidationProject = {
  id: string;
  title: string;
  segment: string;
  problem: string;
  hypothesis: string;
  successCriteria: string;
  sources: { title: string; url: string }[];
  opportunityId?: string;
  opportunityEventId?: string;
  opportunitySavedId?: string;
  status: "explore" | "interviewing" | "pilot" | "archived";
  createdAt: string;
  updatedAt: string;
};
export type Interview = {
  id: string;
  projectId: string;
  alias: string;
  role: string;
  date: string;
  currentSolution: string;
  frequency: string;
  consequence: string;
  quote: string;
  notes: string;
  nextStep: string;
  status: "planned" | "completed";
  createdAt: string;
  updatedAt: string;
};
export type ValidationData = {
  projects: ValidationProject[];
  interviews: Interview[];
};
export type OperationAlert = {
  id: string;
  message: string;
  firstSeen: string;
  lastSeen: string;
  resolvedAt?: string;
};
export type BackupRun = {
  id: string;
  status: "completed" | "failed";
  at: string;
  bytes?: number;
  counts?: Record<string, number>;
  sha256?: string;
  runId?: string;
  archive?: {
    status: "completed" | "failed";
    url?: string;
    sha256?: string;
    bytes?: number;
  };
};
export type OperationsData = {
  alerts: OperationAlert[];
  backup?: BackupRun;
  lastSuccessfulUpdate?: string;
  repository?: string;
  capacity?: import("@/features/storage/capacity").StorageCapacity;
};
export type SourceState = {
  id: string;
  name: string;
  status: "ok" | "error" | "pending";
  count: number;
  checkedAt?: string;
  message?: string;
};
export type JobRun = {
  id: string;
  editionKey: string;
  status: "running" | "completed" | "partial" | "failed";
  stage: string;
  startedAt: string;
  finishedAt?: string;
  sourceStates: SourceState[];
  storiesAdded: number;
  storyIds?: string[];
  message?: string;
};
export type Edition = {
  key: string;
  date: string;
  slot: "AM" | "PM";
  storyIds: string[];
  publishedAt: string;
  partial: boolean;
};
export type SavedItem = {
  id: string;
  kind: "story" | "idea" | "note";
  note: string;
  state: "explore" | "validating" | "dismissed";
  createdAt: string;
  snapshot?:
    { kind: "story"; story: Story } | { kind: "idea"; idea: Opportunity };
};
export type DashboardData = {
  evidence?: import("@/features/evidence/types").EvidenceData;
  stories: Story[];
  quotes: Quote[];
  opportunities: Opportunity[];
  sources: SourceState[];
  latestJob?: JobRun;
  editions: Edition[];
  saved: SavedItem[];
  readIds: string[];
  configuration: {
    ai: boolean;
    market: boolean;
    storage: "local" | "postgres";
    hosted: boolean;
    monthlyBudget: number;
    spent: number;
    model?: string;
    analysisMode?: "local" | "api";
    background?: boolean;
  };
  research?: ResearchData;
  validation?: ValidationData;
  operations?: OperationsData;
  demo: boolean;
};
