# Auditoría del archivo y aprendizaje acumulativo

Alcance solicitado: confirmar acumulación autónoma durante semanas y meses, revisar funcionamiento y corregir fallos sin servicios de pago adicionales.

## Verificación y correcciones

- [x] Consultar producción mediante el rol de solo lectura: 420 documentos, 284 registros de contexto, dos reportes, actualización de noche completada y un respaldo confirmado; sin alertas activas al consultar.
- [x] Revisar esquema, escrituras y eliminación: no hay TTL sobre noticias, contexto, señales, cuadernos, reportes o revisiones. El límite del modelo no elimina esos archivos.
- [x] Comprobar que una segunda voz dos meses después refuerza el mismo cuaderno y crea una hipótesis sin favoritos ni duplicados.
- [x] Corregir falsos positivos: `app\w*` confundía “applying/applies” con aplicaciones; contar ropa a mano y ofrecer una copia de un archivo no prueban demanda de software. Una recomendación de hojas de cálculo tampoco demuestra una necesidad propia.
- [x] Reconocer agotamiento explícito de cuotas/presupuesto como fricción, sin tratar un informe ordinario de presupuesto como queja.
- [x] Conservar la oración completa, acotada por el extractor a menos de 2,500 caracteres, para no quitar la expresión que justificó una señal al truncarla.
- [x] Preferir citas de solicitud/fricción al elegir un representante por autor: una solución manual posterior no debe ocultar una solicitud anterior.
- [x] Recuperar todos los cierres ausentes/provisionales de días con datos, no solo ayer; conservar cierres históricos completos y no fabricar días sin capturas.
- [x] Extraer evidencia de publicaciones comunitarias almacenadas fuera del corpus temporal, para no perder señales por límites de entrenamiento o mejoras del clasificador.
- [x] Verificar CNBC: responde con un RSS válido, pero su noticia más reciente es del 21 de octubre. El filtro de 72 horas explica el recuento cero; otras fuentes financieras sí aportan noticias.
- [x] Aclarar en README qué aprende el motor y qué no: frecuencias y agrupación incremental; sin reentrenamiento generativo, ajuste automático de reglas ni aprendizaje de entrevistas.
- [x] Completar pruebas y revisión independiente: 83 pruebas unitarias/integración, 18 pruebas de navegador escritorio/teléfono, lint y compilación con TypeScript correctos. Los cinco fallos principales se reprodujeron antes de corregirlos.

Los ocho registros de señales de la primera consulta eran filas crudas de auditoría; el dashboard revalida su clasificación. Las filas descartadas se conservan para trazabilidad. Los reportes históricos cerrados son snapshots de lo observado entonces.

La revisión señaló una consideración de compatibilidad: si existieran citas antiguas truncadas de más de 650 caracteres, la versión completa podría tener otra identidad y sumar actividad del mismo autor. Se comprobó la copia de producción: sus ocho citas son cortas, por lo que no existe ese caso en este despliegue. La independencia se cuenta por autor incluso ante varias citas.

## Límites constatados

Muestra acotada de fuentes y comentarios. No hay agrupación semántica con un modelo de lenguaje ni análisis de tendencias semanal/mensual independiente. Los cuadernos mantienen identidad incremental; no se fusionan solos. Los artículos completos y fotografías externas no se archivan como archivos. Las notas y entrevistas personales requieren Guardar. No se creó ninguna automatización adicional de este chat.
