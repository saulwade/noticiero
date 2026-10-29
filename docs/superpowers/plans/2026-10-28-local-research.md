# Motor local de investigación y reporte nocturno

Solicitud: reducir el costo externo a cero, detectar problemas y búsquedas de soluciones en comunidades, conservar notas acumulativas y producir un reporte nocturno. Hacker News/Ask HN confirmado por el usuario.

## Diseño

El modo predeterminado será local y no hará llamadas a modelos de pago, aunque existan claves antiguas. TF-IDF aprenderá las frecuencias de términos del corpus y permitirá agrupar señales por similitud; reglas auditables reconocerán quejas, solicitudes, costos y soluciones manuales. No se presentará como un LLM ni como una investigación exhaustiva de mercado.

Fuentes: noticias existentes, Ask HN, Show HN, respuestas públicas limitadas de esos hilos, blog de Y Combinator y Requests for Startups. Se conservarán texto exacto, enlace, autor público cuando exista, fecha y origen. Los comentarios se separan del feed de noticias y las propuestas de YC se distinguen de las quejas de usuarios.

El cuaderno agrupará observaciones, conservará historial por día y permitirá anotaciones personales. Al menos dos autores/orígenes independientes con solicitudes o fricción darán pie a una oportunidad; una mención aislada quedará como señal. Las notas y reportes no se borrarán al actualizar.

El reporte de cada día incluirá documentos procesados, señales nuevas, temas, evidencia, hipótesis y límites de cobertura. Se actualizará por la noche a partir de las 20:00 CDMX y podrá exportarse como Markdown. Si no hay evidencia suficiente lo dirá expresamente.

La actualización en segundo plano se ejecutará en el propio Mac con Node/launchd, sin turnos de un agente ni APIs pagadas. Requiere sesión iniciada y equipo disponible; tras suspensión se recupera la última jornada pendiente. Se preparará un servicio local reversible y se comprobará su ejecución.

## Secuencia

1. Corregir la composición de fotografías: quitar float y usar imágenes anchas sin huecos sobre el titular.
2. Añadir modelo TF-IDF persistente, extracción de señales, agrupación y pruebas con casos positivos/negativos y reejecuciones.
3. Conectar Ask HN/Show HN y YC con límites de peticiones y atribución exacta.
4. Integrar análisis local en los jobs; permitir API externa solo con selección explícita.
5. Añadir cuaderno, reportes por fecha, exportación y notas personales persistentes.
6. Configurar actualización local periódica y reporte nocturno; documentar cómo detenerla.
7. Verificar tipos, lint, pruebas, imágenes y navegación móvil; compilar y comprobar con fuentes reales.

## Límites

- El sistema detecta patrones lingüísticos y similitud; puede omitir señales o agruparlas incorrectamente.
- Dos autores públicos no equivalen a dos clientes verificados ni prueban disposición a pagar.
- Los textos originales permanecen en su idioma; el análisis y las plantillas se redactan en español.
- Costo de APIs del modo local: cero. El equipo consume electricidad, conexión y almacenamiento.
- Las fuentes con acceso restringido no se conectan sin sus accesos correspondientes.

## Verificación final · 28 de octubre de 2026

Implementado: imágenes anchas sin float, Ask/Show HN y comentarios con autor, YC blog y RFS, motor local con corpus persistente, cuaderno con anotaciones, reportes nocturnos y exportación, servicios locales instalados y reversibles.

Verificación: 53 pruebas unitarias/integración y 14 E2E en escritorio/móvil; lint, TypeScript y compilación de producción aprobados. Se eligió Webpack por un fallo de permisos de puerto interno de Turbopack en este entorno. Las nueve fuentes respondieron en una recopilación real; primer reporte nocturno guardado y descarga Markdown comprobada.

Se verificaron y corrigieron atribución de respuestas a sus propios autores, recomendaciones positivas confundidas con solicitudes, duplicación de corpus, hipótesis históricas con comentarios editados después del corte, recuperación de reportes provisionales y exclusión de oportunidades sustentadas por señales rechazadas. Las notas crudas se conservan para auditoría; la vista usa el clasificador actual.

Servicios: local.noticiero.server y local.noticiero.update en la sesión macOS del usuario, servidor limitado a 127.0.0.1:3001, actualización cada hora y ANALYSIS_MODE=local forzado. Desactivar con npm run schedule:uninstall. Requiere equipo disponible y sesión iniciada.
