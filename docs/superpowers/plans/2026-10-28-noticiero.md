# Noticiero — plan de producto, diseño e implementación

**Fecha:** 28 de octubre de 2026.
**Estado:** aprobado por el usuario e implementado en su primera versión local. Las conexiones con IA, cotizaciones y el despliegue externo requieren configurar sus accesos.
**Objetivo:** leer en 5–10 minutos las noticias relevantes de tecnología, entender las empresas relacionadas y detectar oportunidades de startups sustentadas en esas noticias.
**Enfoque confirmado:** tecnología global, resúmenes en español y bolsa de Estados Unidos.
**Contexto inicial:** el directorio del proyecto estaba vacío al preparar este plan. La secuencia siguiente conserva los criterios previstos; el estado comprobado se registra al final.

## 1. Enfoque recomendado

Construir una aplicación personal que funcione primero en local y que conserve la misma arquitectura al publicarse en Vercel. Dos ediciones al día bastan para el uso de mañana y noche; la pantalla consulta los resultados guardados, sin volver a pagar análisis de IA cada vez que se abre.

| Alternativa | Ventaja | Costo o limitación |
| --- | --- | --- |
| Local y preparada para Vercel — recomendada | Permite validar el contenido y el diseño antes de contratar servicios; evita reescribir el producto al publicarlo | La automatización local necesita que la computadora esté encendida |
| Vercel desde la primera versión | Disponible desde teléfono o computadora sin depender del equipo local | Requiere configurar cuentas, credenciales, base de datos y acceso privado desde el principio |
| Agregador existente con automatizaciones | Reduce trabajo inicial de recopilación | Limita el diseño y la relación entre noticias, mercado e ideas; añade dependencias de otro producto |

La primera entrega utilizable cubrirá fuentes abiertas, resúmenes, empresas y oportunidades. X, Reddit y las fuentes con acceso especial se incorporarán como ampliaciones, sin bloquear esa entrega.

## 2. Experiencia y distribución

### Escritorio

Barra lateral compacta de navegación, de unos 180 px. El espacio restante se divide aproximadamente 65/35 entre noticias y contexto. Ancho máximo de lectura cercano a 1440 px.

```text
┌─────────────┬───────────────────────────────────────────────────────┐
│ Noticiero   │ Miércoles, 28 de octubre     Edición AM / PM           │
│             │ Última actualización · Buscar · Actualizar            │
│ Hoy        ├────────────────────────────────┬──────────────────────┤
│ Guardados   │ Lo esencial del día            │ Empresas relacionadas│
│ Ideas       │ 3 puntos del briefing          │ Empresa · ticker     │
│ Fuentes     │                                │ Variación · fecha    │
│             │ Todos · IA · Chips · Startups  │ Motivo de relación   │
│             │                                ├──────────────────────┤
│             │ [Foto] Titular                 │ Oportunidades        │
│             │ Resumen breve                  │ Problema identificado│
│             │ Por qué importa                │ Cliente potencial    │
│             │ Fuente · hora · leer original  │ Idea y primer MVP    │
│             │                                │ Cómo validarla       │
│             │ Más noticias agrupadas         │ Evidencia y guardar  │
└─────────────┴────────────────────────────────┴──────────────────────┘
```

El esquema muestra contenido de ejemplo y no representa una edición real.

### Estilo

- Fondo blanco; navegación en gris muy claro; separadores discretos y sombras mínimas.
- Tipografía de sistema, títulos legibles, abundante espacio y bloques editoriales sencillos, inspirados en la claridad de Notion.
- Texto gris oscuro con contraste accesible; sin grandes superficies negras. Un acento azul tenue para acciones y etiquetas.
- Variaciones bursátiles acompañadas por signo y texto, además de verde/rojo moderados.
- Miniaturas de fotografías de la fuente cuando su uso esté permitido; si faltan, bloque tipográfico limpio. No generar fotografías que aparenten documentar hechos reales.

### Interacciones

- Al abrir: briefing de tres puntos y 15–25 historias prioritarias, si existe suficiente material relevante.
- Cada historia presenta titular en español, fuente, fecha original, resumen de 60–100 palabras cuando el texto disponible lo permita, “por qué importa”, temas y enlace al original.
- Un evento cubierto por varios medios se muestra una vez, con enlaces a las coberturas relacionadas.
- Al seleccionar una historia, el panel derecho filtra empresas y oportunidades de ese evento; “Ver todo el día” recupera el contexto general.
- Búsqueda por texto, empresa y tema; filtros por edición y categoría; guardar historias, marcar leídas y guardar ideas.
- “Actualizar” solicita un trabajo en segundo plano y muestra su estado. No lanza análisis duplicados si ya hay uno activo.
- En móvil: una columna con pestañas Noticias, Empresas e Ideas que mantienen la historia seleccionada.
- Estados diseñados: primera apertura sin noticias, cargando, sin resultados, proveedor sin configurar, actualización parcial y datos antiguos. Siempre se ve la fecha real de cada dato.

