# Noticiero financial MVP implementation plan

> Execute with executing-plans; independent requesting-code-review before publication. User approved phases0–1 and live testing. The full personal proposal and detailed phases remain in the private ignored `.data/private/2026-10-31-noticiero-finanzas-propuesta.md`.

**Goal:** add an auditable private portfolio, source-grounded initial research and better local briefing digests without a paid API, broker connection or changes to business-opportunity criteria.

**Architecture:** lazy `/api/finance` isolated from the news dashboard payload; seven additive PostgreSQL JSONB tables. Fixed-point BigInt calculations with decimal strings at boundaries, atomic validated ledger imports and immutable decision captures. A single navigation item with four progressively disclosed views. News summaries are deterministic source-language sentence extraction, preserving original evidence.

**Stack:** existing Next16/React19, TypeScript/Zod/Drizzle, PostgreSQL/PGlite, Vitest/Playwright; Python standard-library offline risk reference.

## Phase0 contracts and safeguards

- [x] Define finance types; implement decimal arithmetic, chronological replay with persistent same-day sequence, FX, corporate actions, partial valuations and constrained money-new simulations.
- [x] Validate date/precision/identity, full CSV batches, solvency, no short selling, explicit fractional permission, duplicate references and audit-preserving reversals.
- [x] Add seven isolated tables, private routes, bounded bodies, capped archives, UTF-8 bounded view and full streaming export. Preserve complete22/26-table backup compatibility and include all33 tables going forward.
- [x] Implement SEC adapter with explicit verified CIK, unit/period/filing provenance, no future facts, bounded6MiB/12s request and injectable tests. Public smoke was denied; retain honest manual-source fallback, never advertise verified live access.
- [x] Test fixed-point values, missed prices/FX, legacy backup schemas, CSV ordering, splits, liquidations, XIRR scaling and immutable captures. `npx vitest run tests/finance.test.ts tests/finance-service.test.ts tests/finance-sec.test.ts`.

## Phase1 usable application

- [x] Add one Mi portafolio entry and four views: Resumen, Movimientos, Investigar, Diario. No fake starting balances or approved asset allocation; demo never requests private finance data.
- [x] Manual instruments/movements, explicit CSV, dated price/FX references, editable policy with explicit approval, versioned theses and immutable decisions with known-at-capture evidence.
- [x] TWR/MWR only with sufficient dated valuation coverage; abstain on ambiguous full liquidation. Prices stale beyond two weekdays block simulations; exchange-specific calendars and automated prices remain phase2.
- [x] Bounded source matching to stored news (a mention does not prove financial impact), company-fact adapter and manual source links. Different sector interpretation remains explicit rather than invented formula outputs.
- [x] Offline Python reference and eight tests; no large runtime or new background service.
- [x] Deterministic extractive briefing summaries, read-time archive upgrade and persistence during local editions. Preserve original title/excerpt/content hash and paid-API provenance when switching engines. Never pretend translation.
- [x] Run full unit/integration tests, Python tests, lint, TypeScript, Webpack build and complete desktop/mobile E2E suite. Fix important review findings.
Release gate: back up current production; publish reviewed main; verify live UI, read-only persistence, expanded encrypted backup, disposable restore and healthy monitor. Runtime results are recorded in the private proposal after verification. Reactivate local services after build.

## Subsequent phases

Phase2: select licensed verified market/FX/event data, daily close jobs, full history/benchmark/risk coverage, source/news-impact evaluation, authorized video transcripts and evaluated CPU Spanish summarization/sentiment. Observe simulated decisions through multiple contribution cycles. No new automation is activated merely by this document.

Phase3: compare covariance shrinkage, factor exposures and stress/simulation methods; prediction only with defined horizon, point-in-time universe, costs, temporal holdout/walk-forward and baseline evidence. Scores are not calibrated probabilities.

Phase4: broaden verified Mexican issuer/ETF coverage, monthly decision reports and useful thesis alerts; refine interface by removing redundant controls. Automatic trade execution is outside scope.

## Review findings and verification

Independent review identified same-batch ordering, full-liquidation TWR, stale FX on unheld targets, same-day pre-split marks, percentage display units, large computed-decimal range, XIRR tolerance scaling, policy-history quota and backdated decision wording. Corrections and regressions are included. Exact final test/deployment/recovery results will be recorded after verification.

Final local verification:180 unit/integration tests in21 files,8 Python tests, lint, TypeScript, Webpack production build and28 complete desktop/mobile E2E passed. Pre-release encrypted backup41270407850 succeeded. The final independent review has no remaining blockers within phases0–1.
