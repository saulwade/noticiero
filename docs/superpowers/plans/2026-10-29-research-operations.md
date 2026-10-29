# Investigación y operaciones — Implementation Plan

**Goal:** acumular evidencia tecnológica/financiera automáticamente, respaldarla y facilitar entrevistas sin depender de la laptop.

**Architecture:** conservar Next.js, Drizzle/PostgreSQL y Workflow. Añadir módulos aislados de archivo, validación, salud y respaldo cifrado; automatizaciones privadas de GitHub Actions para independencia y avisos.

**Tech Stack:** TypeScript, Next.js 16.4, React, PostgreSQL/PGlite, Node crypto/zlib, GitHub Actions.

- [x] Archivo: tipos y tablas opportunity_events; retirar topes por edición del motor local; registrar solo cambios de contenido; exportar investigación por periodo y mostrar archivo automático. Pruebas: descubrimiento, revisiones sin duplicar y recuperación de evidencia antigua.
- [x] Fuentes: verificar feeds públicos; categorías Finanzas y Operaciones en normalización, filtros, reportes y UI. Probar noticias financieras admitidas y promociones excluidas.
- [x] Validación: tablas validation_projects/interviews, esquema Zod y repositorio, API autenticada/mismo origen, vista con formularios y relación con oportunidades. Probar persistencia, referencias y validación de campos.
- [x] Salud: tablas operation_alerts/backup_runs, evaluación pura de plazos y fallos, reconciliación y rutas con secretos limitados. Mostrar estados y enlaces a operaciones. Probar fallos, ausencias y recuperación.
- [x] Respaldo: listado completo de tablas, snapshot consistente, gzip+AES-GCM, manifiesto y restauración solo en destino vacío. Probar corrupción, clave incorrecta, omisión de tablas y restauración a PGlite temporal.
- [ ] Automatización: workflows privados de respaldo diario y watchdog tras cada ventana, acciones oficiales fijadas a commits, avisos deduplicados mediante incidencia privada. Crear rol de lectura, secretos y repositorio privado; probar workflow_dispatch y restaurar artefacto descargado.
- [ ] Verificación/publicación: lint, TypeScript, pruebas de integración y E2E, build, revisión independiente, despliegue y comprobación real; documentar costes, recuperación y uso diario/por tres días.

Archivos principales: src/lib/types.ts, src/db/schema.ts, src/features/research/{service,opportunities,archive}.ts, src/features/validation/_, src/features/operations/_, src/features/backups/_, src/components/{research-workspace,validation-workspace,operations-view,dashboard}.tsx, src/features/{sources,news}/_, scripts/{backup,restore-backup,notify-ops}.ts, ops/workflows/*.yml y pruebas correspondientes.

Contratos: `recordOpportunity(idea, observedAt, db)` persiste revisión por hash de contenido; `researchBrief(days)` devuelve Markdown de evidencia fechada; `saveValidation(input)` valida antes de escribir; `healthFindings(jobs, backup, now)` devuelve códigos estables sin datos personales; `sealBackup(snapshot,key)`/`openBackup(bytes,key)` autentican archivo versionado; `restoreSnapshot(snapshot,target)` comprueba esquema y destino vacío antes de insertar en una transacción.

## Verificación antes de publicar

76 pruebas unitarias/integración aprobadas, incluidas conservación de contextos fuera del corpus, archivo idempotente, concurrencia al crear investigaciones, copia histórica/favorita y restauración cifrada. 18 E2E de escritorio/móvil aprobadas con base temporal. Lint, TypeScript y build aprobados. La revisión independiente encontró tres P2 (parcialidad sin aviso, duplicación concurrente y selección de revisión histórica), corregidos y comprobados con regresiones y revisión posterior. Las pruebas de contextos históricos fallaron antes del arreglo y pasaron después.