## 3. Fuentes y prioridades

| Fuente | Integración propuesta | Etapa y condición |
| --- | --- | --- |
| Hacker News / ecosistema YC | API oficial para historias, Show HN y Ask HN; enlaces al contenido original | Inicial. Priorizar tecnología y problemas planteados por usuarios; popularidad es una señal, no confirmación |
| Ars Technica | RSS oficial | Inicial. Empezar con tecnología, software y seguridad |
| The Verge y TechCrunch | RSS si se confirma disponibilidad y condiciones del feed al conectar | Inicial, sujetos a esa comprobación. El producto funciona con Hacker News y Ars si alguno falla |
| Blogs oficiales de empresas y YC | Feeds o endpoints oficiales verificados por fuente | Ampliación editorial para anuncios y contexto primario |
| Yahoo Finance | Enlaces de referencia de empresas y artículos; ingestión solo si se dispone de un feed o acceso permitido verificable | No usar endpoints no documentados como dependencia principal de cotizaciones |
| New York Times | API oficial de titulares/metadatos o RSS permitido | Ampliación con credencial cuando proceda; el acceso a metadatos no equivale a acceso al artículo completo |
| Wall Street Journal | Feed o licencia disponible y verificada | Ampliación; mostrar contenido accesible y enlaces, sin asumir acceso al texto de suscripción |
| Product Hunt | API GraphQL oficial con token del usuario | Ampliación para lanzamientos y competidores; revisar permiso específico si el uso se vuelve comercial |
| Reddit | API con aprobación y OAuth | Ampliación para problemas y señales de demanda, dentro del uso aprobado |
| X / Twitter | API oficial con credencial y límite de gasto | Ampliación para cuentas y listas seleccionadas; no hay una conexión a X disponible en esta sesión |

### Reglas de contenido

Usar solo texto realmente obtenido por acceso permitido, con atribución y enlaces. Guardar el nivel de cobertura: artículo, extracto o solo titular. Si solo hay titular, presentar una ficha breve etiquetada “solo titular”; no fabricar un resumen extendido. La existencia de RSS o metadatos no implica autorización para redistribuir imágenes o artículos completos.

Las publicaciones de redes se identifican como conversación o anuncio sin verificar hasta que exista evidencia independiente. Las fuentes con credenciales faltantes se muestran como pendientes de conexión y no como si ya estuvieran funcionando.

## 4. Recopilación, selección y análisis

Flujo: consultar fuentes → normalizar → deduplicar → agrupar por evento → priorizar → resumir → vincular empresas → consultar mercado → generar oportunidades → publicar edición.

1. **Consultar:** 5–8 fuentes iniciales, hasta 30 entradas recientes por fuente y ventana inicial de 48 horas. En siguientes ejecuciones usar marcas de avance con solapamiento para no perder publicaciones tardías.
2. **Normalizar:** conservar fuente, identificador externo, URL canónica, publicación, detección, título, texto disponible, imagen y nivel de cobertura. Los tiempos se almacenan en UTC y se presentan en America/Mexico_City.
3. **Deduplicar:** identificador y URL normalizada para copias exactas; agrupación conservadora por entidades, tema y proximidad temporal para coberturas del mismo evento. Conservar actualizaciones sustanciales como versiones relacionadas.
4. **Priorizar:** relevancia tecnológica, actualidad, alcance, evidencia primaria y novedad. Limitar la concentración de una misma fuente; conservar por separado importancia editorial y popularidad social.
5. **Resumir:** analizar como máximo 25 eventos nuevos por edición. Respuestas estructuradas, validadas con esquema; referencias a los artículos empleados. Texto externo tratado como datos y sin permisos para ejecutar herramientas.
6. **Publicar:** resultados persistentes; no llamar a la IA desde cada render de la página. Cada edición registra fuentes exitosas, fallidas, costos y grado de completitud.

