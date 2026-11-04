export const businessTopics = [
  "marketing",
  "creators",
  "ecommerce",
  "launch",
  "expansion",
  "funding",
  "business",
] as const;
export type BusinessTopic = (typeof businessTopics)[number];
export type BusinessNews = {
  id: string;
  revisionId: string;
  canonicalUrl: string;
  originalUrl: string;
  title: string;
  sourceId: string;
  sourceName: string;
  publishedAt: string;
  observedAt: string;
  queriedAt: string;
  contentHash: string;
  countryEvidence: {
    country: "MX";
    basis: "explicit_mention";
    mention: string;
  } | null;
  companyEvidence: { name: string; basis: "text_mention" }[];
  topics: BusinessTopic[];
  briefParaphrase: string;
  summaryMethod: "headline_context_rules";
  dateProvenance: "feed_declared";
  buyingIntent: "unknown";
};
export type BusinessSourceState = {
  id: string;
  name: string;
  status: "ok" | "error" | "capacity";
  checkedAt: string;
  nextCheckAt: string;
  received: number;
  added: number;
  message: string;
};
/** Internal monotone persistence order, assigned while holding the archive lock. */
export type ArchivedBusinessNews = BusinessNews & { archiveSequence: number };
