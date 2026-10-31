# Noticiero: investigación de oportunidades con evidencia global y entrada en Latinoamérica

Estado: primera etapa aprobada por el usuario el 31 de octubre de 2026. Implementación y verificación en el plan `2026-10-31-evidence-radar.md`; las ampliaciones posteriores siguen siendo propuestas.

Fecha de investigación: 31 de octubre de 2026, America/Mexico_City.

## Objetivo y preferencia confirmada

Encontrar problemas suficientemente documentados para entrevistar personas y desarrollar un negocio que pueda comenzar en México o Latinoamérica y después expandirse. No hay preferencia inicial por consumidores o empresas: priorizar la evidencia más sólida. Mantener el costo lo más cercano a cero, conservar el historial y operar sin la laptop encendida.

La cobertura será una muestra creciente y explícita de fuentes; no se promete extraer todo internet ni predecir necesidades futuras con certeza. Los sectores permanecen abiertos. Se priorizan problemas, consecuencias y soluciones actuales; una tecnología novedosa, una mala reseña y un mercado pagador son observaciones distintas.

## Diagnóstico del sistema actual

- La revisión de producción de hoy encontró 627 documentos, 420 registros de contexto, cuatro señales aceptadas y tres reportes nocturnos. No hay oportunidades con repetición suficiente.
- La operación automática y los respaldos funcionan. El cuello de botella es la calidad y diversidad de evidencia, no la disponibilidad del dashboard.
- `src/features/sources/community.ts` limita Ask HN a 18 hilos y Show HN a 10. Revisa hasta tres respuestas por hilo, con un límite adicional de 36/18 comentarios. Esto favorece determinados usuarios y sectores.
- `src/features/research/signals.ts` reconoce reglas en inglés/español y procesa preguntas/comentarios. No existe todavía un tipo de reseña o reclamación estructurada.
- La identidad de autor se construye con prefijo `hn:`. Antes de ampliar conectores hay que definir identidad por plataforma y evitar colisiones.
- El TF-IDF actual mide palabras, no equivalencia semántica entre idiomas. Los cuadernos conservan su identidad, pero no se fusionan ni corrigen solos.
- No hay país/segmento sustentado por evidencia, comparación 7/30/90 días ni evaluación del clasificador con etiquetas humanas. Las entrevistas se guardan, pero no alimentan aprendizaje supervisado.

## Fuentes investigadas y acceso

Confirmar documentación no equivale a tener una integración funcionando. Antes de habilitar cada conector se exige una prueba de acceso, esquema, licencia, actualización real, atribución y consumo.

