# Oportunidades y fuentes regionales — plan de implementación

> **For agentic workers:** Execute in this session using executing-plans and request an independent code review before publication. User approved implementation and production deployment; preserve all portfolio code and historical evidence.

**Goal:** Acumular problemas específicos con evidencia propia y cobertura regional gratuita, evitando la hipótesis falsa detectada en la auditoría.

**Architecture:** Limpieza y taxonomía compartidas entre los dos recorridos de investigación; vista actual reconstruida, archivo original intacto. Conectores oficiales limitados dentro del trabajo existente; resumen de investigación y exportación con evidencias/lagunas explícitas.

**Tech Stack:** Next.js 16/React 19/TypeScript/PostgreSQL y APIs públicas CKAN/Socrata, sin dependencias ni tablas nuevas. Guía instalada de Route Handlers revisada.

## Ejecución

- [ ] **1. Regresiones y criterios compartidos.** Crear `src/features/research/evidence-text.ts` y `problem-scope.ts`; pruebas en `tests/opportunity-quality.test.ts` con las dos citas reales de programación, texto citado en Markdown/HTML, plantillas GitHub, comentarios editoriales, y necesidades operativas válidas. Ejecutar `npx vitest run tests/opportunity-quality.test.ts`, primero reproducir el fallo y después resolverlo.
- [ ] **2. Reconstrucción y agrupación.** Integrar en `signals.ts`, `cluster.ts`, `service.ts` y `evidence/engine.ts`. Recalcular etiquetas, miembros/autores y campos de tareas/segmentos. La misma consulta no duplica señales/eventos; toda fila histórica permanece. Probar migración de un cuaderno mal agrupado, misma tarea de dos autores y tareas/segmentos/productos distintos.
- [ ] **3. Conectores regionales.** Crear `src/features/evidence/regional-connectors.ts` y pruebas dedicadas. PROFECO datastore: veinte casos por ciclo, campos permitidos, filtro de fechas y cursor. Colombia: veinte grupos mensuales, estadística explícita sin voces. Integrar tipos/defaults/servicio y visibilidad de errores/antecedentes; seis horas entre peticiones y presupuesto de bytes existente. Comprobar en vivo esquemas y casos de servidor inválido/futuro/duplicado/cuota.
- [ ] **4. Ayuda para investigar un negocio.** Añadir resumen compacto en Oportunidades usando solo problemas con evidencia operativa. Cada entrada muestra qué falta y un siguiente experimento; no afirma validación. Integrar cobertura regional/estadísticas en exportación y reportes sin transformar agregados en clientes. Reutilizar UI y estilos existentes, detalles plegados.
- [ ] **5. Verificación y revisión.** Ejecutar pruebas de investigación/evidencia y después suite completa, Python, lint/tipos/build y E2E. Pedir revisión independiente con archivos y criterios concretos. Corregir problemas importantes. Confirmar `git diff --name-only` sin modificaciones de portafolio.
- [ ] **6. Publicación y cierre.** Respaldo previo, commit/push autorizado por integración Git, Vercel Ready, actualización real de noticias/investigación, inspección de cifras/fuentes en Neon y navegador escritorio/móvil. Monitor, respaldo final y restauración aislada completa. Reportar mejoras y cobertura efectiva; no prometer fuentes que no respondieron.