Los resultados de IA se reutilizan por hash de contenido y versión del análisis. Una historia solo se vuelve a analizar si cambia sustancialmente. Si falla una fuente, las demás continúan; si falla la IA, permanece visible el contenido original disponible con “análisis pendiente”.

## 5. Empresas y bolsa

Dos apartados distintos dentro de cada ficha:

- **Relación con la noticia:** empresa mencionada, competidor, cliente o proveedor. Separar relación explícita en el artículo de relación inferida; enlazar la evidencia y marcar las inferencias.
- **Movimiento observado:** precio, cambio absoluto, porcentaje frente al cierre anterior, moneda, fecha/hora del dato, proveedor y sesión correspondiente. El modelo de IA no genera precios ni porcentajes.

Propuesta inicial: Alpha Vantage para una lista prioritaria de hasta diez símbolos por día, con cotizaciones de cierre y caché compartida entre historias. Su servicio gratuito documenta 25 peticiones diarias y cotizaciones actualizadas al cierre por defecto. Usar hasta 20 peticiones al día, reservando margen para incidencias; no pagar consultas duplicadas por historia o visita. Los símbolos fuera de la cuota muestran “cotización pendiente” y conservan la relación empresarial.

El modo gratuito permite contexto bursátil diario. Para estudiar reacción intradía habrá que habilitar un plan de datos con esa cobertura y permiso de visualización. No presentar la variación diaria como “causada por esta noticia”. Cuando el último precio es anterior a la noticia, mostrar “todavía sin cotización posterior al evento”. Empresas privadas: “no cotiza”.

Resolver tickers contra un catálogo de empresas y bolsas; no aceptar símbolos inventados por la IA. Mantener snapshots por sesión para formar historial con el uso. No dibujar minigráficas antes de tener suficientes observaciones reales. Las ventanas intradía y comparación con un índice quedan para una ampliación con datos compatibles.

## 6. Ideas de negocio

Generar hasta tres oportunidades por edición, únicamente si existe evidencia suficiente; una edición puede tener cero. Relacionar señales de varias noticias cuando sean independientes y pertinentes.

Cada ficha contiene:

1. Problema concreto y quién lo sufre.
2. Evidencia: enlaces y explicación de qué respalda cada fuente.
3. Por qué podría existir una oportunidad ahora.
4. Producto propuesto y cliente que podría pagar.
5. MVP que pueda intentarse en 1–2 semanas.
6. Experimento de validación de una semana y señal de éxito propuesta.
7. Competidores conocidos solo cuando exista fuente; en caso contrario, “competencia por investigar”.
8. Dificultad estimada, barreras y confianza cualitativa con justificación.

Estas fichas se presentan como hipótesis, distinguiendo datos de propuestas. No inventar tamaño de mercado, ingresos, demanda validada o probabilidad de éxito. Guardar ideas con notas y estado: por explorar, validando o descartada. Ideas del mismo problema se actualizan en lugar de reaparecer cada día.

## 7. Arquitectura propuesta

- **Aplicación:** Next.js, TypeScript, Tailwind CSS y componentes accesibles; versiones estables verificadas y fijadas al iniciar la implementación.
- **Persistencia:** PostgreSQL y Drizzle. Base local en Docker; base administrada compatible con PostgreSQL al publicar, por ejemplo Neon. Misma estructura de datos en ambos entornos.
- **IA:** adaptador servidor con proveedor y modelo configurables. Usar una API habilitada por el usuario y registrar consumo; no asumir que una suscripción de chat incluye llamadas API.
- **Tareas:** funciones de dominio reutilizables por un ejecutor local y por Workflow SDK al alojar en Vercel. El endpoint inicia la tarea y devuelve su identificador; los pasos se ejecutan por lotes reanudables.
- **Acceso:** en local, servidor ligado a localhost. En línea, aplicación privada de un usuario, con Auth.js, OAuth de GitHub y lista de usuario permitido. Proteger también APIs, datos y acciones de actualización.
- **Secretos:** variables de entorno del servidor para base de datos, IA, cotizaciones y tareas; ninguna clave en el navegador o el repositorio.

Entidades: Source, Article, StoryCluster, Analysis, Company, StoryCompany, QuoteSnapshot, Opportunity, OpportunityEvidence, Edition, EditionStory, SavedItem y JobRun. Separar fecha de publicación, fecha de ingestión, fecha de cotización y fecha de análisis.

Las tareas usan clave única por fecha y edición, bloqueos con expiración y checkpoints. Un reintento no duplica historias ni ediciones. Cada consulta externa tiene timeout; ante HTTP 429 respetar Retry-After y aplicar hasta tres reintentos con espera progresiva. Al agotar reintentos se registra el fallo y se conserva el avance.

