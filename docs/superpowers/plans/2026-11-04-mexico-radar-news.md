# Mexico Radar News — implementación

> Ejecutar en esta sesión con executing-plans. La autorización del usuario cubre la extensión del contrato ya presentado. No tocar research/ ajeno ni código financiero. Revisión de privacidad y pruebas antes de publicar.

**Goal:** añadir cobertura empresarial mexicana y un export público en contenido, privado en acceso, separado de los módulos existentes.
**Architecture:** lector RSS acotado → revisiones inmutables en tablas nuevas → GET con selección explícita de campos/cursor firmado; paso opcional tras el trabajo existente.
**Tech Stack:** Next16, TypeScript, RSS Parser, Drizzle/PostgreSQL, Vitest. Sin dependencias nuevas.

- [x] 1. Crear tipos, fuentes y lector en src/features/business-news/{types,feeds}.ts. Probar filtrado de campañas/expansión, exclusión política/deportes/reclutamiento, fecha inválida/futura, país desconocido, URLs y cuerpo sobredimensionado. Comando: node --import tsx node_modules/vitest/vitest.mjs run tests/business-news.test.ts.
- [x] 2. Añadir dos tablas a src/db/schema.ts y respaldo a src/features/backups/format.ts, conservando aceptación estricta de esquemas de 22/26/33/34/37/41 tablas. Probar restauración con datos nuevos y viejos, y rechazo de mezcla parcial en tests/backups.test.ts.
- [x] 3. Implementar service.ts: lease propio, seis horas por fuente, una descarga de 2MB, versiones por hash sin borrado, capacidad conservadora, estado de fallo sanitizado y archivo previo intacto. Inyectar después de finishUpdate en flujo durable y local con excepción aislada. Pruebas de deduplicación, concurrencia, capacidad y error de una fuente sin bloquear las demás.
- [x] 4. Crear export.ts y src/app/api/news/export/route.ts: autorización independiente, proyección explícita, filtros estrictos y cursor firmado con snapshot/filtros/expiración. Probar 401 sin credencial y con credenciales cron/ops, no filtrar campos extra, páginas sin repetición/saltos y cursor alterado o usado con filtros distintos. GET sin mutaciones ni llamadas a dashboard.
- [x] 5. Documentar contrato en docs/mexico-radar-news-api.md y NEWS_EXPORT_SECRET en .env.example. Verificar todo con env -u DATABASE_URL -u VERCEL -u NOTICIERO_E2E npm test; lint excluyendo research/**; typecheck; build; pruebas de API local y regresiones de escritorio/móvil.
- [x] 6. Capturar respaldo previo con rol de lectura, commit/push autorizado a Vercel, verificar Ready, preparar secreto exclusivo por entrada estándar sin imprimirlo, ingesta real de fuentes, export local seguro y comprobar persistencia anterior. Ejecutar respaldo completo y recuperación local nueva. Documentar muestra real y límites sin afirmar licencias de republicación, intención de compra o clientes.

Revisión independiente: se corrigieron token en fragmento URL, pie editorial como país, Nuevo México, captura tardía dentro de snapshot y fecha/categoría corregida sin revisión. Snapshot ahora usa secuencia interna monotónica y lock compartido con las escrituras. Corte previo cifrado:41 tablas/4167 filas. Contrato y tests de respaldo histórico distinguen explícitamente tablas nuevas sin cambiar comportamiento financiero.

Verificación previa a publicar:460 pruebas pasan en49 archivos,38 E2E escritorio/teléfono, lint/tipos/build correctos. Tres fuentes reales accesibles con lector final. Revisor confirmó sin bloqueos tras las correcciones. Credencial exclusiva de lectura preparada como secreto de producción sin publicarla ni copiarla a otro proyecto.


## Cierre de publicación

Commit funcional 50082e0, despliegue dpl_B2ectRwppCM9xNTDYkPuQGfQKEBo Ready y alias https://noticiero-self.vercel.app. Ingesta empresarial real del 4 de noviembre: 30 revisiones (5 El Economista, 7 Expansión, 18 Marketing4eCommerce), 11 con mención explícita de México; tres fuentes ok. Se probó HTTP200 y recorrido completo en 5 páginas, 401 sin token/con token incorrecto y401 del dashboard usando la credencial nueva. Filtro inválido y cursor manipulado devuelven 400. Exportación pública local en .data/coordination/mexico-radar-news-2026-11-04.json y muestra de 10 notas en el mismo directorio; no se modificó el proyecto consumidor ni se copiaron credenciales a él.

Comparación con corte previo: cero registros originales desaparecidos o modificados; todo el archivo financiero y de investigación anterior idéntico. Sólo se añadieron 30 noticias y 3 estados. Respaldo de 43 tablas / 4200 filas conservado en archivo histórico del trabajo 41924198571; SHA256 58c6cbc743157040f2486618ae021ce12ba5927ce26839ea0464fb9df20970e4. Recuperación en directorio local nuevo sin diferencias. No se restauró sobre producción.

El trabajo de respaldo figura fallido por su paso final de salud; los pasos de cifrado, archivo histórico, descarga verificada y registro terminaron correctamente. El monitor mantiene tres hallazgos que ya existían en el respaldo previo de las 22:08Z: finance-stock-evidence, finance-fx-missing y evidence-sfc-co. El crítico es USD/MXN pendiente. No se silenciaron, no se ejecutó un análisis de cartera y no se modificaron esas fuentes/módulos, fuera de esta ampliación. La publicación empresarial y su endpoint están comprobados, pero el sistema completo no se declara libre de alertas.
