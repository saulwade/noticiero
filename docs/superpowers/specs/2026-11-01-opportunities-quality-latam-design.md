# Oportunidades: evidencia propia, problemas concretos y mercados regionales

El usuario aprobó corregir filtros/agrupaciones, incorporar México y Latinoamérica, probar y publicar en Vercel, sin modificar el portafolio. Esta autorización continúa el diseño de tres mejoras presentado en la auditoría; no requiere otra ronda de permisos.

## Diseño aprobado y alcance

Se conserva el motor local y el archivo existente. La interpretación actual se vuelve más estricta, manteniendo las citas/versiones originales. Una respuesta que cita una queja no es otra experiencia; comentarios genéricos sobre IA, código y formularios vacíos tampoco prueban un problema operativo. La clasificación compartida limpia citas Markdown/HTML, código y plantillas antes de extraer necesidades. Las agrupaciones usan tarea, producto y segmento explícito; contexto desconocido permanece desconocido. La similitud de palabras no une mercados o compradores diferentes.

Se prefieren conectores oficiales acotados, con esquema validado, fecha original, procedencia y límites visibles. PROFECO se consulta mediante el datastore público documentado de datos.gob.mx; no se descarga el CSV de 250 MB ni se usa la API antigua que devuelve 404. Colombia se consulta mediante el conjunto oficial xyy7-rn7p de datos.gov.co: son cantidades mensuales agregadas de reclamaciones, no personas ni testimonios. Se conserva la distinción entre reclamación individual y estadística contextual. Fechas futuras/incorrectas no se corrigen inventando otra fecha. País significa cobertura documentada por la fuente; nunca se infiere del idioma.

Frente a embeddings/LLM de pago o scraping masivo, esta opción mantiene trazabilidad y presupuesto existentes. Los conectores se ejecutan como parte del ciclo automático existente, con límites de filas/bytes/tiempo, reintento espaciado, y estado de error sin pérdida del archivo. Sin suscripciones, llaves nuevas, tablas nuevas, datos personales de denunciantes ni contacto con personas.

## Uso y calidad

Oportunidades tendrá un resumen breve de problemas por investigar con tarea, evidencia, región, lagunas y siguiente comprobación. Los detalles permanecen dentro del espacio actual. No añade navegación principal ni formularios obligatorios. Un cuaderno puede perder la condición de recurrente al corregirse una clasificación; eso no elimina las fuentes originales ni anotaciones. Los cierres históricos permanecen congelados y la vista actual explica que usa criterios vigentes.

La salida para conversar sobre negocios distinguirá evidencia de dolor, cliente desconocido, solución actual, consecuencia y experimento. No calificará un negocio como validado por repetir palabras o acumular dos cuentas. Los datos administrativos antiguos se mostrarán como antecedentes, no demanda nueva del día.

## Criterios de aceptación

Reproducir y rechazar los falsos positivos observados en producción; conservar solicitudes auténticas en español/inglés y soluciones manuales con contexto. Separar tareas/segmentos y reconstruir los cuadernos actuales sin borrar filas históricas. Verificar idempotencia, fechas, nuevas fuentes, límites, almacenamiento, informes y exportación. Revisar fuentes reales y ciclo publicado, respaldo y recuperación aislada. Pruebas app/Python existentes y E2E pertinentes, lint/tipos/build; comprobación de que no hay cambios en archivos de finanzas/portafolio.