Las URLs de artículos e imágenes se restringen a dominios y protocolos autorizados; comprobar redirecciones y bloquear destinos internos. No renderizar HTML sin sanitizar. No incluir secretos en errores, prompts ni logs.

## 8. Actualización automática

Objetivo editorial: ediciones alrededor de **07:00 y 20:00, America/Mexico_City**, todos los días. En fines de semana y festivos, indicar la última sesión bursátil disponible.

- **Local:** comando de actualización manual y opción de programar las dos ejecuciones mediante launchd en macOS. Al arrancar, detectar ediciones omitidas y recuperar noticias recientes sin duplicar. La computadora debe estar disponible para ejecutar tareas.
- **Vercel:** dos tareas cron distintas, cada una diaria, que inician el mismo flujo con edición AM o PM. Horarios equivalentes iniciales en UTC: 13:00 para AM y 02:00 del día siguiente para PM; la edición se identifica usando la fecha de Ciudad de México, no la del disparo UTC.
- **Precisión:** la documentación actual de Hobby permite múltiples cron jobs diarios y ejecución dentro de la hora programada. Dos jobs diarios pueden cubrir mañana/noche; no garantizan el minuto exacto. Para mayor frecuencia o precisión, evaluar Pro.
- **Ejecución:** cron autenticado con secreto; Workflow procesa pasos durables y el dashboard consulta el estado. Revisar límites y costos vigentes de funciones y workflows antes de desplegar.
- **Visibilidad:** mostrar último intento, última edición exitosa y avisos de fuentes fallidas. Una actualización parcial conserva el acceso a resultados anteriores.

## 9. Alcance y presupuesto

La primera versión incluye noticias, resúmenes en español, fotos disponibles, búsqueda y filtros, guardados, empresas relacionadas, datos diarios de mercado, oportunidades con evidencia, modo móvil, registro de tareas y ejecución local. La publicación privada en Vercel es una etapa posterior usando la misma aplicación.

Las ampliaciones cubren Product Hunt, NYT, WSJ, Reddit, X, cotizaciones intradía y frecuencia mayor. No se necesita incorporar todas para empezar a leer noticias útiles.

No se contratarán planes durante la planeación. Para la implementación, proponer un límite inicial de IA de **10 USD por mes**, configurable y sujeto a aceptación; es un presupuesto objetivo, no una cotización del servicio. Controlar el consumo por tokens, proveedor y modelo, con una reserva antes de cada análisis y suspensión de nuevas llamadas al alcanzar el límite. La plataforma de IA puede tener su propio sistema de facturación que se debe configurar aparte.

El costo total dependerá de IA, alojamiento, PostgreSQL, workflows y permisos de datos. Intentar usar niveles gratuitos compatibles con uso personal y privado; verificar límites reales al desplegar. El costo del proveedor de bolsa puede aumentar si se requiere información intradía; X agrega consumo independiente. Reutilizar análisis y consultar bolsa por símbolo reduce consumo.

## 10. Secuencia de construcción

Esta secuencia define entregas revisables. Los comandos de verificación son objetivos para la futura aplicación; todavía no existen scripts ni se han ejecutado pruebas del producto.

### Entrega 1 — Interfaz navegable en local

Archivos previstos: `src/app/page.tsx`, `src/app/globals.css`, `src/components/app-sidebar.tsx`, `src/features/news/news-feed.tsx`, `src/features/market/company-panel.tsx`, `src/features/opportunities/opportunity-panel.tsx`, `src/lib/demo-data.ts`.

- [ ] Crear base Next.js/TypeScript, estilos claros y estructura responsive.
- [ ] Construir briefing, filtros, tarjetas y panel contextual con datos de demostración claramente etiquetados.
- [ ] Conectar selección de noticia, búsqueda, pestañas móviles y estados vacíos.
- [ ] Revisar en navegador a 390 px y 1440 px: legibilidad, foco de teclado, contraste y ausencia de scroll horizontal.
- [ ] Ejecutar `npm run lint`, `npm run typecheck` y `npm run build`; esperar salida exitosa.

Resultado: validar la experiencia antes de conectar servicios de pago.

### Entrega 2 — Noticias reales y persistencia

