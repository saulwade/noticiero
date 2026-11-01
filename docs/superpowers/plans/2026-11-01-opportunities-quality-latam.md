# Oportunidades y fuentes regionales — plan de implementación

> **For agentic workers:** Execute in this session using executing-plans and request an independent code review before publication. User approved implementation and production deployment; preserve all portfolio code and historical evidence.

**Goal:** Acumular problemas específicos con evidencia propia y cobertura regional gratuita, evitando la hipótesis falsa detectada en la auditoría.

**Architecture:** Limpieza y taxonomía compartidas entre los dos recorridos de investigación; vista actual reconstruida, archivo original intacto. Conectores oficiales limitados dentro del trabajo existente; resumen de investigación y exportación con evidencias/lagunas explícitas.

**Tech Stack:** Next.js 16/React 19/TypeScript/PostgreSQL y APIs públicas CKAN/Socrata, sin dependencias ni tablas nuevas. Guía instalada de Route Handlers revisada.

## Ejecución

- [x] **1. Regresiones y criterios compartidos.** Crear `src/features/research/evidence-text.ts` y `problem-scope.ts`; pruebas en `tests/opportunity-quality.test.ts` con las dos citas reales de programación, texto citado en Markdown/HTML, plantillas GitHub, comentarios editoriales, y necesidades operativas válidas. Ejecutar `npx vitest run tests/opportunity-quality.test.ts`, primero reproducir el fallo y después resolverlo.
- [x] **2. Reconstrucción y agrupación.** Integrar en `signals.ts`, `cluster.ts`, `service.ts` y `evidence/engine.ts`. Recalcular etiquetas, miembros/autores y campos de tareas/segmentos. La misma consulta no duplica señales/eventos; toda fila histórica permanece. Probar migración de un cuaderno mal agrupado, misma tarea de dos autores y tareas/segmentos/productos distintos.
- [x] **3. Conectores regionales.** Crear `src/features/evidence/regional-connectors.ts` y pruebas dedicadas. PROFECO datastore: veinte casos por ciclo, campos permitidos, filtro de fechas y cursor. Colombia: veinte grupos mensuales, estadística explícita sin voces. Integrar tipos/defaults/servicio y visibilidad de errores/antecedentes; seis horas entre peticiones y presupuesto de bytes existente. Comprobar en vivo esquemas y casos de servidor inválido/futuro/duplicado/cuota.
- [x] **4. Ayuda para investigar un negocio.** Añadir resumen compacto en Oportunidades usando solo problemas con evidencia operativa. Cada entrada muestra qué falta y un siguiente experimento; no afirma validación. Integrar cobertura regional/estadísticas en exportación y reportes sin transformar agregados en clientes. Reutilizar UI y estilos existentes, detalles plegados.
- [x] **5. Verificación y revisión.** Ejecutar pruebas de investigación/evidencia y después suite completa, Python, lint/tipos/build y E2E. Pedir revisión independiente con archivos y criterios concretos. Corregir problemas importantes. Confirmar `git diff --name-only` sin modificaciones de portafolio.
- [ ] **6. Publicación y cierre.** Respaldo previo, commit/push autorizado por integración Git, Vercel Ready, actualización real de noticias/investigación, inspección de cifras/fuentes en Neon y navegador escritorio/móvil. Monitor, respaldo final y restauración aislada completa. Reportar mejoras y cobertura efectiva; no prometer fuentes que no respondieron.


## Verificación previa a publicación

382 pruebas de aplicación/integración en 37 archivos, 61 Python y 38 E2E escritorio/teléfono correctos; lint, tipos y build correctos (18 páginas, 25 pasos de workflow). Regresiones cubren citas Markdown/HTML/inline, recomendaciones, atribución legacy con párrafos, conservación de señales versionadas, identidad estable de cuadernos, tareas/clientes diferentes, totales estadísticos y fechas/cursor/cuota. Revisión independiente final sin bloqueos. No hay modificaciones en archivos de portafolio/finanzas/cotizaciones.

Conectores comprobados en vivo: PROFECO respondió con veinte casos, fecha original del 2 al 27 de julio de 2026; Colombia con veinte grupos estadísticos de septiembre de 2026. Se identifican como antecedentes/periodos, no novedades diarias ni clientes. PROFECO alterna cabecera y paginación para revisar actualizaciones sin escanear el CSV completo; la API antigua devuelve 404 y el servicio SQL no está disponible, por lo que se usa exclusivamente datastore_search con campos permitidos. Los números de expediente son identificadores públicos del conjunto, no identificadores personales de denunciantes.

Fuentes primarias: [catálogo oficial PROFECO](https://www.datos.gob.mx/dataset/quejas_materia_servicios/resource/e93eee6a-014b-4836-b47e-04744bfe109f), [metadatos de recurso CKAN](https://www.datos.gob.mx/api/3/action/resource_show?id=e93eee6a-014b-4836-b47e-04744bfe109f), [conjunto oficial Superfinanciera](https://www.datos.gov.co/d/xyy7-rn7p), [esquema de columnas Socrata](https://www.datos.gov.co/api/views/xyy7-rn7p.json). Respaldo previo `41326729293`: éxito. La tarea 6 registra el cierre de producción después de la ejecución real.

La comprobación con datos reales también separó fallos de automatización por mecanismo (bucle, activación sin prompt, notificación omitida, contrato API, zona horaria y recursos). Mencionar workflow no basta para unir casos; soporte/trabajo manual sin tarea identificada permanece aislado y fuera de la selección. Regresiones añadidas; 382 pruebas y build final correctos. La interfaz cubierta por los 38 E2E no cambió en este ajuste.
