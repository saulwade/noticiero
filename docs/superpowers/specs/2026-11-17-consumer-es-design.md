# Consumer apps para hispanohablantes: investigación automática

Solicitud de Saúl: ampliar Noticiero para encontrar ideas de consumer apps globales dirigidas a personas que hablan español. Se mantienen el portafolio, la investigación anterior, la UI limpia y el costo cerca de cero. La instrucción autoriza implementar las decisiones rutinarias; no se repite una aprobación del mismo alcance.

## Diseño seleccionado

Sumar reseñas públicas en español y un resumen separado de investigación consumer a las ediciones existentes. Reutilizar sólo las tablas de evidencia, memoria y reportes, con campos JSON opcionales. Las otras opciones —sólo reclasificar noticias o contratar un proveedor de datos de apps— aportan menos experiencia directa o agregan costo. No se crean navegación, formularios, jobs, APIs pagadas, cuentas ni scraping de redes.

Fuente inicial: feed público de reseñas de Apple, comprobado con respuesta JSON real y catálogo de seis IDs validado por lookup de Apple. Apps: Duolingo, Busuu, Splitwise, Todoist, Bring y Moovit. Tiendas ES/MX/AR/CO/CL/PE/US rotan por tres combinaciones por edición; máximo 50 entradas leídas y 20 reseñas conservadas por feed, 1 MiB/12 s, pausa de seis horas y backoff ante 429/fallos. Se consulta la primera página; no es un censo ni una API con SLA. No se infieren descargas, usuarios activos ni cuota de mercado de estrellas/reseñas. No se activa Google Play, Reddit o X con acceso no autorizado.

Se exige detección conservadora de español en el texto, no en la tienda. El país individual permanece desconocido. Se conserva sólo extracto acotado, sin correo/teléfonos/contactos; una clave hash de cuenta pública cuando Apple aporta URI, sin nombre/URI de autor persistidos. App y review ID deduplican entre tiendas; cambios son revisiones. `updated` del feed se declara source_updated y nunca demuestra publicación original o demanda nueva de esa semana. Se conservan también reseñas positivas para no fingir que toda la muestra tiene problemas.

Clasificador consumer aditivo: obstáculo explícito + tarea/causa concreta, con dominios de aprendizaje, gastos compartidos, organización, listas de compras y movilidad. Falla genérica, una estrella o publicidad no producen una idea. Se separan ejercicios mal corregidos, límites de aprendizaje, cobros/cancelación, sincronización, recordatorios, monedas/saldos y horarios; compartir marca o palabras no basta. La agrupación transversal se hace por tarea/causa y dominio, conservando productos/alternativas.

El resumen consumer en español usa los reportes diarios y exportación privada existentes: cobertura, palabras clave, casos/cuentas, contraste positivo, causas, alternativas, fecha de actualización, capturas de siete días y lagunas. No requiere México para priorizar. Reserva parte del cupo de nuevas hipótesis automáticas a consumer, manteniendo las cuatro ideas y sus decisiones. Todas las observaciones y evaluaciones permanecen en los respaldos actuales. No se reescriben reportes cerrados ni se afirma entrenamiento de modelos, personas verificadas, validación comercial o intención de pago.

## Verificación y publicación

Casos sintéticos y muestras reales: español/inglés/ambiguo, promociones, positivos, causas diferentes, resolución/negación, privacidad, revisión/cross-store, fechas actualizadas, red limitada/429/vacíos, cursor/fallo parcial y presupuesto. Regresión de la muestra congelada y pruebas existentes, tipos/lint/build; sin cambios visuales nuevos. Captura cifrada previa en Neon, activación sólo de reseñas/investigación/memoria y comparación posterior de IDs, reportes cerrados y finanzas. Publicación al proyecto Vercel existente y comprobación del monitor y respaldo; sin alterar la rama local del lector VETA ni su archivo.