| Fuente | Aporte | Acceso y límite constatado | Decisión |
|---|---|---|---|
| HN / Ask / Show y YC existentes | Solicitudes, experiencias y productos nuevos | Integrados; muestra técnica y acotada. YC RFS es contexto editorial | Mantener y ampliar la muestra de forma rotativa y medible |
| PROFECO: quejas de servicios y telecomunicaciones | Problemas de consumidores en México | Catálogo oficial anuncia CSV; el recurso de servicios consultado cubre 2019 a enero de 2026. El acceso directo del buscador respondió 403 al abrir ciertas páginas | Primera etapa: importación de CSV obtenidos del portal por un usuario o conector solo tras comprobar una URL oficial accesible. Mostrar cobertura histórica; no prometer actualización diaria |
| CONDUSEF: indicadores y estadísticas | Contexto de reclamaciones, productos y entidades financieras mexicanas | CSV oficiales; productos consultados son anuales/trimestrales. REUNE API es para reportar información de instituciones, no una API pública de lectura de todas las quejas | Añadir como contexto estadístico, nunca como autores individuales inventados |
| CFPB Consumer Complaint Database | Reclamaciones financieras y narrativas públicas en EE. UU. | Datos de uso público, descarga y API; actualización generalmente diaria. No es muestra representativa de todos los clientes | Primer conector nuevo automático; muestra incremental por fecha y categorías, sin importar todo el histórico |
| GitHub Issues | Fallos, solicitudes y soluciones manuales alrededor de productos de software | API oficial de búsqueda; máximos documentados por consulta y cuotas por autenticación | Primer conector nuevo automático sobre una lista de productos públicos. No acceder a repositorios privados con el token existente |
| Stack Exchange | Preguntas sobre procesos y herramientas, incluidas comunidades en español/portugués | API oficial con cuotas, caché, atribución y backoff | Segunda etapa, comunidades seleccionadas; no asumir que una pregunta representa intención de compra |
| Consumidor.gov.br | Problemas y resolución de reclamaciones en Brasil | Portal oficial y catálogo de CSV hasta al menos junio de 2026 en lo consultado; existen relatos públicos, pero no se presupone API REST pública sin autorización | Segunda etapa, datasets abiertos y portugués; verificar disponibilidad actual por recurso |
| World Bank Enterprise Surveys | Obstáculos empresariales por economía, sector y tamaño | Indicadores agregados descargables; microdatos mediante portal con acceso separado | Contexto para contrastar países, con año de encuesta y tamaño de muestra |
| INEGI DENUE | Cantidad y distribución de establecimientos de un segmento en México | API documentada; token mediante registro | Dimensionar un segmento identificado. No prueba demanda ni disposición a pagar |
| Reddit | Conversaciones y necesidades | Requiere aprobación explícita para acceso API; uso comercial requiere aprobación escrita | Opcional, fuera de la ruta crítica y sin promesa de acceso gratuito |
| Product Hunt | Lanzamientos y alternativas existentes | API con token; por defecto no permite uso comercial sin autorización | Opcional; lanzamientos no cuentan como compradores |
| Trustpilot y otras plataformas de reseñas | Experiencias con productos y competidores | Trustpilot documenta endpoints públicos con API key; acceso, licencia y plan deben confirmarse. No se comprobó acceso de esta cuenta | Integración condicionada o importación autorizada. Sin prometer extracción masiva gratuita |
| App Store Connect / Google Business Profile | Reseñas de productos o ubicaciones gestionadas | Apple documenta reseñas de las apps de la cuenta; Google requiere OAuth y ubicaciones verificadas | Útiles si se aportan datos propios/autorizados; no resuelven una recopilación mundial de competidores |

## Tres caminos considerados

1. Añadir muchos feeds y buscadores al motor actual. Poco trabajo inicial, pero aumenta contenido editorial y ruido sin resolver la falta de evidencia de cliente.
2. Construir una capa de evidencia y ampliar gradualmente las fuentes. Recomendado: combina cobertura nueva, trazabilidad, contexto regional y medición de calidad sin contratar IA.
3. Usar un agente generativo que navegue continuamente. Mayor flexibilidad, pero consumo y resultados menos predecibles; no es apropiado como dependencia principal bajo la preferencia de costo actual.

## Diseño recomendado

### Evidencia con contexto verificable

Cada registro conserva identificador de fuente, URL, fecha del hecho/publicación, fecha de captura, idioma, versión del contenido y tipo: experiencia directa, solicitud, reseña, producto, noticia, estadística o señal futura. Los párrafos de terceros se tratan como datos y nunca como instrucciones.

Extraer, cuando el texto lo sustente: quién tiene el problema, qué intenta hacer, obstáculo, frecuencia, consecuencia, solución actual, producto usado y cantidades con moneda/unidad. Cada campo derivado debe apuntar a la cita que lo respalda. Ausente significa desconocido; no rellenar con una inferencia presentada como hecho.

País de la fuente, país del problema y mercado propuesto son campos diferentes. El español no demuestra que alguien viva en México. Un dato de EE. UU. puede motivar una investigación en México, pero la transferencia será una hipótesis explícita hasta tener evidencia local.

Identidad por plataforma y autor público; no vincular personas entre servicios por parecido de nombre. Separar autores identificados, reclamaciones sin identidad pública e indicadores agregados. No sumar filas de una estadística como si fueran entrevistas o usuarios independientes verificados.

### Agrupación por problema y calidad

Separar vocabulario de entidades y producto del vocabulario de problema. Mostrar, por ejemplo, el problema de límites de consumo antes que un título compuesto solo de marcas o palabras como “agree”.

La similitud genera candidatos para revisar; no justifica por sí sola fusionar segmentos. Guardar revisiones de agrupación y permitir corregir una asignación sin borrar las citas ni las hipótesis anteriores. Deduplicar contenido sindicado y reenvíos del mismo caso. Conservar evidencia que contradiga la oportunidad, reseñas positivas y soluciones existentes para reducir sesgo de confirmación.

