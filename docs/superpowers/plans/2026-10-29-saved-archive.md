# Guardados duraderos y revisión de despliegue

Objetivo: que los guardados sigan accesibles aunque cambien los datos de origen o los filtros de investigación, y comprobar las condiciones para publicar el dashboard con almacenamiento persistente.

Diseño: cada nuevo guardado conservará una copia del contenido ya disponible en el servidor, sin confiar en contenido enviado por el navegador. Guardados mostrará esa copia; los marcadores anteriores capturan su contenido desde las filas originales antes de aplicar filtros de evidencia. La actualización de esa copia es atómica y conserva notas y fechas. Las notas personales seguirán separadas del contenido generado. No hay caducidad automática. Las imágenes y artículos externos siguen dependiendo de sus editores.

- [x] Añadir copias de noticias e ideas en SavedItem y capturarlas al guardar o anotar, conservando la primera copia.
- [x] Mostrar las copias en Guardados, independientemente del filtro actual de oportunidades y sin el límite de 60 del feed.
- [x] Probar reejecución, cambio y rechazo de evidencia, conservación de notas y navegación móvil.
- [x] Revisar cuenta Vercel, almacenamiento PostgreSQL externo y horarios compatibles con el plan gratuito.
- [ ] Completar las credenciales del acceso privado de GitHub y publicar la versión de producción.

Almacenamiento actual: PostgreSQL integrado en .data/postgres, servido por una sola instancia local. No abrir esa carpeta desde otro proceso mientras el servicio esté activo. Una publicación necesita migrar los datos a PostgreSQL externo y conservar un respaldo; subir código no migra datos.

## Estado de publicación

Proyecto Vercel creado y vinculado: saul-wades-projects/noticiero. Neon Free provisionado (free_v3), región iad1, conexión configurada solo en Production y Preview. Tras aceptación de términos y autorización explícita del usuario, se migró el respaldo completo y se verificaron los recuentos de todas las tablas. No se transfirieron leases activos. El respaldo .data/backups/noticiero-20261029T060426Z.tgz se restauró en una carpeta temporal independiente para comprobar su lectura.

Guardados: 57 pruebas unitarias/integración aprobadas; lint y compilación con comprobación TypeScript aprobados. La regresión de marcadores antiguos se comprobó fallando antes del arreglo y pasando después. La suite E2E de escritorio/móvil contiene 14 pruebas. Se corrigió un problema del lockfile de dependencias opcionales WASM detectado por npm ci en Linux. Vercel confirmó la vista previa como Ready.

Pendiente de publicación completa: registrar la OAuth App de GitHub y guardar AUTH_GITHUB_ID y AUTH_GITHUB_SECRET para el acceso privado. Hasta entonces el entorno alojado exige autenticación y no muestra datos.