Archivos previstos: `compose.yaml`, `.env.example`, `src/db/schema.ts`, `src/db/client.ts`, `src/features/sources/adapters/hacker-news.ts`, `src/features/sources/adapters/rss.ts`, `src/features/news/normalize.ts`, `src/features/news/deduplicate.ts`, `scripts/update.ts`, `tests/ingestion.test.ts`.

- [ ] Crear esquema y migraciones; documentar arranque local y variables necesarias.
- [ ] Conectar Hacker News y Ars; validar The Verge/TechCrunch antes de habilitarlos.
- [ ] Normalizar y persistir artículos con atribución, cobertura y fechas.
- [ ] Comprobar que el mismo identificador y una URL con parámetros de seguimiento no generan copias; conservar dos fuentes distintas sobre un evento.
- [ ] Probar una fuente caída y una ejecución repetida: continúan las fuentes sanas y el conteo de artículos no se duplica.
- [ ] Ejecutar `npm run test -- tests/ingestion.test.ts` y `npm run update`; esperar pruebas exitosas y noticias reales visibles.

Resultado: lectura de noticias originales aunque no exista una credencial de IA.

### Entrega 3 — Resúmenes y oportunidades con evidencia

Archivos previstos: `src/features/analysis/provider.ts`, `src/features/analysis/schemas.ts`, `src/features/analysis/summarize.ts`, `src/features/analysis/budget.ts`, `src/features/opportunities/generate.ts`, `tests/analysis.test.ts`.

- [ ] Definir respuestas estructuradas, referencias obligatorias y etiquetas de cobertura e inferencia.
- [ ] Conectar el proveedor configurado; aplicar caché y presupuesto antes de llamar.
- [ ] Generar briefing, resúmenes y hasta tres oportunidades; conservar notas y estados de ideas.
- [ ] Verificar que una fuente con solo titular no produzca un resumen de artículo; rechazar evidencia que no pertenezca a las entradas disponibles.
- [ ] Verificar que una segunda visita no invoque IA y que presupuesto agotado o fallo de proveedor deje visibles las noticias.
- [ ] Ejecutar `npm run test -- tests/analysis.test.ts`; revisar manualmente diez resúmenes y todas sus referencias.

Resultado: edición útil en español con propuestas de negocio trazables.

### Entrega 4 — Empresas y contexto bursátil

Archivos previstos: `src/features/market/company-catalog.ts`, `src/features/market/alpha-vantage.ts`, `src/features/market/quote-cache.ts`, `src/features/market/presentation.ts`, `tests/market.test.ts`.

- [ ] Relacionar empresas con historias y resolver identificadores contra el catálogo.
- [ ] Conectar cotizaciones diarias, caché, límite de peticiones y snapshots por sesión.
- [ ] Mostrar precio, porcentaje, período y relación con la noticia sin afirmar causalidad.
- [ ] Verificar empresa privada, ticker desconocido, cuota agotada, fin de semana y cotización anterior a la publicación.
- [ ] Ejecutar `npm run test -- tests/market.test.ts`; cotejar una muestra con respuestas originales del proveedor.

Resultado: las dos columnas se actualizan según la historia seleccionada y conservan fechas comprensibles.

### Entrega 5 — Operación diaria y Vercel

Archivos previstos: `src/workflows/update-edition.ts`, `src/app/api/jobs/am/route.ts`, `src/app/api/jobs/pm/route.ts`, `src/app/api/update/route.ts`, `src/app/api/jobs/[id]/route.ts`, `src/auth.ts`, `vercel.json`, `scripts/install-local-schedule.ts`, `tests/jobs.test.ts`, `tests/dashboard.spec.ts`, `README.md`.

- [ ] Conectar ejecutor local y flujo durable a las mismas funciones; persistir checkpoints y bloquear ejecuciones solapadas.
- [ ] Probar reintento después de un fallo intermedio y ejecución PM cuya fecha UTC pertenece al día siguiente.
- [ ] Documentar instalación y retirada del horario local; no registrar servicios del sistema sin que el usuario elija habilitarlos.
- [ ] Preparar autenticación privada, secretos y dos cron jobs diarios para Vercel.
- [ ] Verificar API protegida, acceso de un usuario no permitido y endpoint cron sin credencial.
- [ ] Ejecutar `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` y `npm run build`; esperar todos exitosos.
- [ ] Preparar despliegue revisable y desglose de servicios/costos. Publicar cuando el usuario elija la etapa en línea y estén disponibles los accesos necesarios.

Resultado: ejecución automática comprobada en el entorno elegido y documentación de operación.

## 11. Criterios de aceptación del producto