Estados propuestos:

- Aislada: un caso capturado.
- Recurrente: varios casos independientes del mismo problema, con contexto comparable. Dos autores son una señal para investigar, no validación comercial.
- Contrastada: cuenta con evidencia adicional de otra familia de fuentes o evidencia local. Las estadísticas apoyan contexto; no se convierten en testimonios.
- En validación: investigación con entrevistas y experimentos guardados.

El orden de prioridad muestra sus razones: recurrencia, concreción de la consecuencia, recencia, diversidad de fuentes, correspondencia regional y evidencia de solución/pago actual. Cuando no hay datos, mostrar incertidumbre; no inventar un porcentaje de éxito o tamaño de mercado.

### Ficha para decidir qué entrevistar

Dentro del diseño blanco actual, añadir una ficha de problema con: segmento propuesto, países sustentados, citas y enlaces, fechas, producto/alternativas, costos observados, historial de actividad 7/30/90 días, contradicciones, posible entrada en México/LatAm y supuestos para expandirse.

La ficha termina con un experimento pequeño, hechos por comprobar y preguntas de entrevista. Reutilizar Entrevistas; no construir un CRM adicional ni contactar personas automáticamente.

### Reportes útiles y aprendizaje honesto

Añadir un balance semanal y mensual con problemas nuevos, cuáles reaparecieron, en cuáles cambió la evidencia y cuáles perdieron fuerza. Distinguir aumento de cobertura de aumento real de casos comparables: conectar una fuente histórica no demuestra que un problema haya crecido esta semana.

Un control de “útil / mal clasificado / duplicado / segmento incorrecto” crea un conjunto de ejemplos para evaluar el motor. Inicialmente las correcciones ajustan decisiones revisables y reglas versionadas. No prometer entrenamiento automático con cada clic.

Después, probar agrupación multilingüe con un modelo pequeño de embeddings, ejecutado en CPU y fuera de las peticiones del dashboard. Transformers.js admite ejecución en Node. Esto evita una API generativa por consulta, pero consume tiempo de cómputo y memoria; el modelo concreto, su licencia y el presupuesto se medirán antes de habilitarlo.

### Futuro como escenarios

Cruzar anuncios oficiales, productos, YC RFS, cambios tecnológicos y problemas actuales para proponer escenarios a 6/12/24 meses. Cada escenario incluye fuente, fecha, supuestos, señales para confirmar/refutar y relación con una necesidad actual. “Una empresa anunció algo” no equivale a “los clientes lo necesitan” ni asegura que ocurrirá.

## Primera entrega recomendada

Unidad de trabajo propuesta para aprobar antes de implementación:

1. Contrato común de evidencia, identidad por fuente y extracción contextual; conservar compatibilidad con el archivo existente.
2. Conectores incrementales y acotados de CFPB y GitHub público, más importación validada de CSV oficiales de PROFECO. Estadísticas mexicanas claramente identificadas como contexto histórico.
3. Ficha de problema y filtros por mercado sustentado, idioma y tipo de evidencia; mantener empresas y consumidores sin privilegiar un nicho.
4. Evaluación humana y reporte semanal basado en evidencia, con comparación temporal y paso directo a Entrevistas.

La entrega no depende de obtener permisos de Reddit/Product Hunt, ni de embeddings, ni de una API de pago. Brasil, Stack Exchange, reseñas licenciadas, datos empresariales globales y escenarios avanzados siguen en la siguiente ampliación.

## Arquitectura y costo

Conectores independientes, normalización y evidencia persistente, evaluación/agrupación, reportes y UI. Mantener PostgreSQL, backups cifrados y cron existentes. Las ampliaciones de esquema serán aditivas y compatibles con respaldos/versiones existentes.

Cada fuente tiene cursor, presupuesto de solicitudes y bytes, deduplicación, frecuencia acorde a publicación y estado visible. Respetar `Retry-After`, cuotas y resultados incompletos. Conservar la captura anterior si falla una fuente. Un endpoint accesible que devuelve cero elementos no demuestra cobertura correcta.

Descargar lotes pequeños, no todas las bases públicas. Antes de activar importaciones nuevas, medir tamaño, tiempo y costos compartidos de Vercel, Neon y GitHub. Si el cupo se acerca al límite, avisar y suspender únicamente esa ampliación; no subir de plan ni borrar el archivo silenciosamente.

