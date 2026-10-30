# Noticiero

Un briefing personal de tecnología, finanzas y operaciones de pequeñas empresas: noticias, contexto empresarial y oportunidades con evidencia. Interfaz blanca, adaptable a móvil y con datos persistentes.

Instancia personal: [noticiero-self.vercel.app](https://noticiero-self.vercel.app). Requiere la cuenta de GitHub autorizada. Este dominio principal permite entrar desde teléfono sin iniciar sesión adicionalmente en Vercel; las URL de despliegues y vistas previas conservan la protección de Vercel.

## Arrancar en local

Requiere Node.js 24.x. No necesita Docker ni credenciales para consultar las fuentes abiertas.

```bash
npm install
npm run dev
```

Abre [http://127.0.0.1:3001](http://127.0.0.1:3001). La primera apertura consulta las fuentes automáticamente; las siguientes usan la edición guardada. El botón **Actualizar** solicita una nueva edición en segundo plano.

La base PostgreSQL integrada (PGlite) se guarda en `.data/postgres`. Mantén un solo servidor usando esa carpeta. El comando `npm run update` se conecta al servidor activo; no abre una segunda instancia de la base. La carpeta `.data` contiene tus noticias y guardados: respáldala con el servidor detenido.

La vista [/?demo=1](http://127.0.0.1:3001/?demo=1) permite explorar ejemplos identificados. No son noticias reales ni cotizaciones. Sus guardados son temporales.

## Qué funciona sin claves

- Recopilación de Hacker News, Ask HN, Show HN, respuestas públicas limitadas de esos hilos, Y Combinator (blog y Requests for Startups), Ars Technica, The Verge, TechCrunch y WIRED, según disponibilidad.
- Finanzas y operaciones: CNBC Finance, Reserva Federal, Banking Dive y Small Business Trends mediante sus feeds publicados. Los comunicados y artículos son contexto; las señales de demanda se extraen de solicitudes/experiencias de personas, no de una noticia editorial.
- Fechas originales, atribución, enlaces, extractos y fotos publicadas en feeds cuando existen; sin descargar páginas de suscripción.
- Agrupación conservadora de duplicados, búsqueda, filtros por tema/edición, noticias leídas y guardados persistentes.
- Empresas detectadas por menciones de su nombre o productos en el texto disponible, con catálogo de tickers y enlaces a Yahoo Finance. No se afirma que esas menciones demuestren impacto causal.
- Fuentes activables, estados de actualización y recuperación de una ejecución fallida.
- Motor estadístico local: TF-IDF, similitud coseno, reglas de solicitudes/quejas/trabajo manual y plantillas de hipótesis en español.
- Cuaderno acumulativo con citas, enlaces exactos, autores públicos, historial por día y notas personales. Las respuestas se analizan por su propio texto, sin atribuirles la solicitud del hilo padre.
- Oportunidades cuando al menos dos autores públicos distintos describen necesidades relacionadas. Una cuenta no equivale a un cliente verificado. YC RFS es contexto editorial y no cuenta como demanda.
- Reportes por fecha, con noticias de la jornada, señales nuevas, evidencia e hipótesis; lectura y exportación Markdown en Oportunidades → Reportes nocturnos.

El modo predeterminado `ANALYSIS_MODE=local` no realiza llamadas a APIs de IA, aunque existan credenciales configuradas. El costo de API es **$0**; la infraestructura consume almacenamiento y conexión. El modelo estadístico mantiene hasta 2,000 documentos; incorpora al modelo documentos observados en los últimos 30 días y conserva los anteriores hasta desplazarlos por capacidad. La extracción de señales revisa las publicaciones comunitarias almacenadas, independientemente de ese límite, para recuperar evidencia pendiente cuando mejoran las reglas. Aprende frecuencias de términos, no entrena un modelo de lenguaje ni busca en toda la web.

Los titulares, extractos y citas permanecen en su idioma original; se etiquetan como **Extracto original** o **Solo titular**. Las hipótesis y explicaciones locales usan español. La traducción generativa requiere un modelo opcional. No se inventan cotizaciones ni clientes para llenar la pantalla.

## Guardados y conservación

Guardar una noticia o idea conserva una copia del texto, resumen disponible, enlaces y evidencia en la base de datos. Los nuevos guardados y anotaciones de ideas conservan la primera copia, aunque la fuente o el análisis cambien después. Las copias se muestran en **Guardados**, incluso si la idea deja de cumplir los criterios del motor. No tienen caducidad automática y el archivo no tiene el límite de 60 tarjetas del feed.

Los marcadores de versiones anteriores pueden seguir usando referencias hasta capturar su contenido. Las notas personales se conservan al actualizar. Quitar un elemento de Guardados elimina su marcador y anotación de ese archivo; no borra la noticia recopilada. Las fotos y el artículo completo del editor no se descargan como archivo permanente.

Persistencia no equivale a respaldo: borrar `.data/postgres` o perder el disco puede perder tus datos. Para una conservación duradera hay que respaldar la base y comprobar restauración. Al publicar en Vercel, debes migrar los datos locales a PostgreSQL externo; desplegar código no los traslada.

Para discutir una noticia o idea conmigo, comparte su enlace y tus notas, o el reporte Markdown exportado. El dashboard todavía no incluye una conexión de chat automática.

## Investigación automática e entrevistas

Cada actualización conserva noticias nuevas, señales, palabras clave y notas del cuaderno sin abrir el dashboard ni marcar favoritos. Todas las oportunidades elegibles del motor local se guardan; el archivo automático conserva su descubrimiento y sus revisiones con la evidencia correspondiente. La repetición de dos autores públicos es un umbral de investigación, no validación comercial. No se promete una idea nueva en cada ejecución.

Los temas y palabras clave de cada versión de noticia también se guardan en un registro permanente de contexto, aunque no produzcan una oportunidad. Ese registro es independiente del corpus temporal del modelo y no se elimina al pasar treinta días.

Las señales nuevas pueden reforzar un cuaderno iniciado meses antes. Se acumulan citas, autores públicos distintos y fechas de actividad; varias intervenciones de la misma cuenta no cuentan como varios clientes. El motor no modifica sus reglas por sí solo ni aprende automáticamente de entrevistas o de decisiones personales. No ejecuta un análisis semanal/mensual separado: los periodos se revisan mediante el archivo y sus exportaciones. Más datos pueden aportar evidencia útil, sin garantizar más oportunidades ni que cada agrupación sea correcta.

En **Oportunidades → Archivo automático** puedes revisar hoy, los últimos 3, 7 o 30 días, o todo el historial almacenado. **Descargar investigación** exporta señales, palabras clave, anotaciones, revisiones y reportes del periodo en Markdown (hasta 90 días por archivo). Las fechas usan CDMX. El modelo estadístico tiene un corpus de trabajo acotado; ese límite no elimina el historial de investigación, entrevistas o favoritos.

**Preparar entrevistas** crea o abre una investigación en **Entrevistas**. Si partes de una revisión histórica o un favorito, conserva esa copia concreta de hipótesis y fuentes. Define segmento, problema, hipótesis y criterio de éxito. Registra alias, rol, fecha, solución actual, frecuencia, consecuencia/costo, cita, contradicciones y siguiente paso. Los formularios personales requieren pulsar **Guardar investigación**, **Guardar entrevista** o **Guardar notas**; las señales y oportunidades generadas se guardan solas. Archivar una investigación conserva sus entrevistas. No se contacta a personas automáticamente.

Para trabajar cada tres días: abre el archivo, descarga el periodo y pide revisar problemas repetidos, evidencia que contradice cada hipótesis y preguntas para entrevistas. En el chat local de este proyecto, Codex puede consultar los datos cuando lo solicites; guardar en la app no envía un mensaje al chat.

## Respaldos automáticos y avisos

Las plantillas en `ops/workflows/` se instalan en el repositorio privado de operaciones configurado por `OPS_REPOSITORY`. No son workflows activos en el repositorio público de la app. El respaldo corre diariamente a las 10:23 UTC (04:23 CDMX, sujeto a la cola de GitHub). El monitor independiente corre a las 15:37 y 04:37 UTC, después de las ventanas editoriales de la mañana y noche.

Un rol PostgreSQL de solo lectura captura todas las tablas de contenido en una transacción consistente. El snapshot JSON versionado se comprime y cifra con AES-256-GCM antes de subirlo como artefacto privado. No incluye claves de entorno ni leases activos. Incluye noticias, señales, notas, revisiones, reportes, favoritos, entrevistas y configuración de fuentes. Se conservan siete días de **copias de respaldo**; el historial de la base no caduca a los siete días. El runner rechaza archivos cifrados mayores de 40 MB para mantener un margen de almacenamiento. Actions y artefactos consumen los cupos compartidos de GitHub; no se activa ningún upgrade ni servicio generativo.

**Estado y respaldos** muestra la última edición, copia confirmada y avisos activos. Fallos, ediciones parciales, ventanas omitidas, ejecuciones detenidas y respaldos ausentes/vencidos generan avisos. El monitor también detecta que la web no responde. Mantiene una incidencia privada asignada al propietario y la cierra al recuperarse, sin publicar notas ni credenciales. La recepción de email depende de las preferencias de notificaciones de GitHub.

Los secretos operativos se guardan en GitHub Secrets: `BACKUP_DATABASE_URL` (solo lectura), `BACKUP_ENCRYPTION_KEY`, `OPS_MONITOR_SECRET` y `OPS_REPORT_SECRET`. Solo los últimos dos y `OPS_REPOSITORY` se necesitan en Vercel. La clave de recuperación también se conserva en un archivo local privado fuera de Git; guarda una copia en tu gestor de contraseñas.

Para restaurar, descarga el artefacto cifrado y carga la clave en `BACKUP_ENCRYPTION_KEY` desde tu almacén privado, sin pegarla en un comando que quede en el historial. Puedes verificar una restauración sin tocar la base actual:

```bash
node --import tsx scripts/restore-backup.ts /ruta/al/respaldo.enc /ruta/nueva/de/verificacion
```

El segundo argumento debe ser una carpeta nueva y crea PGlite temporal. Para restaurar en PostgreSQL, omite esa carpeta y establece `RESTORE_DATABASE_URL` a un destino vacío. La restauración autentica el cifrado, comprueba tablas y recuentos, y rechaza cualquier destino con datos, incluyendo leases. La clave correcta es necesaria para recuperar una copia cifrada.

## Activar redacción generativa opcional

Copia `.env.example` a `.env.local` y configura:

```dotenv
ANALYSIS_MODE=api
LLM_BASE_URL=https://tu-proveedor-compatible.example/v1
LLM_MODEL=tu-modelo
LLM_API_KEY=tu-clave
AI_INPUT_USD_PER_MILLION=tarifa-de-entrada
AI_OUTPUT_USD_PER_MILLION=tarifa-de-salida
AI_MONTHLY_BUDGET_USD=10
```

Reemplaza las tarifas por números reales de tu proveedor. El conector utiliza Chat Completions con salida JSON, `temperature` y `max_tokens`; el modelo elegido debe soportar esos parámetros. La aplicación valida la estructura y las referencias de la respuesta, sin dar herramientas al modelo. Las credenciales nunca se envían al navegador. Consulta el formato del endpoint en la [documentación oficial](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create).

Con Ollama ya instalado y un modelo disponible puedes usar `LLM_BASE_URL=http://localhost:11434/v1`, `LLM_MODEL` con el nombre local, sin clave y ambas tarifas en `0`. No se instala ni descarga un modelo automáticamente.

Reinicia el servidor y pulsa **Actualizar**. Se analizan hasta 25 eventos, únicamente cuando hay extracto suficiente. Las respuestas se reutilizan por hash de contenido. Las ideas son hipótesis, con fuentes y un experimento propuesto; pueden no aparecer si la evidencia es insuficiente.

El límite mensual es un control de la aplicación, independiente de la facturación del proveedor. Se reserva un máximo conservador usando bytes de entrada, tokens máximos de salida y tarifas configuradas. Con uso reportado se ajusta el importe; tras un fallo ambiguo se conserva la reserva porque la llamada podría haberse cobrado. Usa también los controles del proveedor. Las reservas no se recuperan automáticamente tras errores sin telemetría.

## Activar cotizaciones reales

Configura `ALPHA_VANTAGE_API_KEY`, reinicia y actualiza. Se consultan hasta diez símbolos prioritarios, con caché de diez horas y un límite local de veinte peticiones diarias. Son cotizaciones de cierre; el dato muestra su sesión, moneda y proveedor. La información intradía requiere cobertura adicional del proveedor. Una cotización anterior a la noticia se marca como tal; no se atribuye causalidad al cambio diario.

## Automatizar en macOS

```bash
npm run build
npm run schedule:install
```

Instala dos servicios de usuario en `~/Library/LaunchAgents`: `local.noticiero.server` mantiene el servidor de producción en `127.0.0.1:3001` y `local.noticiero.update` solicita una actualización al iniciar y cada hora. Detén antes cualquier servidor manual que use ese puerto. No abras dos servidores sobre la misma base integrada.

Los servicios fuerzan `ANALYSIS_MODE=local`, usan rutas absolutas y guardan sus logs en `.data/server.log`, `.data/server-error.log`, `.data/schedule.log` y `.data/schedule-error.log`. Los archivos se pueden inspeccionar sin instalar con `npm run schedule:generate`. No contienen credenciales.

El reporte se guarda durante las actualizaciones desde las **20:00 CDMX**. Se actualiza con observaciones posteriores de esa misma jornada; un corte manual anterior es provisional. Al reanudar se recuperan todos los días anteriores con datos guardados y un cierre ausente o provisional. No se inventan noticias de días sin recopilación. Los cierres históricos ya completos se conservan como snapshots. No se promete ejecución al minuto exacto.

Requiere sesión de macOS iniciada y computadora disponible. No recopila con el equipo apagado o dormido; al volver se retoma la consulta. Para actualizar el código, desinstala temporalmente los servicios, recompila y vuelve a instalarlos.

Para detener ambos servicios, manteniendo todos tus datos:

```bash
npm run schedule:uninstall
```

## Preparar Vercel

1. Crea una base PostgreSQL administrada y establece `DATABASE_URL` con una conexión compatible. El esquema se inicializa automáticamente; no utiliza `.data` en Vercel.
2. Crea una app OAuth de GitHub. Callback: `https://TU-DOMINIO/api/auth/callback/github`.
3. Configura `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_SECRET` y `AUTH_ALLOWED_GITHUB_ID` (tu identificador numérico inmutable de GitHub).
4. Configura un `CRON_SECRET` aleatorio y, opcionalmente, las claves de análisis/mercado. Puedes generar secretos localmente con `openssl rand -base64 32`.
5. Despliega este proyecto. La portada y las APIs de lectura/escritura exigen autenticación en Vercel. No dependas solo de que la URL sea desconocida.
6. `vercel.json` define dos tareas diarias: 13:00 UTC y 02:00 UTC, equivalentes a 07:00 y 20:00 de CDMX. La edición PM se identifica con la fecha local aunque UTC ya sea el día siguiente.
7. El endpoint cron inicia un Workflow durable con pasos reanudables. Revisa disponibilidad, límites y costos del plan antes de activar el entorno. En Hobby el disparo puede ocurrir dentro de la hora, no al minuto exacto.

La aplicación falla con acceso cerrado si no hay configuración de autenticación en el entorno alojado. Localmente se limita a loopback. Las escrituras validan el origen de la petición y los endpoints de cron requieren su secreto.

Docker es opcional. `docker compose up -d` crea PostgreSQL en loopback; configura `DATABASE_URL=postgres://noticiero:local-development-only@127.0.0.1:5432/noticiero` si prefieres usarlo. Cambiar de base no importa automáticamente los datos del almacenamiento integrado.

## Comprobaciones

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Las pruebas E2E usan Google Chrome local, el build de producción y un servidor aislado en `127.0.0.1:3101`, con `.data/e2e-postgres` temporal. Compila antes con `npm run build`. Las pruebas unitarias/integración usan `.data/test-postgres`, separada de tus datos. Las pruebas de navegación utilizan ejemplos identificados y registros sintéticos en esa base temporal.

## Estructura

- `src/components`: dashboard y vistas responsive.
- `src/features/sources`: conectores de fuentes públicas.
- `src/features/news`: normalización, seguridad de enlaces, deduplicación y selección.
- `src/features/analysis`: proveedor configurable, validación y presupuesto.
- `src/features/market`: empresas y cotizaciones.
- `src/features/opportunities`: generación opcional mediante API.
- `src/features/research`: motor estadístico gratuito, señales, notas, hipótesis locales y reportes.
- `src/features/jobs` y `src/workflows`: actualización local y ejecución durable en línea.
- `src/db`: esquema compartido, adaptadores y persistencia.
- `scripts`: actualización manual y generación del horario local.

Product Hunt, X, Reddit, NYT y WSJ están identificados como integraciones planeadas; no se presentan como conectados. Su acceso requiere la API, credencial o licencia correspondiente. El [plan aprobado](docs/superpowers/plans/2026-10-28-noticiero.md) contiene el alcance original.
