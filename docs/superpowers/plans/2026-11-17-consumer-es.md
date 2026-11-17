# Consumer ES Implementation Plan

> **For agentic workers:** Use executing-plans inline; preserve current source/history and the local VETA checkout.

**Goal:** Add automatic, bounded public Spanish consumer evidence and durable research reports without paid services.

**Architecture:** An Apple RSS connector writes versioned evidence through the existing store. A pure consumer context feeds dossiers/idea memory and a separate consumer digest in existing reports. Optional JSON provenance avoids migrations/new tables.

**Tech Stack:** Existing TypeScript, Zod, postgres/Drizzle, Vitest and Next.js; no added dependency.

- [x] Add `src/features/evidence/app-reviews.ts` and tests: six verified app IDs, seven storefronts, three requests/turn, retry/cooldown, bounded/privacy-safe Spanish excerpts with rating/date provenance and stable cross-store IDs. Follow `publicJson` transport constraints.
- [x] Add `src/features/research/consumer-context.ts` and tests for task/cause, positive/negative/resolved/unsupported review evidence. Connect only app-store records in `problemContext`; old records keep interpretation.
- [x] Extend optional record/link types with app metadata/dateBasis; exclude source_updated from original-publication comparisons in timeline/memory. Reserve up to two of five new idea slots for consumer scopes. No original rows/definitions changed.
- [x] Add `src/features/evidence/consumer-digest.ts`; attach optional digest and Markdown to existing daily/private research reports. Keep global Spanish focus and country unknown; no UI or mandatory manual steps. Document limits in `docs/consumer-apps-method.md`.
- [x] Run focused failing/passing regressions, full tests, frozen evaluation, lint/types/build and appropriate existing E2E. Review modified paths and all counters/citations.
- [ ] Capture encrypted production baseline; activate only the new connector and memory/report with existing owner configuration. Verify real source states, preservation, idempotency and full encrypted restore including new JSON fields. Publish existing Vercel app, verify Ready/private access/monitor and backup. Record actual coverage/errors, no claims of exhaustive reach.

## Revisión y evidencia de calidad

Revisión independiente corrigió etiquetas/counters semanales de source_updated, negaciones y cláusulas ajenas, resoluciones de otra tarea, recordatorios con causas distintas, sólo-resolución registrada como hipótesis nueva, teléfonos de nueve dígitos/con puntos, correos Unicode y handles/enlaces de contacto. Se añadieron reproducciones a tests y el revisor confirmó cerrado el último caso de resolución mezclada. Las reglas son heurísticas y no prueban precisión general.

La primera muestra real de las tres combinaciones iniciales tuvo 33 reseñas elegibles en español y 20 de cuatro/cinco estrellas; se separaron cinco pistas operativas, aisladas. Esa exploración no se presentó como demanda validada ni como cobertura de todas las tiendas. El perfil de autor público actual de Apple tiene una ruta de reviews localizada; se comprobó su formato y se normaliza únicamente el identificador, sin guardar el perfil.

La muestra congelada de 100 ejemplos conserva hash 0fc59d5904aa086f70c254380fdfe0eab3557d40e98c1abd4b7b5cf6d5acc3e3 y resultado diagnóstico sin cambios (54 positivos/46 negativos). Suite actual: 552 pruebas. Build, lint y tipos aprobados; 38 pruebas E2E de escritorio/móvil pasaron con la sección consumer en el reporte privado. Corte cifrado previo: 48 tablas / 11,423 filas.

Activación de investigación en Neon: 33 reseñas, 33 claves hash de cuentas públicas (no personas verificadas), cinco pistas aisladas y dos hipótesis consumer automáticas iniciales. Fuente App Store status ok, sin fallos en las tres consultas iniciales; cursor continúa desde la cuarta combinación. La carga repetida añadió cero duplicados. Se conservaron las cuatro ideas revisadas. La primera activación se demoró en una lectura transaccional; se interrumpió sólo el proceso manual y el reintento idempotente completó memoria y reporte. No se afirma que el primer intento nunca escribiera: el reintento encontró las reseñas ya persistidas.

Comparación posterior de las 11,423 filas previas: cero IDs faltantes, cero filas anteriores modificadas y cero cambios en reportes cerrados; finanzas idénticas. Se añadieron 33 revisiones de evidencia, un estado de fuente, cinco definiciones (dos consumer), nueve vínculos, seis comprobaciones y ocho evaluaciones; un reporte nuevo del día. Sigue habiendo 48 tablas. El snapshot posterior cifrado se conserva para restauración temporal.
