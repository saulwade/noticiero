# Guardados duraderos y revisión de despliegue

Objetivo: que los guardados sigan accesibles aunque cambien los datos de origen o los filtros de investigación, y comprobar las condiciones para publicar el dashboard con almacenamiento persistente.

Diseño: cada nuevo guardado conservará una copia del contenido ya disponible en el servidor, sin confiar en contenido enviado por el navegador. Guardados mostrará esa copia; los marcadores anteriores capturan su contenido desde las filas originales antes de aplicar filtros de evidencia. La actualización de esa copia es atómica y conserva notas y fechas. Las notas personales seguirán separadas del contenido generado. No hay caducidad automática. Las imágenes y artículos externos siguen dependiendo de sus editores.

- [x] Añadir copias de noticias e ideas en SavedItem y capturarlas al guardar o anotar, conservando la primera copia.
- [x] Mostrar las copias en Guardados, independientemente del filtro actual de oportunidades y sin el límite de 60 del feed.
- [x] Probar reejecución, cambio y rechazo de evidencia, conservación de notas y navegación móvil.
- [x] Revisar cuenta Vercel, almacenamiento PostgreSQL externo y horarios compatibles con el plan gratuito.
- [x] Completar las credenciales del acceso privado de GitHub y publicar la versión de producción.

Almacenamiento actual: PostgreSQL integrado en .data/postgres, servido por una sola instancia local. No abrir esa carpeta desde otro proceso mientras el servicio esté activo. Una publicación necesita migrar los datos a PostgreSQL externo y conservar un respaldo; subir código no migra datos.

## Estado de publicación

Proyecto Vercel creado y vinculado: saul-wades-projects/noticiero. Neon Free provisionado (free_v3), región iad1, conexión configurada solo en Production y Preview. Tras aceptación de términos y autorización explícita del usuario, se migró el respaldo completo y se verificaron los recuentos de todas las tablas. No se transfirieron leases activos. El respaldo .data/backups/noticiero-20261029T060426Z.tgz se restauró en una carpeta temporal independiente para comprobar su lectura.

Guardados: 57 pruebas unitarias/integración y 14 E2E de escritorio/móvil aprobadas; lint y compilación con comprobación TypeScript aprobados. La regresión de marcadores antiguos se comprobó fallando antes del arreglo y pasando después. Se corrigió un problema del lockfile de dependencias opcionales WASM detectado por npm ci en Linux. Vercel confirmó la versión de producción como Ready.

Producción: https://noticiero-self.vercel.app, repositorio https://github.com/saulwade/noticiero conectado con la rama main. Credenciales OAuth configuradas como sensibles en Production y Preview. El usuario autorizó el acceso de lectura de perfil y correos y se comprobó el inicio de sesión real. Una actualización alojada terminó con las nueve fuentes en estado correcto y nueve noticias añadidas. Se comprobó un guardado en Neon, su persistencia tras recargar y su visualización en el archivo; después se retiró el marcador de prueba. Las dos tareas cron están activas, a las 13:00 y 02:00 UTC (07:00 y 20:00 CDMX, con precisión de una hora en Hobby). El análisis permanece en modo local, sin llamadas a proveedores de IA de pago.

Se verificó el despliegue automático tras un push a main. La prueba desde otro navegador detectó que el alias con el nombre del equipo requiere también sesión de Vercel. Se eligió el dominio principal noticiero-self.vercel.app y se ajustaron Homepage URL y Redirect URI de la OAuth App a ese dominio exacto. Se comprobó que una sesión anónima ve el login de Noticiero y que la cuenta autorizada completa GitHub y entra al dashboard en ese dominio.
