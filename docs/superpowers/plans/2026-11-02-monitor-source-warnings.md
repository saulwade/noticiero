# Corrección de correos repetidos por advertencias de fuentes

El monitor confirmó una fuente de evidencia externa con timeout (SFC Colombia), pero `notify-ops.mjs` devolvía exit 1 por cualquier finding. Como el script corre también al final de respaldo y finanzas, GitHub enviaba fallos generales aunque las etapas principales hubieran terminado.

Alcance autorizado por la solicitud de diagnóstico/corrección y el mantenimiento previo: conservar el aviso real, distinguir advertencias recuperables de fuentes de los fallos críticos y comprobar una ejecución real del monitor. No cambiar notificaciones de la cuenta, ocultar fuentes, borrar historial, recalcular finanzas ni tocar sus workflows. No modificar `research/` no rastreado.

- [x] Dar severidad warning únicamente a errores de conectores no bloqueados; bloqueos de capacidad/cuota y hallazgos desconocidos siguen critical por defecto. Exponerla en respuesta autenticada del monitor.
- [x] Clasificar avisos en el cliente: warning mantiene incidencia y anotación de Actions sin exit 1; critical, respuesta inválida, fallo de transporte, fallo de aviso/respaldo y ensayo explícito siguen exit 1. Mensajes seguros específicos para fuentes conocidas, sin copiar texto de terceros.
- [ ] Pruebas de severidad, datos inválidos, respaldo fallido y no eliminación. Lint/tipos/build, revisión independiente, publicación Git/Vercel y monitor real; confirmar que la advertencia colombiana permanece visible y que respaldo/archivo/historial siguen intactos.

La fuente externa puede seguir sin responder. La corrección del correo no se presenta como reparación de su API.

## Evidencia de diagnóstico

Run 41447618071 (monitor) falló únicamente al registrar un aviso; run financiero 41423482313 tiene cálculo privado exitoso y fallo posterior en notify-ops. Fuente sfc-co sigue con timeout de 12 s; actualización de noticias de hoy completada a las 07:17 CDMX, 610 observaciones y 676 versiones de evidencia conservadas al corte. Issue #2 existente, no cerrado ni ocultado. Respaldo y archivo completados la noche anterior.

397 pruebas de aplicación aprobadas; pruebas de ejecución del notifier aíslan todas las peticiones con fetch simulado y credenciales ficticias. Revisión independiente sin bloqueos. Lint se ejecuta excluyendo únicamente `research/**` local no rastreado: allí hay una .venv de terceros con errores previos de matplotlib; no se edita ni se publica ese directorio. El cierre de publicación y monitor real se registra en `.data/private/2026-11-02-monitor-notifications-release.md`.
