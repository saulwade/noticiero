# Evidence radar implementation plan

> For agentic workers: execute task-by-task with executing-plans and independent requesting-code-review before publication. User approved this first stage and production deployment on 2026-10-31.

**Goal:** collect bounded public complaint/product evidence, extract grounded problem context, rank reviewable dossiers, import official PROFECO CSV and persist weekly research without paid AI.

**Architecture:** additive evidence records, human decisions, connector cursors and weekly snapshots alongside existing archives. Public connectors return typed observations; the pure engine extracts quoted fields and builds explainable dossiers. Existing edition workflow synchronizes evidence and stores reports. A new Radar view reuses Entrevistas.

**Tech stack:** existing Next16/React19, TypeScript, Zod, Drizzle PostgreSQL/PGlite, Vitest and Playwright; no generative API or new subscription.

## Tasks

- [x] Define `src/features/evidence/types.ts`; add JSONB tables in `src/db/schema.ts` and backup whitelist with legacy snapshot compatibility. Check: `expect(validateSnapshot(legacy22Tables).tables).toHaveLength(22)` and restore into additive schema.
- [x] Implement `connectors.ts` and `profeco.ts` with fixture tests: public-only GitHub allowlist, CFPB narrative/category evidence, bounded bytes/results, durable cursor only after persistence, no synthetic authors, strict CSV aliases/dates/row limits and no personal fields. Run `npx vitest run tests/evidence-connectors.test.ts`.
- [x] Implement `engine.ts`, `service.ts`, persistence and authenticated `/api/evidence` routes. Tests must assert that unknown country stays unknown, text fields retain supporting quotes, duplicates/rejected observations do not inflate recurrence, historical imports do not create recent growth, and 7-day reports retain immutable prior closures. Run `npx vitest run tests/evidence.test.ts`.
- [x] Add `evidence-workspace.tsx` and styles; integrate dashboard optional EvidenceData, callbacks and navigation. Review decisions persist; imports show validation errors; dossiers link to existing interview workspace through server-owned sources. Add desktop/mobile E2E checks in existing isolated environment.
- [x] Wire into existing edition workflow, extend health findings for evidence connector failures/storage soft caps, add Markdown evidence export and weekly snapshots. No extra Vercel cron needed. Measure actual public adapter response before enabling, report partial failures accurately.
- [x] Run `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e`. Independently review diff against approved spec and fix important findings.
- [x] Push reviewed main to trigger Vercel production. Verify Ready, execute real update, inspect persisted evidence/source statuses, dispatch encrypted backup and restore it to a disposable database; verify monitor healthy. Reactivate local services after build. Record exact verification outcomes below.

## Contract

Connectors return `ConnectorBatch {records, state}`. Records contain a source-native `externalId`, source/issue/date fields, bounded public quote and optional namespace author identity; absent country/segment remains absent. States describe coverage, cursor, status and budget rather than claiming comprehensive access. UI receives `EvidenceData` and uses explicit review/import/project actions through `/api/evidence`.

## Verification outcomes

120 unit/integration tests, lint, TypeScript/Webpack build and 22 desktop/mobile browser tests passed. Independent review found and verified fixes for version/revert deduplication, immutable report closure, segment separation, resolution evidence, source calendar dates and UTF-8 response budget. Public smoke: CFPB20 records and GitHub18 human issues without credentials. Production backup before publication: run41234689153 succeeded.

Production commit94cd27c reached Ready in deployment dpl_HX1nzyt6buGKPraztJ5YU77LpKfh at https://noticiero-self.vercel.app. Real edition update completed with58 new stories. Read-only Neon verification confirmed313 evidence versions (HN275, CFPB20, GitHub18),3 connector states and1 weekly report; browser rendered22 dossiers and their citations. PROFECO remains waiting for an explicit CSV import. Public connectors correctly report bounded coverage rather than an error. Follow-up UI count includes successful bounded samples; lint and typecheck passed after that correction.

Post-deployment encrypted backup [41236409767](https://github.com/saulwade/noticiero-ops/actions/runs/41236409767) succeeded. Downloaded ciphertext decrypted with the existing private key:26 tables including313 evidence records,3 connector states and1 report. Restored into a fresh disposable PGlite database; every table count matched. Monitor [41236543261](https://github.com/saulwade/noticiero-ops/actions/runs/41236543261) succeeded. Local dashboard/updater launch agents reactivated. No new subscription, generative API, credential or source permission required.
