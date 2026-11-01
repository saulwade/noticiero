# Investigación automática fuera del recorrido diario

El usuario corrigió el alcance: usa el briefing para leer y este chat para analizar negocios. No quiere una pantalla de trabajo de oportunidades, hipótesis, tareas, entrevistas o notas. La autorización previa de publicación se mantiene para esta simplificación.

**Diseño:** retirar Oportunidades de la navegación, el panel de ideas del briefing y su pestaña móvil. Desmontar los espacios de investigación/radar de la UI; no ocultarlos solo con CSS. Mantener API, conectores, extracción, cierres, base de datos, historial, respaldos y consultas privadas para el análisis en conversación. En Estado y respaldos mostrar únicamente la fecha del análisis guardado y que no exige acciones. Los favoritos antiguos conservan su contenido y notas como lectura, sin formularios de investigación. Portafolio y sus procesos quedan fuera de cambios.

- [x] Simplificar Dashboard y favoritos; no añadir otra pantalla o botón que sustituya Oportunidades.
- [x] Añadir confirmación discreta en el estado existente, sin generar reportes manualmente desde la UI.
- [x] Actualizar E2E para ausencia de formularios y accesos, y conservar pruebas de importación/revisión/exportación mediante API autenticada. Ejecutar suite de aplicación, lint/tipos/build y navegador escritorio/móvil.
- [ ] Revisión independiente, publicación por Git en Vercel, comprobación visual y de conservación de datos. El motor automático debe permanecer idéntico.

## Verificación previa a publicación

384 pruebas de aplicación aprobadas; build de producción y TypeScript correctos. Revisión independiente sin bloqueos: solo cambian tres componentes, sus pruebas y este plan. Ningún cambio en API, conectores, scripts, modelos, fuentes, base de datos ni portafolio. Pruebas E2E de escritorio y móvil comprueban navegación simplificada, archivo por API, autenticación y ausencia de formularios de investigación.

Consulta de producción de solo lectura previa: 561 observaciones, 15 señales históricas, 14 notas y 4 reportes diarios conservados; último ciclo completado sin errores. La publicación no ejecuta un nuevo ciclo ni altera esos datos. El cierre de publicación y comprobación visual se registra en el informe privado de operación.
