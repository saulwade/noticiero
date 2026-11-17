# Memoria automática de ideas y calidad de evidencia

Saúl aprobó implementar la propuesta de memoria, independencia, vigencia, competencia, consecuencias/comprador y reporte semanal, sin borrados, sin tocar portafolio ni activar cobros. Se reutiliza el checkout existente, dejando `research/` y la investigación privada fuera de Git/despliegues.

## Diseño elegido

Persistir definiciones de ideas, decisiones atribuidas, vínculos de evidencia, comprobaciones públicas y evaluaciones versionadas en tablas nuevas. Reutilizar las dos ediciones existentes para evaluar después de recopilar evidencia. Reportar en la exportación privada y el estado existente, sin otra pantalla ni formulario.

Alternativas descartadas: mantener sólo Markdown local no alimenta el análisis del servidor; pedir una API generativa añade costo y no prueba independencia. Un motor determinista conserva razones y límites verificables. No se presenta como entrenamiento autónomo ni validación comercial.

## Datos y criterios

- La definición y las decisiones se conservan sin sobrescribir. Importar las cuatro hipótesis y conclusiones documentadas mediante un archivo privado validado; futuras pistas específicas pueden registrarse automáticamente con referencia al grupo y sin sustituir las ideas originales.
- Evidencia enlazada por caso/revisión y versión de reglas, separando contexto, promoción, estadística, rechazo humano, caso histórico, cierre sin resolución y resolución comprobada. Contar cuentas públicas y casos anónimos aparte; nunca llamarlos organizaciones verificadas.
- Agrupar por mecanismo y alcance explícitos. Un tema amplio no suma mecanismos distintos como una necesidad. Publicación, captura y primera observación tienen fechas distintas; comparar ventanas de siete días y marcar revisiones sin contarlas como nuevos casos/autores.
- Extraer únicamente citas que sostengan frecuencia, consecuencia, tarea, solución actual y comprador potencial; separar hipótesis del segmento y voluntad de pago comprobada (siempre pendiente salvo decisión humana atribuida).
- Fuentes de competencia y vínculos cruzados se registran como oferta/contexto. Consultas públicas acotadas, sin claves ni inferencia de ventas. Controlar cambios de documentos conocidos; una página modificada exige revisión y no demuestra una nueva función. Refrescar estados de issues conocidos, reteniendo cada comprobación y sin modificar capturas previas; cerrado no equivale a corregido salvo estado explícito completed.
- Evaluaciones diarias append-only con razones, lagunas, fuentes cubiertas/pendientes y comparación de la muestra. Decisiones humanas restrictivas no se revocan automáticamente por volumen. No generar porcentajes de éxito ni convertir candidatos en negocios validados.

## Integración y protección

Nuevo módulo aislado de finanzas. `runLocalResearch` lo ejecuta antes de crear reportes nuevos. Incluir memoria en el briefing exportable, endpoint privado de lectura y reportes diarios futuros; no reescribir reportes cerrados. Sin nuevas tareas programadas, cuentas ni servicios pagos. Los fallos de fuentes preservan el último resultado y se declaran en el reporte.

Tablas nuevas incluidas en cifrado/restauración y permisos del rol de respaldo, manteniendo compatibilidad de snapshots históricos de 43 tablas. Corte cifrado previo y comparación por IDs/contenido tras activar. Límites de red y bytes explícitos; conservar cola pendiente y no eliminar evidencia por capacidad.

## Validación

Regresiones de independencia, versiones, promociones de autores, alias/URL, fechas futuras, problemas resueltos, evidencia antigua, costos y comprador sin inferencias; red simulada con 429, errores, cambios de contenido y allowlist. Persistencia idempotente, decisiones restrictivas, exportación/autorización, backup antiguo/nuevo y restauración. Suite existente, evaluación congelada, lint, tipos, build y E2E escritorio/móvil. Publicar y comprobar Ready; ejecutar sólo investigación para verificar persistencia y conservación, sin invocar finanzas.
