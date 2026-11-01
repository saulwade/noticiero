# Fase 2B: noticias e investigación financiera antes de comprar

> **For agentic workers:** Use executing-plans task-by-task, with independent review before publication. The user approved continuing phase 2 and explicitly requested a usable news flow inside the portfolio without entering investments.

**Goal:** Convertir el portafolio vacío en un espacio útil para leer noticias financieras, investigar hipótesis y conservar conclusiones, sin crear compras o asignaciones por defecto.

**Architecture:** Reutilizar noticias, resúmenes y cotizaciones ya guardados. Un motor local conserva fichas versionadas por noticia/contenido/reglas y un informe por fecha CDMX. La lectura no llama proveedores ni escribe datos. El estado financiero se mantiene independiente del Radar de negocios. Las notas personales son explícitas y versionadas; las fichas e informes se guardan durante la actualización durable existente.

**Tech Stack:** Next.js/TypeScript, PostgreSQL/PGlite, Workflow, Vitest y Playwright. Sin nuevas claves, dependencias, modelos descargados ni suscripciones.

## Diseño y aceptación

- Resumen abre con noticias y recorrido de investigación cuando no hay movimientos. Ocultar la franja dominante de tres ceros en ese estado y mostrar que la cartera aún no ha empezado. Los movimientos y el diario continúan disponibles; no exigir registrar dinero.
- Investigar muestra noticias desde el primer ciclo, sin añadir instrumentos. Cada ficha conserva fuente, enlace, fecha, texto disponible, empresas mencionadas, tema, lenguaje textual y preguntas. El detalle distingue cita/hecho publicado de hipótesis; una mención no prueba causalidad bursátil.
- Los informes agrupan empresas/temas de las fichas, con cantidades trazables e incertidumbres, sin llamar popularidad a evidencia de rentabilidad. Se consultan/exportan para análisis posterior.
- Reglas de eventos: resultados, regulación, seguridad, financiación, adquisiciones, productos/costos, inversión en infraestructura, macroeconomía. Las hipótesis se redactan como preguntas/condicionales y nunca inventan cifras o causalidad.
- Lenguaje del texto: diccionario bilingüe y negaciones, etiquetas favorable/adverso/mixto/sin señal; no se presenta como probabilidad ni recomendación. Exponer método y límites. Cobertura de al menos 20 casos de cifras, negación, doble señal, solo titular, promoción, pregunta, fuente repetida y empresa privada.
- Cotización como contexto separado: sesión, moneda, proveedor y fecha de consulta. Una cotización posterior a la publicación no representa lo que se sabía al publicarse. BMV/SIC y bonos conservan la cobertura declarada de fase 2A.
- Filtros sencillos por periodo (3/7/30 días) y empresa/tema. Una acción de detalle por noticia. Notas de investigación con guardar explícito; revisiones preservan la copia y razonamiento anteriores.
- No precargar instrumentos, aportaciones, política aprobada ni decisiones personales. Las fichas archivadas son investigación editorial, no posiciones.
- Nuevas tablas `finance_news_events`, `finance_news_reviews`, `finance_news_briefs`; el backup pasa de 34 a 37, aceptando completos de 22/26/33/34. Exportación privada incluye fichas y notas. Topes de 5,000 versiones de fichas, 500 notas y 1,100 informes; archivo financiero conjunto de 50 MB, sin borrar ni contratar ampliaciones.

## Tareas

- [x] 1. Contratos y motor puro. Crear `research-types.ts`, `news-research.ts` y tests de clasificación, texto, fuentes, hashes y deduplicación. Las noticias comunitarias sin contexto financiero no se convierten en análisis de inversión.
- [x] 2. Archivo automático. Crear `research-service.ts`, tablas/migraciones aditivas y estado operativo. Procesar noticias existentes para recuperar evidencia pendiente, idempotente por contenido/reglas; conservar versiones. Informes por fecha con captura actual y texto original. Probar límites, notas inmutables, lectura sin escrituras y recuperación de fallos.
- [x] 3. Integrar Workflow/local, GET privado, acción de nota validada y exportación. No cambiar la recopilación ni las oportunidades. Ampliar respaldo y comprobar compatibilidad con 34.
- [x] 4. UI con noticias presentes en Resumen e Investigar, sin formulario obligatorio ni ceros dominantes. Fuentes/preguntas/notas en detalle progresivo, informe descargable. Mantener cuatro vistas y accesibilidad móvil.
- [x] 5. Evaluar el motor con casos verificables y dejar un documento de método. Clasificar lenguaje no entrena un predictor y no convierte preguntas en hechos. Los resúmenes extractivos siguen en el idioma de origen; la evaluación de traducción generativa, históricos completos de rendimiento total y correlaciones no se dan por terminados aquí.
- [x] 6. Verificar unit/integración, lint, TypeScript, Python, build y E2E completos; revisión independiente sin bloqueos.

## Recorrido de uso

1. Resumen: leer qué pasó, abrir lo que merece investigación.
2. Investigar: contrastar fuentes, variables financieras pendientes y riesgos; guardar una nota si se desea.
3. Revisar informes y notas conmigo para formular o descartar una tesis.
4. Cuando se acuerde una estrategia, preparar el portafolio inicial; registrar solo las operaciones reales después de ejecutarlas en el intermediario.
5. Movimientos y Diario conservan la contabilidad y las decisiones. Las noticias por sí solas no generan órdenes.


## Verificación previa y condición de publicación

Pasaron 290 pruebas de lógica/integración en 26 archivos, 8 Python, lint, TypeScript, build Webpack y 32 E2E de escritorio/teléfono. La revisión corrigió menciones Apple/Amazon, identidad de metadatos, notas fuera de la vista, recuperación histórica por cursor y estado de fallo concurrente. Se verificó la reversión A→B→A y el desempate por revisión con el mismo instante, sin reescribir reportes anteriores.

La comprobación real añadió regresiones para excluir una lista comercial, clasificar un robo de criptomonedas y preservar noticias narrativas de resultados de Microsoft/Amazon. El motor v2 filtra la selección actual sin borrar el archivo previo.

Respaldo previo confirmado. La publicación por Git exige después Ready, ciclo real, fichas/informe persistidos con cartera vacía, respaldo posterior y restauración comparada. El cierre se registra en el plan privado sin subir datos personales a Git.
