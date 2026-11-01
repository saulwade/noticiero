# Método local de investigación financiera · fase 2B

El motor `finance-news-v1` transforma noticias ya recopiladas en fichas para investigar. No consulta Internet, llama APIs de IA, descarga modelos, crea posiciones ni recomienda compras o ventas. Clasificar un texto no verifica su contenido ni estima la rentabilidad de una acción.

## Entradas y selección

Se usan el título original, hasta 3,000 caracteres de texto disponible, fecha de publicación, fuente, URL, categoría y relaciones explícitas guardadas por Noticiero. Se rechazan fechas inválidas/futuras, enlaces que no sean HTTPS públicos y enlaces con credenciales embebidas. Las imágenes conservan únicamente una URL pública; el motor no las descarga.

La selección favorece noticias financieras y empresariales concretas: resultados, regulación/litigios, seguridad/continuidad, financiación, adquisiciones, infraestructura, macroeconomía y productos/precios/contratos. Una empresa registrada no es requisito; por ejemplo, se admite una decisión macroeconómica oficial sin ticker conocido. Las noticias comunitarias marcadas como pregunta, comentario, proyecto o investigación editorial quedan fuera de este flujo; el Radar de problemas conserva sus criterios propios. Se filtran promociones y reseñas personales evidentes.

Las empresas se reconocen con el catálogo existente y contexto textual. No se inventan nombres, mercados o tickers para empresas desconocidas. Apple, Amazon y Meta tienen controles para evitar confundir fruta, geografía o metaanálisis con empresas. Estos controles preservan litigios, resultados e inversiones cuando hay contexto corporativo. El reconocimiento sigue siendo una heurística: puede omitir empresas y equivocarse con contextos ambiguos.

## Contenido y preguntas

El resumen selecciona oraciones completas del texto disponible con `extractiveDigest`; mantiene cifras, negaciones e idioma de origen. Si solo existe un titular, la ficha repite ese titular y señala que falta el contenido completo. No se reutiliza como evidencia una traducción o resumen generativo anterior.

Las preguntas y el posible mecanismo usan plantillas en español asociadas al tema: qué documento confirma el hecho, qué período y unidades corresponden, qué ingresos/costos/caja podrían estar expuestos y qué evidencia contradiría esa explicación. Son hipótesis condicionales. Una negociación no se convierte en adquisición consumada; una demanda no se convierte en sentencia; una mención no prueba que la noticia causó un movimiento de bolsa.

## Lenguaje textual

El diccionario bilingüe registra términos favorables y adversos del título y del texto. Suprime una señal cuando encuentra una negación en las cinco palabras anteriores de la misma cláusula. Los límites de oración y conjunciones adversativas reinician ese contexto; «not only» se trata como excepción. No se invierte una señal negada para inventar su contrario.

La salida es favorable, adversa, mixta o sin señal. Incluye los términos detectados y una advertencia visible. No es una probabilidad, una valoración de la empresa ni una señal de compra/venta. No entiende de forma fiable ironía, negación distante, atribución compleja, todos los idiomas o efectos financieros sectoriales. «Subir tasas», por ejemplo, no tiene una consecuencia universal. No se ha entrenado un modelo ni medido aquí precisión de predicción.

## Versiones y duplicados

La identidad incluye versión de reglas, historia de origen, hash y todos los metadatos de fuente conservados: título, texto, categoría, cobertura, publicación, fuente, imagen, empresas y relaciones. Una corrección de fecha o atribución produce una versión nueva aunque no cambie el hash original del feed. La hora de captura se excluye de la identidad: el servicio conserva la primera captura cuando vuelve a observar la misma evidencia.

La vista usa una unión transitiva de IDs explícitamente relacionados, URLs canónicas de artículos y titulares normalizados exactos de la misma fecha. No agrupa por similitud semántica ni por una referencia genérica como la portada o el índice EDGAR. Cada grupo muestra su captura más reciente; las versiones originales se conservan en el archivo. Este agrupamiento conservador evita algunos dobles conteos, pero no demuestra independencia de medios o fuentes.

## Informes diarios y cotizaciones

La fecha del informe usa America/Mexico_City y cuenta fichas **capturadas/preparadas** ese día. Una recuperación inicial puede incorporar artículos publicados antes; ambas fechas se conservan y la advertencia lo explica. El informe agrupa empresas, temas y preguntas después de deduplicar.

El contexto de mercado conserva hasta ocho cotizaciones públicas relevantes de Alpha Vantage en USD, con precio, variación, sesión, proveedor y fecha de consulta válidos. Rechaza empresas privadas, valores no finitos y datos futuros. Se captura lo que estaba disponible al preparar el informe, sin fingir que se conocía cuando se publicó cada noticia. Frecuencia de menciones y variación de la sesión no prueban causalidad ni atractivo de inversión.

## Verificación y límites de evaluación

La suite cubre más de veinte escenarios deterministas: cifras, negación, señal mixta, solo titular, promociones, noticias sin ticker, nombres ambiguos, empresas privadas, fechas/URLs inválidas, correcciones de metadatos, relaciones transitivas, referencias genéricas, contexto de mercado y frontera diaria CDMX. Son casos sintéticos de aceptación y regresión; no constituyen una estimación de precisión sobre noticias reales o una validación de inversión.

La publicación debe además comprobar el ciclo real, el archivo de fichas/informes y la restauración del respaldo. Antes de ampliar la interpretación automática hacen falta muestras reales anotadas independientemente, errores por idioma/sector y comparación con un criterio manual. Históricos de rendimiento total, modelos generativos en español, correlaciones y seguimiento simulado de varias semanas conservan su evaluación separada.


## Observaciones de reversión y recuperación del archivo

La identidad pura describe la evidencia retenida. El archivo añade `evidenceId` y `revision` para registrar nuevas observaciones cuando una fuente cambia A→B→A; conserva A y B anteriores y vuelve a mostrar la nueva observación de A. Releer A sin cambios no crea otra versión. Los informes y notas ya guardados mantienen sus IDs y copias originales.

Cada ciclo lee una muestra reciente y un lote de recuperación con cursor por ID. El cursor avanza y reinicia al completar el recorrido, para recuperar artículos elegibles antiguos aunque existan más de 5,000 publicaciones crudas. El archivo financiero conserva su límite explícito de versiones y avisa antes de ampliarlo.