- Noticias tecnológicas reales, en español cuando exista análisis, con fuente, fecha y enlace al original.
- Interfaz blanca con noticias a la izquierda, empresas arriba a la derecha e ideas debajo; flujo completo en móvil.
- Una historia seleccionada actualiza ambas secciones de contexto sin perder la lectura.
- Mismo evento agrupado, fuentes conservadas y reejecución sin duplicados.
- Fotografías atribuibles cuando estén disponibles y permitidas; diseño correcto sin imagen.
- Porcentajes bursátiles procedentes del proveedor, con fecha y período; inferencias explícitas y sin causalidad inventada.
- Oportunidades guardables, con problema, cliente, evidencia, MVP y experimento.
- Sin credenciales de una fuente opcional, la lectura y las otras fuentes siguen funcionando.
- Apertura de página sin regenerar análisis; ejecución parcial o fallida visible; resultados previos accesibles.
- Configuración local reproducible y publicación privada preparada para Vercel.

## 12. Referencias consultadas

Consultadas el 28 de octubre de 2026. Las capacidades y condiciones se deben volver a comprobar al integrar cada proveedor.

- [API oficial de Hacker News](https://github.com/HackerNews/API).
- [RSS oficiales de Ars Technica](https://arstechnica.com/rss-feeds/).
- [Documentación oficial de Product Hunt](https://api.producthunt.com/v2/docs): token y condiciones de uso comercial.
- [Acceso a datos de Reddit](https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data).
- [Precios y acceso de la API de X](https://docs.x.com/x-api/getting-started/pricing).
- [Especificación oficial de Top Stories de NYT](https://github.com/nytimes/public_api_specs/blob/master/top_stories/top_stories_v2.json).
- [Exportación de datos de Yahoo Finance](https://help.yahoo.com/kb/sln2311.html): documenta descarga personal y restricciones; no es evidencia de una API pública de cotizaciones para esta aplicación.
- [Cotizaciones de Alpha Vantage](https://www.alphavantage.co/documentation/#latestprice) y [límites de API](https://www.alphavantage.co/support/).
- [Cron jobs de Vercel: uso, límites y precisión](https://vercel.com/docs/cron-jobs/usage-and-pricing).
- [Vercel Workflows](https://vercel.com/docs/workflows) y [Workflow SDK con Next.js](https://workflow-sdk.dev/docs/getting-started/next).

La disponibilidad operativa y los permisos concretos de WSJ, Yahoo, The Verge y TechCrunch quedan sujetos a la comprobación de sus integraciones; no se promete su funcionamiento por haberlos incluido en esta propuesta.

## 13. Estado comprobado de la implementación local

Validado el 28 de octubre de 2026:

- Aplicación Next.js ejecutándose en modo de producción en `http://127.0.0.1:3001`.
- Interfaz blanca de escritorio y móvil; fotografías de los feeds, búsqueda, filtros, selección contextual, guardados, lectura y biblioteca de ideas con notas.
- Consultas reales exitosas a Hacker News, Ars Technica, The Verge, TechCrunch y WIRED. Una nueva ejecución conserva las noticias existentes sin duplicarlas.
- PostgreSQL integrado con PGlite en `.data/postgres`, para que el modo local no dependa de Docker. Se conserva la opción de PostgreSQL externo con el mismo esquema de Drizzle.
- Proveedor de análisis configurable, presupuesto, caché de análisis y resultados vacíos de ideas. Generación limitada a un lote de hasta tres oportunidades por edición, con resolución de la fuente exacta de la evidencia.
- Adaptador de Alpha Vantage y catálogo de empresas; sin credencial no se presentan precios ni porcentajes ficticios.
- Bloqueos renovables para tareas y rechazo de publicación de una ejecución que perdió su bloqueo. Workflow y cron jobs preparados para el entorno alojado.
- 41 pruebas unitarias y de integración, 10 pruebas de navegación en Chrome de escritorio/móvil, lint, comprobación de tipos y build exitosos.
- Archivo de horario local generado en `.data/local.noticiero.update.plist`; no se instaló un servicio del sistema.

Las credenciales de IA y bolsa no están configuradas, por lo que no se validaron llamadas reales a esos proveedores. Los extractos se muestran en su idioma original hasta activar el análisis. El horario de macOS y Vercel están preparados y documentados, pendientes de activación. Product Hunt, Reddit, X, NYT y WSJ siguen como ampliaciones opcionales.

Instrucciones de arranque, configuración y operación: [README](../../../README.md).
