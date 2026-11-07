# Opportunity Signal Quality Implementation Plan

> **For agentic workers:** Execute inline using executing-plans; request independent code review before publication.

**Goal:** Improve automatic research precision and visibility while preserving all source evidence and adding a bounded public Mexico-focused technical sample.

**Architecture:** Pure interpretation functions feed existing daily reports. A separate GitHub connector state uses the existing evidence store, quotas and archive; no schema migration or UI changes.

**Tech Stack:** TypeScript, Next.js installed guides, Vitest, PostgreSQL/Neon, existing GitHub Actions and Vercel.

## Tasks

- [x] Capture encrypted baseline with existing read-only backup role; record current diagnostic evaluation and prepare a `codex/` branch.
- [x] Add regressions to `tests/opportunity-quality-november.test.ts` and existing evidence fixtures: n8n credential/UI distinction, import encoding/overwrite distinction, generic technical tasks isolated, specific invoice exports repeat, recommendations and completed work not counted as current pain. Run failing tests, then update `problem-scope.ts`, `signals.ts`, `content-quality.ts`, `vector.ts` as needed.
- [x] Create `src/features/evidence/research-digest.ts` with bounded repeated/isolated/historical candidates and explicit gaps. Add as optional daily report data and Markdown, filtering capture and publication by report cutoff. Read evidence in `saveDailyReport`; refresh Radar before research in the existing update job. Test input immutability, statistics exclusion, resolutions, same author, future evidence and archived reports.
- [x] Add `collectGithubMexico` with separate `github-mx` state, allowlisted verified repositories and the existing request/size/cooldown/failure paths. Preserve `github` source identity for records and source-family deduplication. Test allowlist, independent cursor, 429, malformed/future dates and no country inference. Probe live without credentials and then store through the existing guarded workflow.
- [x] Run `env -u DATABASE_URL -u VERCEL -u NOTICIERO_E2E npm test`, `npm run lint -- --ignore-pattern 'research/**'`, `npm run typecheck`, `npm run build` and the frozen `scripts/evaluate-opportunities.ts`. Compare before/after real captures without changing labels. Request independent review and resolve findings.
- [x] Publish through existing main integration; confirm Ready deployment. Activate the isolated fiscal collector and research/report functions (without invoking finance); verify scheduled editions use the updated workflow, read new reports/source state and verify no previous IDs or immutable records changed. Document counts and limitations, especially no fabricated commercial validation and no change in official historical source recency.

## Resultados de verificación previa

- Corte cifrado previo: 43 tablas, 5,770 filas, rol de lectura, archivo privado fuera de Git.
- Muestra fija sin cambiar etiquetas ni hash: 53/54 problemas detectados antes, 54/54 después; 0 falsos positivos en ambos. Cien ejemplos etiquetados por agente, ensayo diagnóstico no ciego; no equivale a validación comercial ni precisión general.
- 490 pruebas unitarias/integración y 38 E2E de escritorio/móvil aprobadas; lint y tipos aprobados; build final aprobado. Revisión independiente: tres defectos corregidos con regresiones (contexto OAuth exitoso, conteos tras filtrar evidencia, antecedente manual que ocultaba fallo presente); sin bloqueos restantes.
- La consulta pública fiscal devolvió un issue verificable de CfdiUtils, fechado 28 de octubre y cerrado. Cierre no se interpreta como resolución; el reporte exige comprobar vigencia. No se atribuye país al autor.
- Los tests originales de conteo y resolución especifican JWT para que el mismo mecanismo sea la base de repetición; la evidencia de evaluación congelada permanece intacta.
- Optimización local de interpretación por snapshot: no recalcular la misma cita en cada campo del dossier. La suite completa final tardó 55 segundos.

## Cierre en producción · 7 de noviembre

- Código publicado: `26a3e7f`, despliegue Ready `dpl_CkcVDjJGg9mYNHJAePCyUQSBnU1t`, alias https://noticiero-self.vercel.app.
- Activación limitada al nuevo colector fiscal y las funciones de investigación/reporte; no se ejecutó el análisis financiero ni una actualización de cotizaciones. El workflow existente consulta el nuevo colector con su propio enfriamiento de seis horas.
- Primera consulta fiscal: un issue público recibido y archivado, con fecha original y estado cerrado conservados.
- Corte provisional del 7 de noviembre guardado en Neon: cinco líneas repetidas, tres pistas aisladas y tres antecedentes históricos; no son once negocios validados. El cierre nocturno continúa con el mecanismo existente.
- Comparación transaccional contra el respaldo previo: 43 tablas, 5,770 → 5,774 filas; cero IDs anteriores faltantes y cero cambios inesperados. Se conservan todas las versiones originales de evidencia, observaciones, señales, reportes cerrados, guardados y contenido financiero. Cambian únicamente las vistas/modelo de investigación y el reporte semanal provisional esperados.
- Sin nuevas claves, servicios de pago, tareas programadas, entrevistas, formularios o cambios del portafolio. El directorio ajeno `research/` permanece fuera del cambio.
- Límites: cobertura pública parcial; la fuente fiscal aporta contexto mexicano, no ubicación del autor ni intención de compra; PROFECO y SFC conservan el desfase de sus publicaciones oficiales. Las mejoras del detector no sustituyen validación comercial.
