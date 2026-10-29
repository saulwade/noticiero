# Investigación acumulativa, operaciones y entrevistas

Solicitud aprobada: respaldos automáticos, avisos en la app y GitHub, entrevistas, noticias financieras y acumulación de investigación sin abrir el navegador. Se mantiene el análisis local y la interfaz editorial blanca existente.

## Investigación y cobertura

Cada actualización persiste todas las señales y notas aceptadas y todas las hipótesis elegibles. Las revisiones de oportunidades se archivan como eventos inmutables con fecha y evidencia, independientes de favoritos. El archivo permite ver uno, tres, siete o treinta días, y exportar un paquete Markdown para conversar sobre patrones. Los cierres diarios conservan la evidencia disponible en su fecha. Finanzas y Operaciones son categorías nuevas; se añaden feeds públicos verificados. Noticias regulatorias/editoriales aportan contexto, sin convertirlas en quejas de clientes. Las categorías se filtran tanto al recopilar como al leer/reportar.

## Entrevistas

Una vista Validación reúne proyectos (segmento, problema, hipótesis, criterio de éxito, fuentes y estado) y entrevistas (alias, rol, fecha, solución actual, frecuencia, costo/consecuencia, cita, notas y siguiente paso). Una oportunidad puede abrir un proyecto con evidencia vinculada. Los formularios guardan explícitamente y muestran errores; no se envían mensajes ni se graba audio. Se puede archivar un proyecto sin borrar evidencia.

## Respaldos

GitHub Actions se ejecuta en un repositorio privado de operaciones, independiente de la laptop. Un rol PostgreSQL de solo lectura obtiene una transacción consistente de todas las tablas de contenido, incluyendo entrevistas, notas y favoritos; excluye leases y credenciales de entorno. Un archivo JSON versionado se comprime y cifra con AES-256-GCM antes de subirlo como artefacto privado con retención de siete días. El tamaño y la fecha se registran en la app. La clave de recuperación se guarda fuera del repositorio y en GitHub Secrets. Un comando de restauración comprueba autenticidad, formato y recuentos, y rechaza destinos con datos existentes. Se prueba restaurando en PGlite temporal, nunca sobre la base viva.

## Avisos

Se registran alertas deduplicadas de fallos/parcialidad, falta de actualización y falta/fallo de respaldo, con resolución al recuperarse. Un workflow independiente revisa salud tras las ventanas de mañana y noche, usando un secreto limitado al endpoint de salud. Si la app no responde también avisa. GitHub mantiene una incidencia privada asignada al propietario, actualizada sin duplicados y cerrada al recuperarse. El usuario eligió expresamente avisos en GitHub y dentro de la app; su correo depende de las preferencias de notificaciones de GitHub.

## Coste y seguridad

Sin nuevos servicios de pago, sin API generativa y sin activar upgrades. Actions y artefactos usan los cupos gratuitos compartidos de la cuenta; se verifica disponibilidad antes de activar. Secretos diferentes para comprobación de salud y recepción de estado de respaldos. No se imprimen credenciales ni notas privadas en logs/incidencias. No se abre una segunda instancia de la base local en uso. Las rutas de usuario exigen acceso y mismo origen; los endpoints operativos exigen sus secretos.

## Verificación

Pruebas de archivo automático/idempotencia/revisiones, filtros de fuentes, proyectos/entrevistas y acceso; fallos y recuperación de alertas; cifrado, manipulación y restauración con recuentos. E2E de escritorio/móvil para archivo y entrevistas, lint, TypeScript y build. Ensayo real de respaldo y watchdog en Actions, restauración independiente del artefacto, despliegue y comprobación del dominio principal.
