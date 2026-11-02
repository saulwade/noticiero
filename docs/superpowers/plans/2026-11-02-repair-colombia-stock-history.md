# Reparación de datos Colombia e histórico empresarial

El usuario pide reparación real, persistencia y después un informe de oportunidades, sin pagar ni borrar nada. Se mantienen modelos, cartera y límites gratuitos.

Diagnóstico comprobado: metadatos de Colombia responden en 1.3 s; consulta de dos años agrupados agotaba 12 s. Último periodo publicado: septiembre de 2026; agrupación de ese mes responde en 0.8 s con 20 grupos. Alpha devuelve 1409 barras para ETN, incluida 2026-11-02 ya cerrada; el parser compara indebidamente contra expectedUsClose (margen de publicación 20h NY), que aún señala viernes. La clave existente está configurada en producción; no se cambia.

- [x] Colombia: descubrir último periodo válido con consulta ligera; agrupar solo ese mes. Mantener 20 grupos/ciclo, 1 MiB, fechas/calendario, estadísticas sin autores y enfriamientos. Hasta 30 s por petición de Colombia; otros conectores conservan 12 s. No inventar actualidad diaria para una fuente mensual.
- [x] Histórico: separar última sesión realmente cerrada (16h/13h NY, festivos/DST) de sesión mínima exigible por publicación (20h). Histórico acepta cierres confirmados y rechaza futuro; precios diarios aceptan el rango confirmado sin relajar moneda/símbolo/ajuste. Versionar parser en metadatos de sincronización para reintentar una vez el error anterior tras corregirlo, sin borrar estado ni ignorar cuotas.
- [x] Pruebas reproducibles con datos reales públicos guardados en privado y fixtures mínimas: lunes antes/después del cierre, margen 20h, fines de semana/DST/cierre temprano, consulta mensual, dato malformado/429, errores sin pérdida. Suite completa, lint/tipos/build y revisión independiente.
- [ ] Publicar Vercel. Ejecutar reparación acotada de fuentes con servicios existentes, confirmar filas nuevas/capturas/último éxito y resolver avisos solo después de guardar datos válidos. Guardar copia cifrada/archivo, comprobar no desaparición de IDs y cero cambios de instrumentos/movimientos. Verificar una ejecución automática posterior y monitor.
- [ ] Volver a consultar señales y quejas; entregar al usuario oportunidades con evidencia y limitaciones, sin presentar una hipótesis como negocio validado.

Fuentes técnicas oficiales consultadas: Socrata LIMIT/GROUP (el límite se aplica después de agrupar), Alpha Vantage weekly adjusted, NYSE horarios/calendarios. Los diagnósticos y credenciales quedan fuera de Git.

Verificación previa a publicar: 405 pruebas en 42 archivos pasan; lint (excluyendo research/ ajeno a este cambio), tipos y build pasan. Revisión independiente sin bloqueos. Copia cifrada previa: 41 tablas, 2934 filas. Diagnóstico en vivo: dos páginas de 20 grupos de septiembre; Alpha entrega 1409 barras y el parser corregido conserva 260. Falta confirmar persistencia y recuperación automática después de publicar.
