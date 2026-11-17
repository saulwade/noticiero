# Idea Memory Implementation Plan

> **For agentic workers:** Execute inline using executing-plans; preserve the private research and portfolio boundaries.

**Goal:** Durable automatic idea research with auditable quality, competition checks and weekly changes at no new service cost.

**Architecture:** Append-only JSONB records, pure evidence interpretation, bounded public source checks and existing edition/report integration. Private seeds are imported separately, never bundled into the public repository.

**Tech Stack:** TypeScript, installed Next.js guides, Drizzle, PostgreSQL/PGlite, Vitest, Playwright and existing Vercel integration.

## Tasks

- [x] Capture encrypted 43-table production baseline and record fixed evaluation; branch `codex/idea-memory-quality` in the existing checkout.
- [x] Add `src/features/idea-memory/types.ts`, `quality.ts`, `engine.ts`, `sources.ts`, `service.ts`, `markdown.ts`. Add five additive tables (definitions, journal, evidence links, source checks, assessments) to schema and backups. Use insert-on-conflict-do-nothing and transactional serialization, with deterministic keys excluding observation time where appropriate.
- [x] Write failing regressions in `tests/idea-memory.test.ts`, `tests/idea-memory-sources.test.ts` and `tests/idea-memory-persistence.test.ts` for revisions, duplicate accounts/cases, promotions, explicit resolution, negative evidence, matching specificity, recurrence windows, time cutoffs, safe source requests, idempotent runs and unmodified history; implement these pure functions and service boundaries.
- [x] Connect service to `runLocalResearch` and daily report generation, add memory Markdown to private `researchBrief`, authenticated read-only `/api/research/memory`, and concise counts to the existing operations view. Retain old reports and no new navigation or portfolio changes.
- [x] Add private validated import script for four existing dossiers and documented decisions/alternatives; include provenance and evidence URLs. Create backup read grants for new tables without changing old data or broader privileges.
- [x] Extend backup compatibility tests to retain the 43-table format and verify new-table restore. Run unit/integration, frozen evaluation, lint excluding `research/**`, typecheck, build, and E2E desktop/mobile including private export.
- [ ] Self-review diffs and resolve issues. Commit only explicit source/doc/test paths, publish via the existing project and verify deployment Ready. Activate only memory/research, verify four definitions and current assessments in Neon, recapture encrypted snapshot and compare every prior ID, immutable report and finance row. Update this plan with actual results and limits.

## Evidencia previa a publicación

- Corte cifrado previo de 43 tablas y 9,876 filas; restauración real en PGlite temporal comprobada, con las cinco tablas nuevas vacías.
- Migración aditiva a 48 tablas y SELECT verificado para el rol de respaldos. No se modificó código del portafolio; sólo se adaptaron fixtures de compatibilidad de backups que estaban en tests financieros.
- Carga privada: cuatro ideas revisadas, diez líneas automáticas, cinco decisiones atribuidas, 838 vínculos, doce comprobaciones y dieciséis evaluaciones en el corte de activación. Una decisión afinó el matcher de retiro para excluir «automatic saving» de archivos, conservando definición, vínculos y evaluación anteriores.
- Se mantiene la muestra diagnóstica congelada de cien ejemplos con el mismo hash y resultado 54 positivos/46 negativos; no equivale a precisión general ni validación comercial.
- Revisión independiente corrigió: promociones frente a workarounds propios; URL compartida entre expedientes; revisiones que dejan de coincidir; reaparición de issues resueltos; comprobaciones antiguas frente a capturas recientes; contadores con corte histórico; duplicación de grupos entre países; starvation de consultas; lectura SQL de últimas evaluaciones y paginación del historial sin mezclar colaciones SQL/JS.
- Actualización de parche Next.js y eslint-config-next de 16.4.3 a 16.4.6 por GHSA-mfr8-8qww-v76h. La advertencia restante de minimatch transitivo en workflow se conserva en el diagnóstico privado; no se hizo un downgrade mayor de workflow.
- Último cambio funcional: paginación privada de cien evaluaciones con cursor compuesto, para evitar cargar meses completos en cada lectura. No se borra historial al paginar.

## Verificación final antes del push

536 pruebas unitarias/integración, 38 E2E de escritorio/móvil, lint, tipos y build aprobados. Comparación final de las 9,876 filas previas: cero IDs faltantes, cero reportes cerrados modificados y contenido financiero idéntico. Sólo se añadió un reporte provisional del día a las tablas anteriores. Respaldo nuevo completo de 48 tablas y 10,762 filas restaurado en PGlite temporal, incluyendo 14 definiciones, 5 decisiones, 838 vínculos, 12 comprobaciones y 16 evaluaciones. Las consultas públicas pendientes continúan por turnos; no se afirma cobertura total ni validación comercial.
