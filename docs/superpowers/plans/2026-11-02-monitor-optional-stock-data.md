# Alertas de cobertura parcial de investigación financiera

Los runs 41537019445 (finanzas, 16:24 CDMX) y 41543511252 (monitor, 17:11 CDMX) sí usan la corrección anterior. Ahora aparece un hallazgo distinto: `stock-history:ETN` falló en la fuente auxiliar. El cálculo financiero publicó un informe a las 16:26 y el respaldo/archivo de las 14:26 está confirmado. `finance-stock-evidence` no tenía severity y caía en critical. La corrección anterior cubría únicamente conectores de oportunidades.

Alcance: corregir clasificación y claridad de avisos de cobertura, sin modificar algoritmos, importes, instrumentos, movimientos, cuotas o resultados existentes. No borrar estados ni marcar como recuperada una fuente que aún falla. No tocar research/ no rastreado. Las fuentes pendientes seguirán visibles y sujetas al enfriamiento/cuota actual.

- [x] Tratar fallos de investigación auxiliar como warning; una preparación de fuente detenida mantiene critical. Precios de posiciones, FX, informe ausente, capacidad y cálculo fallido mantienen los controles actuales.
- [x] Mensaje externo específico y seguro para investigación de empresas; quitar el genérico que impedía distinguir causas. Pruebas de crítico simultáneo, fuente pendiente, tarea detenida, escritura de avisos y recuperación.
- [ ] Pruebas de app/tipos/lint/build, revisión independiente, publicación en Vercel y ejecución real de finanzas y monitor con el mismo código. Verificar etapas individuales, advertencias abiertas, respaldo/historial y ausencia de escrituras de movimientos.

El éxito del workflow confirma que terminó su trabajo principal y comunicó las limitaciones; no confirma que cada proveedor externo respondió. Los reintentos reales no deben borrar alertas artificialmente ni contratar capacidad.

## Verificación previa

29 pruebas focalizadas aprobadas. Lint del código aprobado excluyendo únicamente research/** no rastreado, que contiene la venv ajena a la app. Revisión independiente sin bloqueos. Sin cambios de proveedores, cuotas, enfriamientos, modelos ni movimientos. Cuota Alpha observada de solo lectura: 16/20 solicitudes internas del día UTC; la prueba real conserva el guard de cuota y no activa cobros. Ledger previo: cero instrumentos y cero movimientos. El cierre de publicación y las dos ejecuciones reales se documenta en `.data/private/2026-11-02-optional-stock-monitor-release.md`.
