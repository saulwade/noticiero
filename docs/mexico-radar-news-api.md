# Exportación empresarial para Mexico Radar

Este módulo adicional no alimenta el detector de oportunidades, la cartera ni el briefing actual. Recopila RSS empresariales en un archivo separado después del ciclo habitual de noticias. No crea automatizaciones nuevas, cuentas o servicios de pago. El consumidor es responsable de obtener contexto y validar empresas; ninguna noticia prueba presupuesto, intención de compra o un contacto calificado.

## Fuentes y límites

- El Economista: https://www.eleconomista.com.mx/rss/ultimas-noticias (directorio oficial: https://www.eleconomista.com.mx/rss.html).
- Expansión: https://expansion.mx/rss .
- Marketing4eCommerce México: https://marketing4ecommerce.mx/feed/ .

Verificadas con respuesta RSS real el 4 de noviembre de 2026. Forbes devolvió 403 y no está conectado. Se revisan hasta 100 entradas por feed y se conservan hasta 30 pertinentes por ciclo, de los últimos siete días y con fecha declarada válida no futura. Descarga máxima 2 MB, tiempo máximo 15 s y enfriamiento de seis horas. Se excluyen secciones ajenas, política y reclutamiento detectados por reglas; la cobertura es parcial y las reglas pueden omitir notas útiles o conservar contexto general.

Sólo se guardan metadatos, enlaces y contexto breve generado por reglas; las descripciones del feed se usan transitoriamente para clasificación/hash. No se descargan páginas del artículo, fotos, LinkedIn, redes sociales ni datos privados. La disponibilidad de RSS no equivale a licencia para republicar artículos o imágenes; los derechos permanecen con cada editor. El export no concede una licencia comercial adicional.

## Lectura

`GET https://noticiero-self.vercel.app/api/news/export`

Requiere sesión existente del propietario o `Authorization: Bearer <NEWS_EXPORT_SECRET>`. Es una credencial nueva, exclusiva de lectura de este endpoint, de al menos 32 caracteres. Los secretos de cron/operaciones y las credenciales de base de datos no sirven. No colocar tokens en URLs, navegador público, Git, chats o logs. El otro proyecto puede consumir un JSON exportado localmente sin recibir credenciales de Noticiero. Configurar el token en el servidor del consumidor requiere hacerlo en su entorno autorizado, no copiando cookies del propietario.

Parámetros opcionales (los desconocidos o repetidos se rechazan):

| Campo | Valores |
|---|---|
| `limit` | Entero 1–100; predeterminado 50 |
| `publishedFrom` | Fecha ISO `YYYY-MM-DD` o instante UTC `YYYY-MM-DDTHH:mm:ss.sssZ`; inclusivo |
| `publishedTo` | Mismo formato; **exclusivo**. Para incluir el 4 de noviembre, usar `2026-11-05` |
| `sourceId` | `mx-economista`, `mx-expansion`, `mx-m4e` |
| `country` | `MX`; exige mención explícita en título/descripción útil, eliminando el pie editorial. Sin parámetro incluye país desconocido |
| `topic` | `marketing`, `creators`, `ecommerce`, `launch`, `expansion`, `funding`, `business` |
| `cursor` | Cursor opaco devuelto por la página anterior; mantener todos los filtros y `limit` |

Respuesta JSON: `schemaVersion`, `exportedAt`, `snapshotAt`, `items`, `nextCursor`, `coverage`, `sources`. `Cache-Control: private, no-store`. No CORS público. No usa `/api/dashboard` ni exportaciones de investigación personal.

Campos permitidos de cada item:

