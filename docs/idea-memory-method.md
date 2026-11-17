# Memoria de ideas y calidad de evidencia

La investigación automática conserva hipótesis, decisiones atribuidas, vínculos con revisiones de evidencia, consultas de fuentes y evaluaciones sucesivas. No entrena un modelo por guardar documentos ni demuestra intención de compra.

## Flujo automático

Las ediciones existentes llaman `runLocalResearch`, que actualiza la memoria antes de generar los reportes nuevos. Se priorizan las ideas revisadas y se registran hasta cinco grupos específicos nuevos por edición. Hasta cuarenta líneas automáticas se reevalúan por turno, empezando por las pendientes o más antiguas; este presupuesto de trabajo no borra ni limita de por vida el registro histórico.

Las definiciones, decisiones y evaluaciones se insertan sin sobrescribir. Los vínculos conservan cada revisión y la fecha de clasificación. La lectura normal consulta la última evaluación por idea en SQL; el historial completo se obtiene expresamente. Los reportes diarios cerrados anteriores no se reescriben.

## Interpretación de evidencia

- Una noticia es contexto; una estadística no cuenta como persona.
- Una publicación promocional y una cuenta identificada como proveedora no cuentan como demanda independiente. Un enlace a una reproducción o a datos no basta para marcar promoción.
- Se consolidan revisiones de un caso y variantes traducidas de la misma URL. Los expedientes administrativos distintos conservan su identidad aunque compartan la URL del dataset.
- Las comparaciones usan fecha original, captura y revisión por separado. Un expediente antiguo recién importado no es nueva demanda. Un autor que ya aparece en antecedentes no se cuenta como una cuenta nueva por abrir otro caso.
- La versión elegible más reciente sustituye la lectura anterior aunque ya no coincida con la idea. Se retiene el vínculo histórico y se enlaza la transición como contexto o resolución.
- Se agrupa por causa/alcance explícito; los casos de causas distintas no se suman como una sola necesidad. Cuentas, expedientes anónimos, familias de fuentes y procedencia mexicana se muestran aparte.
- Frecuencia, consecuencias, soluciones manuales y menciones de comprador son citas atribuidas. No equivalen a mediciones auditadas, empresas verificadas o presupuesto.

## Vigencia y competencia

Se consultan hasta seis fuentes conocidas por edición, con dos solicitudes simultáneas, ocho segundos por solicitud y 256 KiB decodificados por respuesta. Se reservan turnos para fuentes conocidas vencidas y para descubrimiento, evitando que los enlaces nuevos impidan volver a consultar lo anterior. Páginas de alternativas: como máximo una vez al día; issues: seis horas; errores y rate limits respetan enfriamiento.

Las solicitudes son anónimas a dominios/repositorios explícitos, sin redirecciones ni permisos nuevos. Se conserva cada resultado, incluyendo fallos. Un cambio de documento de competencia sólo pide revisión: no confirma nuevas funciones ni ventas. No es una búsqueda exhaustiva de competidores en toda la web.

Los issues guardan `state_reason` y fecha de comprobación. Un cierre sin motivo no demuestra corrección. `completed` significa resolución declarada por la fuente; falta verificar la versión instalada. Una comprobación antigua no revoca una captura posterior y un fallo temporal no borra el último estado válido. Los casos resueltos siguen en la cola de comprobaciones para detectar reaperturas.

## Revisiones humanas e importación privada

`scripts/import-idea-memory.ts` importa un JSON validado de definiciones y decisiones con URLs de procedencia. Rechaza fechas futuras, fuentes fuera de cobertura, IDs duplicados y modificaciones a filas existentes. Una conclusión posterior se añade con otro ID; no se reemplaza la anterior. Una decisión puede incluir `matchOverride` para afinar criterios conservando la definición original y respetando el corte temporal. Una decisión restrictiva no se revierte automáticamente por volumen de noticias.

Las cuatro ideas revisadas y sus conclusiones se importan desde un archivo privado que no se incluye en Git ni Vercel. Conversaciones nuevas no se incorporan mágicamente: se registra una decisión atribuida en una próxima revisión.

## Lecturas y reportes

- `/api/research/memory`: última evaluación por idea; requiere acceso privado.
- `/api/research/memory?history=1`: hasta cien evaluaciones históricas por página. `historyPage.next` aporta `before` y `beforeId` para continuar sin omitir evaluaciones del mismo instante; todas permanecen en la base y los respaldos.
- `/api/research/memory?format=md`: reporte legible de la memoria.
- `/api/research/brief?days=7`: investigación acumulada y memoria actual para conversar.

El reporte incluye estado de cada idea, evidencia que la apoya o debilita, patrones específicos, ventanas móviles de siete días, alternativas conocidas y consultas pendientes/fallidas. El estado existente muestra contadores, sin nuevas pantallas ni formularios.

## Conservación y costo

Tablas nuevas: `idea_memory`, `idea_journal`, `idea_links`, `idea_source_checks`, `idea_assessments`. Se incluyen en los respaldos cifrados; se mantienen restaurables los formatos históricos de 22, 26, 33, 34, 37, 41 y 43 tablas. El formato completo actual tiene 48 tablas. Sólo se restaura sobre una base vacía.

Se reutilizan Neon, Vercel, los horarios y los respaldos existentes. No hay API generativa, nuevo servicio de pago, plan contratado, operaciones financieras o mensajes automáticos. El almacenamiento sí crece; las alertas de capacidad de la base siguen siendo necesarias. Fallos y cobertura pendiente permanecen visibles y no se presentan como validación completa.
