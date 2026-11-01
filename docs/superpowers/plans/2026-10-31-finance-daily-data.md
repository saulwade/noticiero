# Fase 2A: precios diarios y USD/MXN automáticos

> **For agentic workers:** Use executing-plans to implement this approved extension task-by-task. Keep private account data out of this public document.

**Goal:** Actualizar referencias financieras diariamente sin depender de la laptop, sin servicios de pago y sin crear posiciones o movimientos ficticios.

**Architecture:** Reutilizar la actualización durable de mañana/noche. Una etapa financiera independiente guarda observaciones inmutables y estado por fuente; sus fallos no impiden publicar noticias. Frankfurter v2 proporciona USD/MXN de referencia sin clave. Alpha Vantage GLOBAL_QUOTE proporciona cierres de instrumentos USD de mercados estadounidenses explícitamente admitidos, cuando exista una clave gratuita configurada; comparte el contador máximo de veinte peticiones UTC con el panel de noticias. La consulta de mañana recupera el cierre previo y la nocturna el cierre del día, con deduplicación por sesión y enfriamiento de seis horas ante intentos fallidos. Las fuentes nunca leen movimientos, saldos o notas.

**Tech Stack:** Next.js 16, TypeScript, PostgreSQL/PGlite, Workflow, Vitest y Playwright. Sin nueva dependencia de ejecución ni worker Python.

## Decisiones y límites

- Frankfurter: `https://api.frankfurter.dev/v2/rate/USD/MXN`, mezcla publicada por el proveedor, fecha propia, sin llamarlo FIX de Banxico o tipo ejecutado por GBM. No usar su tasa para reemplazar conversiones históricas reales.
- Alpha Vantage: URL fija y símbolo validado, API key solo servidor. Máximo ocho instrumentos, USD, stock/ETF y mercados NASDAQ/NYSE/NYSEARCA/AMEX; BMV/SIC y bonos continúan manuales para no confundir moneda o listado. Símbolo devuelto debe coincidir; ningún precio cero, futuro o de sesión imposible se acepta.
- Calendario estadounidense con festivos regulares, observancia de Año Nuevo, Juneteenth desde 2022, NY timezone/DST y cierre temprano. Datos de cierre se consultan después de las 20:00 Nueva York para dar margen al proveedor EOD. La mañana puede recuperar una sesión pendiente. No se prometen cierres extraordinarios no anunciados en el calendario.
- FX y cada instrumento conservan último intento, éxito, fecha de observación y mensaje seguro. La interfaz lee el estado; abrir la pantalla no llama proveedores. Si faltan clave o cobertura se ve claramente. Reintentos, concurrencia y cuotas no crean duplicados ni borran referencias manuales.
- Una tabla `finance_sync` conserva estado operativo; los respaldos pasan a 34 tablas y siguen aceptando snapshots completos de 22/26/33. Referencias hasta 20,000 y archivo 50 MB, sin borrar historial ni contratar capacidad.
- No se registran aportaciones, instrumentos o compras en la cuenta real. No se conectan brokers. No se cambia automáticamente la política ni se vende por noticias.
- El resto de fase 2 (históricos de rendimiento total, modelos de idioma/sentimiento y seguimiento simulado de semanas) conserva su estado pendiente.

## Tareas de implementación y prueba

