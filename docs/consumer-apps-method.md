# Consumer apps para hispanohablantes globales

Se amplía la investigación automática, conservando las líneas empresariales y las cuatro ideas revisadas. Las ediciones de noticias existentes consultan una muestra de reseñas, conservan evidencia versionada y actualizan memoria y reportes; no hay pantallas o formularios nuevos.

## Qué recopila

Fuente inicial: el feed público de reseñas de Apple App Store, comprobado el 17 de noviembre de 2026. El catálogo de IDs se contrastó con el lookup público de Apple: Duolingo/Busuu (idiomas), Splitwise (gastos compartidos), Todoist (organización personal), Bring! (listas de compras) y Moovit (movilidad). Se rotan las tiendas ES, MX, AR, CO, CL, PE y US, hasta tres combinaciones por actualización. Con dos ediciones diarias sin errores, la primera vuelta de 42 combinaciones tarda aproximadamente siete días; fallos/reintentos pueden alargarla. No cubre todas las apps, países, sistemas operativos ni consumidores.

Cada respuesta tiene límite de 1 MiB/12 segundos. Sólo primera página, hasta 50 entradas leídas y 20 reseñas elegibles guardadas por feed, con ventana de 90 días de actualización. Se exigen señales léxicas conservadoras de español en el texto, sin deducirlo de la tienda. Frases cortas o mixtas pueden quedar fuera. Se conservan positivos y negativos; estrellas no determinan por sí solas si hay problema.

El país del autor permanece desconocido. Se conservan extractos acotados con correos/teléfonos/enlaces del cuerpo omitidos, producto, rating, IDs de caso, fechas y una clave hash del identificador público de autor cuando Apple la aporta. La minimización por reglas es conservadora y no garantiza anonimato absoluto; revisar antes de compartir fuera de Noticiero. No se guardan nombres ni URLs del perfil; no se visitan perfiles. Una clave pública no prueba una persona independiente o un comprador. IDs de app+reseña consolidan duplicados entre tiendas; las revisiones siguen siendo el mismo caso.

La fecha RSS disponible es `updated`, que puede ser una edición de una reseña antigua. Se identifica con `dateBasis=source_updated`. No cuenta como publicación original nueva en las comparaciones semanales ni como nueva demanda de esa fecha; la captura mide descubrimiento por Noticiero. Las fechas originales desconocidas siguen siendo desconocidas.

## Qué analiza y guarda

El clasificador consumer exige un obstáculo y una tarea concreta en la misma oración. Separa, entre otros, ejercicios mal corregidos, bloqueos en evaluaciones, pérdida de grabaciones de voz, energía/vidas, interrupciones publicitarias, cargos duplicados, cancelación de suscripciones, listas compartidas, moneda/saldos, recordatorios y horarios de transporte. Un fallo genérico, un precio sin contexto, publicidad o una estrella no producen una hipótesis.

La agrupación consumer usa tarea, mecanismo observado y dominio de uso, conservando las alternativas mencionadas. No demuestra una causa técnica ni suma quejas distintas sólo por la marca. Se respetan revisiones humanas, negaciones y resoluciones declaradas. Parte del cupo de hasta cinco hipótesis automáticas nuevas por edición se reserva a consumer (hasta dos antes de las otras; se comparte el espacio libre). No se sobrescriben definiciones, decisiones, vínculos ni evaluaciones anteriores.

Los reportes diarios nuevos y `/api/research/brief?days=7` incorporan la sección «Consumer apps · hispanohablantes globales»: muestra/positivos, problemas concretos, alternativas, cuentas, palabras por documentos y capturas, resoluciones y preguntas pendientes. La memoria conserva las hipótesis y su evolución. Los reportes cerrados anteriores no se reescriben. Todo entra en las tablas JSON y respaldos cifrados existentes, sin agregar tablas o cambiar finanzas.

La selección consumer no exige evidencia mexicana ni da prioridad a una tienda por idioma. Siempre falta comprobar el segmento accesible, si soporte/configuración/una actualización de la app resuelve el caso, una alternativa mejor, el costo de servir y disposición real a pagar. La existencia de quejas sobre una app no valida lanzar otra.

## Costos y límites

Sin API generativa, servicios contratados, suscripciones, cuentas o jobs nuevos. Se reutilizan horarios, Neon y Vercel existentes; almacenamiento/compute siguen consumiendo sus márgenes y se conservan las alertas. Entre consultas hay al menos seis horas. Los fallos parciales conservan éxitos; una plaza de reintento evita abandonar fuentes fallidas. 429 y Retry-After generan una pausa acotada; el cursor avanza sin borrar el historial. Vacíos, errores y cobertura parcial se explican en el estado de fuente.

No se estiman descargas, usuarios activos, cuota, ingresos ni tendencias de instalaciones a partir de reseñas o ratings. El RSS no tiene un SLA público garantizado; Apple puede cambiarlo o devolver una muestra incompleta/vacía. No se evade autenticación ni se activa acceso a Reddit/X/Google Play sin permisos. La disponibilidad de un feed no concede licencia para republicar artículos, imágenes o reseñas completas. La investigación permanece en el acceso privado.

Referencias: [Apple Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/), [parámetros y límites del catálogo](https://performance-partners.apple.com/search-api), [ejemplo público de reseñas usado en la comprobación](https://itunes.apple.com/es/rss/customerreviews/page=1/id=570060128/sortby=mostrecent/json). Search/lookup y customerreviews son recorridos distintos; el límite aproximado de Search API no se presenta como SLA del feed de reseñas.
