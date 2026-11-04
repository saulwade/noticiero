# Mexico Radar News — implementación

> Ejecutar en esta sesión con executing-plans. La autorización del usuario cubre la extensión del contrato ya presentado. No tocar research/ ajeno ni código financiero. Revisión de privacidad y pruebas antes de publicar.

**Goal:** añadir cobertura empresarial mexicana y un export público en contenido, privado en acceso, separado de los módulos existentes.
**Architecture:** lector RSS acotado → revisiones inmutables en tablas nuevas → GET con selección explícita de campos/cursor firmado; paso opcional tras el trabajo existente.
**Tech Stack:** Next16, TypeScript, RSS Parser, Drizzle/PostgreSQL, Vitest. Sin dependencias nuevas.

- [ ] 1. Crear tipos, fuentes y lector en src/features/business-news/{types,feeds}.ts. Probar filtrado de campañas/expansión, exclusión política/deportes/reclutamiento, fecha inválida/futura, país desconocido, URLs y cuerpo sobredimensionado. Comando: node --import tsx node_modules/vitest/vitest.mjs run tests/business-news.test.ts.
- [ ] 2. Añadir dos tablas a src/db/schema.ts y respaldo a src/features/backups/format.ts, conservando aceptación estricta de esquemas de 22/26/33/34/37/41 tablas. Probar restauración con datos nuevos y viejos, y rechazo de mezcla parcial en tests/backups.test.ts.
- [ ] 3. Implementar service.ts: lease propio, seis horas por fuente, una descarga de 2MB, versiones por hash sin borrado, capacidad conservadora, estado de fallo sanitizado y archivo previo intacto. Inyectar después de finishUpdate en flujo durable y local con excepción aislada. Pruebas de deduplicación, concurrencia, capacidad y error de una fuente sin bloquear las demás.
- [ ] 4. Crear export.ts y src/app/api/news/export/route.ts: autorización independiente, proyección explícita, filtros estrictos y cursor firmado con snapshot/filtros/expiración. Probar 401 sin credencial y con credenciales cron/ops, no filtrar campos extra, páginas sin repetición/saltos y cursor alterado o usado con filtros distintos. GET sin mutaciones ni llamadas a dashboard.
- [ ] 5. Documentar contrato en docs/mexico-radar-news-api.md y NEWS_EXPORT_SECRET en .env.example. Verificar todo con env -u DATABASE_URL -u VERCEL -u NOTICIERO_E2E npm test; lint excluyendo research/**; typecheck; build; pruebas de API local y regresiones de escritorio/móvil.
- [ ] 6. Capturar respaldo previo con rol de lectura, commit/push autorizado a Vercel, verificar Ready, preparar secreto exclusivo por entrada estándar sin imprimirlo, ingesta real de fuentes, export local seguro y comprobar persistencia anterior. Ejecutar respaldo completo y recuperación local nueva. Documentar muestra real y límites sin afirmar licencias de republicación, intención de compra o clientes.