- [x] **1. Proveedor/calendario puros.** Crear `src/features/finance/daily-providers.ts` y `market-calendar.ts`, tests en `tests/finance-daily-providers.test.ts`. Validar forma, pares, sesión, finitud/positividad, cuerpo máximo 64 KiB, timeout 12 s y sin redirects. Comprobar viernes→fin de semana, festivos, DST, fechas imposibles, símbolos incorrectos, cuota y payload incompleto. Primero tests fallidos y luego implementación.
- [x] **2. Cuota y sincronizador.** Crear `src/features/finance/daily-sync.ts` y tests aislados `tests/finance-daily-sync.test.ts`. Reserva atómica por objetivo/sesión antes de red; lock corto, llamadas fuera de transacción y persistencia con lock financiero. Contador compartido `quote:YYYY-MM-DD` máximo 20, caché reutilizable del panel. Guardar observaciones por hash de proveedor/objetivo/sesión/valor sin sobreescribir versiones. Repetir un lote no duplica; fallo individual no aborta los demás. Reintento respeta cooldown, no usa fallback inventado.
- [x] **3. Persistencia y respaldo.** Añadir `FinanceSyncState`, tabla y migración aditiva; ampliar backup y validación legacy sin aceptar esquemas mezclados. Leer estado en GET financiero privado; exportarlo. Ampliar el límite de referencias de forma explícita. Probar captura/restauración del esquema de 34 tablas y compatibilidad con 33.
- [x] **4. Programación y alertas.** Integrar etapa financiera en `src/workflows/update-edition.ts` y actualización local, conservando cron existente. Manejar fallos del módulo de manera aislada y comprobarlos en `src/features/operations/service.ts`; el monitor de GitHub existente avisará de fallos reales, sin inventar mensajes por mercado cerrado.
- [x] **5. Interfaz y guía.** Componente pequeño `src/components/finance-daily-status.tsx`, sin nuevo botón por cotización: fecha, proveedor, cobertura y última actualización. Detalle desplegable para incidencias y guía de primer uso/mensual/revisión. Estado inicial sin urgencia de registrar dinero. Documentar proceso de aportaciones en el plan privado, sin publicar cifras personales en UI ni repositorio.
- [x] **6. Verificación previa de entrega.** Ejecutar `npm test`, `npm run lint`, `npm run typecheck`, las pruebas Python, `npm run build` y `npm run test:e2e`. Smoke público de FX y cotización con clave propia si está disponible; nunca considerar demo equivalente a producción. Confirmar secretos fuera de diff y preservar regresiones de noticias/oportunidades. Registrar resultados y bloqueos de credenciales honestamente.

## Fuentes verificadas

- https://frankfurter.dev/ — API v2, mezcla, almacenamiento permitido, uso gratuito y prevención de abuso.
- https://www.alphavantage.co/support/ — 25 peticiones diarias gratuitas; límite local compartido de 20 deja margen.
- https://www.alphavantage.co/documentation/ — GLOBAL_QUOTE EOD, las modalidades intradía reguladas quedan fuera.
- https://www.investor.gov/introduction-investing/getting-started/asset-allocation — horizonte/riesgo, diversificación y rebalanceo con nuevas aportaciones.


## Verificación local y revisión

230 pruebas de lógica/integración, 8 de Python y 30 E2E de escritorio/teléfono pasaron; lint, TypeScript y build Webpack correctos. Revisión independiente sin bloqueos después de corregir recuperación nocturna de FX cuando la mañana devuelve un dato anterior, y normalización compartida de claves demo/blancas. Los datos completos de precio se reutilizan en el panel únicamente cuando cambio y porcentaje proceden del proveedor; no se inventan variaciones. Los registros financieros permanecen independientes.

Prueba pública real Frankfurter correcta por fecha CDMX. Clave gratuita propia emitida con aprobación del usuario y prueba real de GLOBAL_QUOTE de IBM correcta para la sesión 2026-10-30, incluyendo precio, cambio y porcentaje genuinos. El smoke no creó posiciones ni movimientos. La clave se configura como secreto sensible de servidor; no se publica su valor. El cierre de producción se registra en el plan privado para evitar publicar datos de cuenta o credenciales.


## Condición de publicación

Respaldo previo confirmado, publicación por Git, Ready, interfaz real y ciclo automático; luego respaldo posterior y restauración temporal comparada. El registro de esos resultados se mantiene en el plan privado. La programación automática conserva los horarios existentes; la cuenta real permanece vacía hasta que el usuario acuerde su portafolio inicial.