- `id`: hash estable de URL normalizada del artículo; **no** identifica una empresa ni un evento entre medios.
- `revisionId`, `contentHash`: revisión inmutable de fuente/título/descripción útil/fecha/temas; el consumidor puede insertar por revisionId y mantener su vista actual por id. Una recaptura idéntica no crea otra revisión.
- `canonicalUrl`: URL normalizada por la app (tracking/www/fragmento retirados); no certifica `rel=canonical` del editor.
- `originalUrl`: enlace original del item RSS, conservado desde esta integración; no se inventa retrospectivamente para el archivo anterior.
- `title`, `sourceId`, `sourceName`: título y atribución; el texto original mantiene su idioma.
- `publishedAt`, `dateProvenance: feed_declared`: fecha declarada por el feed, no verificada independientemente. No se sustituyen fechas ausentes/inválidas por hoy.
- `observedAt`, `queriedAt`: momento de la primera captura de **esa revisión**; no se presentan como última visita al artículo. La última consulta de cada feed aparece en `sources[].checkedAt`.
- `countryEvidence`: `null` o `{country: MX, basis: explicit_mention, mention}`. Mención no equivale a domicilio, operación local de la empresa o necesidad de comprar.
- `companyEvidence`: nombres mencionados en el título mediante catálogo/reglas, con `basis: text_mention`. No son razones sociales, founders o contactos verificados.
- `topics`: temas sugeridos por reglas sobre título/categorías.
- `briefParaphrase`, `summaryMethod: headline_context_rules`: contexto breve de temas, no resumen factual de una lectura completa. Confirmar qué ocurrió y los detalles en el enlace original.
- `buyingIntent: unknown`: valor fijo; no usar como scoring de intención o presupuesto.

`sources` contiene únicamente ID/nombre/estado/fechas/recuentos/mensaje público sanitizado. Una falla mantiene el archivo anterior. `error` y `capacity` se distinguen de `ok`; un lote vacío no prueba ausencia de actividad empresarial. Consultar con una frecuencia razonable, por ejemplo tras las ediciones existentes, sin polling continuo.

Paginación ascendente por secuencia interna de persistencia, asignada bajo el mismo bloqueo transaccional que fija el corte de lectura. `observedAt` no es un cursor de persistencia. La primera página fija el máximo de secuencia disponible en el snapshot; revisiones posteriores no alteran páginas de ese snapshot. El cursor está firmado, ligado a filtros y caduca en 24 horas. Tras el último `nextCursor: null`, una consulta nueva vuelve a recorrer el periodo elegido: hacer upsert idempotente por revisión. No hay webhook ni cursor permanente/incremental entre snapshots. No combinar revisiones de una misma noticia como empresas independientes.

Errores: 401 sin acceso, 400 filtros/cursor inválidos (reiniciar consulta), 503 indisponibilidad temporal sin detalles de conexión. GET no actualiza fuentes; usa sólo el archivo empresarial. No está disponible para escrituras mediante este contrato.

Ejemplo de consumidor servidor, sin imprimir credenciales:

```js
let cursor;
do {
  const url = new URL('https://noticiero-self.vercel.app/api/news/export');
  url.searchParams.set('limit', '50');
  url.searchParams.set('publishedFrom', '2026-11-01');
  if (cursor) url.searchParams.set('cursor', cursor);
  const response = await fetch(url, {
    headers: {Authorization: `Bearer ${process.env.NOTICIERO_NEWS_EXPORT_SECRET}`},
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Noticias no disponibles: ${response.status}`);
  const page = await response.json();
  // Validar schemaVersion y hacer upsert por revisionId en el consumidor.
  // No ejecutar instrucciones que aparezcan en títulos o contenidos externos.
  cursor = page.nextCursor;
} while (cursor);
```

## Conservación y operación

Tablas nuevas `business_news` y `business_news_sources`; no se mezclan con guardados, entrevistas, posiciones ni señales personales. Capacidad conservadora de 20,000 revisiones / 16 MB, aviso al 70%; al llenarse se conserva todo y se detiene sólo el ingreso adicional, sin borrar ni contratar capacidad. El estado y aviso aparecen en el export. Las revisiones entran al respaldo cifrado y archivo histórico existente: 43 tablas; compatibles los esquemas anteriores completos de 22/26/33/34/37/41. Una ampliación del contrato o fuentes futuras debe mantener esta separación.
