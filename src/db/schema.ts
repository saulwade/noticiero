import {
  pgTable,
  text,
  jsonb,
  timestamp,
  doublePrecision,
} from "drizzle-orm/pg-core";
import type {
  Story,
  Opportunity,
  Quote,
  JobRun,
  Edition,
  SavedItem,
  SourceState,
  ResearchModel,
  ResearchNote,
  ResearchSignal,
  DailyReport,
  OpportunityEvent,
  ValidationProject,
  Interview,
  OperationAlert,
  BackupRun,
  ResearchObservation,
} from "@/lib/types";

export const stories = pgTable("stories", {
  id: text("id").primaryKey(),
  url: text("url").notNull().unique(),
  data: jsonb("data").$type<Story>().notNull(),
});
export const opportunities = pgTable("opportunities", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<Opportunity>().notNull(),
});
export const quotes = pgTable("quotes", {
  symbol: text("symbol").primaryKey(),
  data: jsonb("data").$type<Quote>().notNull(),
});
export const quoteHistory = pgTable("quote_history", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<Quote>().notNull(),
});
export const sourceStates = pgTable("source_states", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<SourceState>().notNull(),
});
export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<JobRun>().notNull(),
});
export const editions = pgTable("editions", {
  key: text("key").primaryKey(),
  data: jsonb("data").$type<Edition>().notNull(),
});
export const savedItems = pgTable("saved_items", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<SavedItem>().notNull(),
});
export const readItems = pgTable("read_items", { id: text("id").primaryKey() });
export const leases = pgTable("leases", {
  name: text("name").primaryKey(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const usage = pgTable("usage", {
  key: text("key").primaryKey(),
  amount: doublePrecision("amount").notNull().default(0),
});
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  data: jsonb("data").$type<Record<string, boolean>>().notNull(),
});
export const opportunityBatches = pgTable("opportunity_batches", {
  key: text("key").primaryKey(),
  ideaIds: jsonb("idea_ids").$type<string[]>().notNull(),
});
export const researchModels = pgTable("research_models", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<ResearchModel>().notNull(),
});
export const researchNotes = pgTable("research_notes", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<ResearchNote>().notNull(),
});
export const researchSignals = pgTable("research_signals", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<ResearchSignal>().notNull(),
});
export const dailyReports = pgTable("daily_reports", {
  date: text("date").primaryKey(),
  data: jsonb("data").$type<DailyReport>().notNull(),
});
export const opportunityEvents = pgTable("opportunity_events", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<OpportunityEvent>().notNull(),
});
export const researchObservations = pgTable("research_observations", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<ResearchObservation>().notNull(),
});
export const validationProjects = pgTable("validation_projects", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<ValidationProject>().notNull(),
});
export const interviews = pgTable("interviews", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<Interview>().notNull(),
});
export const operationAlerts = pgTable("operation_alerts", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<OperationAlert>().notNull(),
});
export const backupRuns = pgTable("backup_runs", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<BackupRun>().notNull(),
});

// One PostgreSQL schema for the embedded database and a hosted PostgreSQL server.
export const migrations = [
  `CREATE TABLE IF NOT EXISTS stories (id text PRIMARY KEY, url text NOT NULL UNIQUE, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS opportunities (id text PRIMARY KEY, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS quotes (symbol text PRIMARY KEY, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS quote_history (id text PRIMARY KEY, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS source_states (id text PRIMARY KEY, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS jobs (id text PRIMARY KEY, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS editions (key text PRIMARY KEY, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS saved_items (id text PRIMARY KEY, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS read_items (id text PRIMARY KEY)`,
  `CREATE TABLE IF NOT EXISTS leases (name text PRIMARY KEY, token text NOT NULL, expires_at timestamptz NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS usage (key text PRIMARY KEY, amount double precision NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS opportunity_batches (key text PRIMARY KEY, idea_ids jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS research_models (id text PRIMARY KEY, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS research_notes (id text PRIMARY KEY, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS research_signals (id text PRIMARY KEY, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS daily_reports (date text PRIMARY KEY, data jsonb NOT NULL)`,
  ...[
    "opportunity_events",
    "research_observations",
    "validation_projects",
    "interviews",
    "operation_alerts",
    "backup_runs",
  ].map(
    (name) =>
      `CREATE TABLE IF NOT EXISTS ${name} (id text PRIMARY KEY, data jsonb NOT NULL)`,
  ),
];
