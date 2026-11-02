# Capacidad y archivo histórico sin eliminación

**Objetivo aprobado:** ampliar el límite interno, avisar antes de agotarlo y conservar copias históricas comprimidas/cifradas, sin borrar ni mover datos, activar planes de pago ni modificar el portafolio.

**Diseño:** 50,000 versiones / 64 MB de evidencia. Medición SQL de la base principal y de evidencia; avisos al 70%/85% de cada límite y fallo explícito si la medición no está disponible. El margen de referencia de la base es 1 GB (Neon Free publicado el 1 de noviembre); no equivale al uso facturado de todas las ramas. Avisos existentes en app y GitHub, sin servicios nuevos.

Reutilizar el snapshot completo existente, gzip + AES-256-GCM y su clave privada. El mismo workflow diario añadirá una copia a Releases del repositorio privado `saulwade/noticiero-ops`, agrupada por mes. Nombre con fecha y SHA-256; creación/adición únicamente, sin DELETE, reemplazos, clobber, expiración programada ni limpieza. Verificar SHA-256 tras descargar el asset antes de registrar éxito. No usar Git LFS, paquetes ni retención de Actions para el archivo duradero. No cambiar facturación. Fallos del archivo tienen estado y aviso independientes del respaldo diario. Los respaldos históricos no se cargan al abrir el briefing; se recuperan mediante herramientas privadas y restauración aislada.

- [x] Crear capacidad centralizada y pruebas de umbrales, ampliación y no eliminación. Integrar medición y avisos en Estado y respaldos/monitor, con solo información y sin tareas nuevas.
- [x] Crear publicación verificable del archivo privado con reintentos idempotentes, validación de destino privado y descargas acotadas. Pruebas de subida, repetición, digest incorrecto, fallo de red, destino público y prohibición de borrado.
- [x] Registrar manifiesto del archivo en el reporte operativo y actualizar workflow privado diario con `contents: write` limitado a ese job. Conservar el respaldo de siete días actual y avisar si falla cualquiera de las dos copias.
- [ ] Ejecutar pruebas de aplicación/navegador, lint, tipos, build y revisión independiente. Publicar por Git/Vercel.
- [ ] Ejecutar el workflow real, descargar archivo cifrado, verificar descifrado/restauración en base temporal nueva y comparar datos completos. Contrastar todos los IDs/hashes previos y portafolio, verificar monitor y UI de producción. Guardar cierre privado reproducible.

**Límites:** un archivo adicional no libera espacio en Neon porque se pidió no mover ni borrar nada. Sigue siendo necesario revisar capacidad futura. GitHub y Neon conservan sus límites y términos; no se promete almacenamiento infinito ni continuidad garantizada gratis. Las alertas son controles de espacio local, no lectura de consumo de compute/red ni de todas las ramas del proyecto.

Fuentes oficiales verificadas: https://neon.com/docs/introduction/plans y https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases.

## Verificación antes de publicar

Build de producción correcto, TypeScript/lint correctos y 38 E2E de escritorio/móvil aprobadas. Revisión independiente resuelta: los avisos de GitHub distinguen nivel preventivo del 70% y prioritario del 85%, sin reenviar contenido arbitrario. No hay bloqueos de privacidad, integridad o borrado. Copia cifrada previa de 41 tablas / 2609 filas y huellas por ID guardadas fuera de Git para comparación posterior.

El cambio del workflow está preparado en el checkout privado y se publica después de que Vercel confirme Ready. El cierre real de archivo/recuperación se documentará en `.data/private/2026-11-01-research-capacity-release.md` para evitar otro despliegue solo por documentación.