No se compran APIs, licencias o planes. El costo de API generativa sigue en cero en la ruta principal. No se promete infraestructura ilimitada y gratuita para cantidades arbitrarias de datos.

## Cómo comprobar si mejoró

- Evaluación antes/después con ejemplos reales y negativos difíciles; objetivo inicial de precisión de al menos 85% en una muestra revisada de 100 candidatos. Es una meta de aceptación, no un resultado ya conseguido.
- Medir cuántas señales relevantes se omiten, no solo cuántas se aceptan. Incluir casos de inglés/español y, al añadir Brasil, portugués.
- Un artículo repetido en medios no aumenta casos independientes. Una estadística de 10,000 quejas no se convierte en 10,000 autores identificados.
- Una captura histórica incorporada hoy conserva su fecha original y no genera una tendencia falsa.
- Una queja, su contradicción y una entrevista permanecen vinculadas después de editar la hipótesis.
- País y segmento desconocidos siguen desconocidos. Verificar ejemplos transfronterizos.
- Recuperar y restaurar respaldos que incluyan los nuevos datos, probar filtros y ficha en teléfono, y confirmar que un fallo de conector no interrumpe el resto.
- El éxito de producto es obtener problemas y próximos pasos investigables; no alcanzar una cuota artificial de ideas.

## Fuentes consultadas

1. [PROFECO: quejas en materia de servicios](https://www.datos.gob.mx/dataset/quejas_materia_servicios).
2. [PROFECO: quejas de telecomunicaciones, recurso con licencia y frecuencia](https://www.datos.gob.mx/dataset/quejas_materia_telecomunicaciones/resource/fd854822-65a6-47d1-86f9-5b406b72dd6d).
3. [CONDUSEF: índice de reclamaciones](https://www.datos.gob.mx/dataset/anuario_actividades_condusef_indice_reclamaciones).
4. [CONDUSEF: estadísticas del Buró de Entidades Financieras](https://www.datos.gob.mx/dataset/educacion_financiera_comportamiento_general/resource/79b6340e-e8b1-4103-909b-ebdff86f2b96).
5. [REUNE: documentación de envío de informes](https://api-reune-docs.condusef.gob.mx/r_if.php).
6. [CFPB: Consumer Complaint Database y acceso API](https://www.consumerfinance.gov/data-research/consumer-complaints/).
7. [GitHub: búsqueda y sus límites](https://docs.github.com/en/rest/search/search).
8. [Stack Exchange: cuotas y backoff](https://api.stackexchange.com/docs/throttle).
9. [Consumidor.gov.br: datos abiertos y relatos](https://consumidor.gov.br/pages/conteudo/publico/62).
10. [Ministerio de Justicia de Brasil: catálogo de CSV](https://dados.mj.gov.br/dataset/reclamacoes-do-consumidor-gov-br).
11. [World Bank Enterprise Surveys: indicadores y microdatos](https://www.enterprisesurveys.org/en/data).
12. [INEGI: API DENUE](https://www.inegi.org.mx/servicios/api-denue/).
13. [Product Hunt: condiciones de la API](https://www.producthunt.com/v2/docs).
14. [Reddit: Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/16471395473812-Responsible-Builder-Policy).
15. [Trustpilot: Business Units API](https://developers.trustpilot.com/business-units-api).
16. [Apple: Customer Reviews de apps de la cuenta](https://developer.apple.com/documentation/appstoreconnectapi/customer-reviews).
17. [Google Business Profile: datos de reseñas](https://developers.google.com/my-business/content/review-data).
18. [Transformers.js: ejecución en Node](https://huggingface.co/docs/transformers.js/en/tutorials/node).
19. [YC Requests for Startups](https://www.ycombinator.com/rfs).

## Revisión de alcance

En la investigación inicial se comprobó consistencia entre datos individuales y agregados, acceso documentado y acceso probado, fecha de publicación y captura, evidencia extranjera y mercado local, inferencia y hecho. Tras la aprobación del usuario se implementó y publicó la primera etapa; los resultados de producción y recuperación de respaldo están en el plan de implementación. Las ampliaciones posteriores de esta propuesta permanecen pendientes.
