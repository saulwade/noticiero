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
- [x] **6. Publicación y cierre.** Respaldo previo, commit/push autorizado por integración Git, Vercel Ready, actualización real de noticias/investigación, inspección de cifras/fuentes en Neon y navegador escritorio/móvil. Monitor, respaldo final y restauración aislada completa. Reportar mejoras y cobertura efectiva; no prometer fuentes que no respondieron.


## Verificación previa a publicación

382 pruebas de aplicación/integración en 37 archivos, 61 Python y 38 E2E escritorio/teléfono correctos; lint, tipos y build correctos (18 páginas, 25 pasos de workflow). Regresiones cubren citas Markdown/HTML/inline, recomendaciones, atribución legacy con párrafos, conservación de señales versionadas, identidad estable de cuadernos, tareas/clientes diferentes, totales estadísticos y fechas/cursor/cuota. Revisión independiente final sin bloqueos. No hay modificaciones en archivos de portafolio/finanzas/cotizaciones.

Conectores comprobados en vivo: PROFECO respondió con veinte casos, fecha original del 2 al 27 de julio de 2026; Colombia con veinte grupos estadísticos de septiembre de 2026. Se identifican como antecedentes/periodos, no novedades diarias ni clientes. PROFECO alterna cabecera y paginación para revisar actualizaciones sin escanear el CSV completo; la API antigua devuelve 404 y el servicio SQL no está disponible, por lo que se usa exclusivamente datastore_search con campos permitidos. Los números de expediente son identificadores públicos del conjunto, no identificadores personales de denunciantes.

Fuentes primarias: [catálogo oficial PROFECO](https://www.datos.gob.mx/dataset/quejas_materia_servicios/resource/e93eee6a-014b-4836-b47e-04744bfe109f), [metadatos de recurso CKAN](https://www.datos.gob.mx/api/3/action/resource_show?id=e93eee6a-014b-4836-b47e-04744bfe109f), [conjunto oficial Superfinanciera](https://www.datos.gov.co/d/xyy7-rn7p), [esquema de columnas Socrata](https://www.datos.gov.co/api/views/xyy7-rn7p.json). Respaldo previo `41326729293`: éxito. La tarea 6 registra el cierre de producción después de la ejecución real.

La comprobación con datos reales también separó fallos de automatización por mecanismo (bucle, activación sin prompt, notificación omitida, contrato API, zona horaria y recursos). Mencionar workflow no basta para unir casos; soporte/trabajo manual sin tarea identificada permanece aislado y fuera de la selección. Regresiones añadidas; 382 pruebas y build final correctos. La interfaz cubierta por los 38 E2E no cambió en este ajuste.


## Cierre de producción comprobado

Motor final `78ead9f1b8c3967fe59f8a5d40fe2e62485eb390`, Vercel `dpl_DWMXeEKDGRSBZPQxs5zSqiuYTRGd` Ready con alias https://noticiero-self.vercel.app. Actualización real `5a14dba3-3ab9-4f3f-b3f3-6f42a55f1983`, de 16:50:28 a 16:50:42 UTC: completada, sin fuentes de noticias fallidas. Modelo actualizado en ese mismo ciclo. PROFECO y Superfinanciera respondieron en producción con veinte casos y veinte grupos mensuales, respectivamente. Sus estados limited describen muestreo parcial, no error ni bloqueo.

Archivo comprobado después del ciclo: 561 observaciones de contexto, 546 registros/versiones de evidencia y cuatro cierres diarios. Los quince registros originales de señales, catorce filas de cuadernos y el descubrimiento histórico permanecen intactos. La vista vigente acepta tres señales y tres cuadernos; la hipótesis falsa deja de ser activa. La selección actual muestra dos problemas por contrastar, no negocios validados ni demanda mexicana demostrada. Las cifras de registros/versiones no son personas independientes.

No se modificaron archivos de finanzas/portafolio ni se ejecutó su trabajador. La última propuesta conservó motor 1.2.2 y fecha 09:02:15 UTC, seis informes, cero instrumentos y cero movimientos. La recopilación normal de noticias conserva su archivo financiero separado.

Respaldo posterior automático `41328422901` y monitor `41328456077`: éxito. El respaldo manual redundante `41328450598` fue cancelado por la cola compartida mientras ya corría el automático; se comprobó el automático posterior al ciclo, sin repetirlo. Recuperación en un directorio local nuevo, comparación canónica de todas las filas: **41 tablas, 2,605 registros, cero diferencias**. No se restauró sobre producción.

Presentación y búsqueda: se retiró la caja vacía redundante cuando no hay hipótesis; los problemas seleccionados responden al buscador general. Los 38 E2E finales pasaron, incluida búsqueda con coincidencias y sin coincidencias en escritorio/teléfono. Build, tipos y lint correctos. Las comprobaciones visuales finales y los identificadores de presentación quedan en el reporte privado de entrega `.data/private/2026-11-01-oportunidades-mexico-latam.md`.
