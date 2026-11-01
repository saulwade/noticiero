# Portafolio automático y navegación simple — implementación

> **For agentic workers:** Use executing-plans with isolated parallel ownership and independent review before publication. The user approved the redesign in the private proposal section 17 and explicitly authorized production deployment. Do not stop for another design approval.

**Goal:** Abrir Mi portafolio y recibir una propuesta calculada, análisis diario, explicación y registro automático, sin formularios de investigación.

**Architecture:** Next.js conserva identidad, contabilidad y presentación. Un trabajo privado acotado obtiene una entrada validada, ejecuta Python y publica un informe inmutable ligado a la huella de datos. Cotizaciones e históricos usan caché y el presupuesto Alpha Vantage compartido; perfil y dinero permanecen fuera de Git. Lecturas no ejecutan proveedores. Cuatro tablas aditivas conservan perfil, referencias históricas, entradas e informes; se incluyen en respaldo/exportación y límites.

**Tech Stack:** Next.js/TypeScript/PostgreSQL, Python/NumPy/SciPy/scikit-learn en GitHub Actions privado existente, reglas explicables y plantillas en español. Sin API de IA ni broker automático.

## Contratos y responsabilidades

- `src/features/finance/automatic-types.ts`: perfil privado, históricos, entrada Python e informe/vista pública privada. Identificadores/huellas enlazan propuesta y datos conocidos.
- `scripts/finance_quant.py`, `tests/python/test_finance_quant.py`, `requirements-finance.txt`: validación finita, índices ajustados/FX, riesgo y escenarios, asignación inicial/aportación, costes y evidencia contextual, salida JSON determinista. No red ni secretos en Python.
- `src/features/finance/automatic-providers.ts`, tests: Alpha semanal ajustado, cierres y FX histórico con lectura acotada, sesiones válidas, caché, cuota compartida y errores sin claves.
- `src/features/finance/automatic-service.ts`: preparar entrada, bloqueo/huellas, persistir informes, exportar vista acotada. Rechazar salida inválida, futura, obsoleta o no correspondiente a la entrada. No crear movimientos/instrumentos/política aprobada desde una propuesta.
- `scripts/automatic-finance.ts`, `ops/workflows/finance.yml`: ejecutar Python diariamente en runner privado y publicar por ruta de servicio autenticada. Reutilizar secreto operativo existente sin ampliar permisos a terceros. Estado/errores se integran en monitor y avisos privados.
- `src/components/finance-workspace.tsx` y CSS: Mi cartera / Qué hacer y por qué / Movimientos. Desaparecen las tareas obligatorias de tesis y diario. Notas/decisiones anteriores permanecen en archivo/exportación.
- `src/components/dashboard.tsx`: cuatro enlaces principales; Radar dentro de Oportunidades; Entrevistas fuera de navegación y acciones visibles, conservando datos/API.
- `src/db/schema.ts`, backup/capacity, API/export y pruebas: cambios aditivos y restauración de esquema anterior completo.

## Tareas y aceptación

- [x] **1. Contratos y perfil.** Crear tipos comunes. Perfil real solo en archivo ignorado/DB; ningún importe personal o edad en fixtures públicos. Validar capital/aportación/riesgo/costes. Antes de confirmar tolerancia, propuesta provisional explícita con pérdidas ilustrativas, sin dar por aprobada la distribución.
- [x] **2. Datos automáticos.** Validar respuestas Alpha/Frankfurter y cobertura real con la clave existente, sin imprimirla. Usar históricos semanales ajustados y FX de referencia con fechas; distinguir rendimiento total histórico de precio ejecutable. Conservar referencias anteriores ante fallo y marcar lo pendiente.
- [x] **3. Python cuantitativo.** Pruebas de conservación de presupuesto, moneda, redondeo/unidades/costes, no posiciones ficticias, huecos/futuro/no finitos, métricas con muestra suficiente y escenarios reproducibles. Riesgo por covarianza regularizada y contribuciones; bootstrap por bloques con semilla y advertencia de supuestos. Comparar estrategias estables; no usar sentimiento como rendimiento esperado ni afirmar ventaja predictiva validada.
- [x] **4. Persistencia diaria.** Preparación autenticada, ejecución Python acotada y publicación validada/idempotente. Historial automático de análisis con huellas de movimientos/datos. Una operación o actualización de perfil invalida una propuesta previa; un informe no registra una decisión humana. Incluir tablas en backup y monitor.
- [x] **5. UI y navegación.** Cartera propuesta visible sin movimientos; cuando existan, actual/objetivo/propuesta separados. Explicar qué hacer y por qué sin formularios. Mostrar edad/calidad de datos y siguiente revisión. Noticias completas en briefing; evidencia relevante como detalle de decisiones. Radar integrado en Oportunidades. No borrar entrevistas/notas.
- [x] **6. Verificación previa a publicación.** Unit/integración, Python, lint/TypeScript/build y E2E escritorio/teléfono, incluida ausencia de formularios obligatorios y de llamadas al proveedor al abrir. Revisión independiente y correcciones. Respaldo previo; despliegue Vercel autorizado; ejecución real del trabajo Python con datos reales, lectura privada de resultados, captura visual. Respaldo posterior y restauración completa en base temporal, monitor correcto.

## Decisiones metodológicas

La diversificación, estimación de covarianzas y escenarios son técnicas públicas, no una reproducción de estrategias propietarias. Los candidatos iniciales son ETFs amplios y liquidez; el universo debe tener fuente, función y moneda explícitas. Una referencia de deuda USD no equivale a CETES/MXN. La asignación base se mantiene estable; las noticias producen alertas de hipótesis, no una rotación diaria silenciosa. No inferir certeza matemática de ganancias.

Cada informe conserva: perfil/huella, versión, datos y fechas, propuesta inicial y mensual, importes/pesos, costes conocidos o pendientes, escenarios, riesgos, noticias relevantes, explicación, conclusión y condición de próxima revisión. Datos ausentes no son cero. Una métrica histórica no es pronóstico. Las proyecciones condicionales no prometen recuperación.

El usuario consulta briefing a diario y decisiones cuando lo desee. El cálculo corre diariamente, aportaciones se revisan mensualmente y la estrategia trimestralmente o por cambios relevantes; operar requiere decisión y ejecución real fuera de la app. Oportunidades sigue acumulando señales/evidencia sin visitas ni guardado manual.

## Investigación primaria

- Alpha Vantage: https://www.alphavantage.co/documentation/#weeklyadj
- Ledoit–Wolf: https://scikit-learn.org/stable/modules/generated/sklearn.covariance.LedoitWolf.html
- Asignación y rebalanceo: https://www.investor.gov/introduction-investing/getting-started/asset-allocation
- Registrar fuentes oficiales de instrumentos y métodos efectivamente usados en el documento del motor.


## Verificación previa

322 pruebas TypeScript/integración, 37 Python, lint/tipos/build y revisión independiente del motor y servicio correctos. La revisión comprobó además 192 combinaciones de restricciones con un oráculo independiente. Se corrigieron centavos, explicación de costes tras redondeo, inclusión de comisiones/divisa en límites, consistencia de escenarios, propiedad de ejecuciones concurrentes y combinación de cierre de viernes con FX de domingo. Primera ejecución real con perfil privado: 259 retornos semanales, tres proyecciones condicionales y ocho noticias, sin crear posiciones ni movimientos. Respaldo previo 41281194983 correcto. La navegación conserva una suite completa de 36 E2E de escritorio/teléfono después de retirar la vista archivada de entrevistas. El cierre operativo exige Ready, trabajador de nube correcto, respaldo/restauración y monitor. Sus resultados e identificadores se registran en la propuesta privada, sin subir información personal al repositorio.


La versión de motor se comparte entre Python y servidor en `automatic-engine-version.json` y forma parte de la huella de entrada. Un cambio de modelo conserva los informes anteriores y marca lo previo como pendiente de actualización. Las cuentas con movimientos y saldo real cero conservan ese cero en escenarios/proyecciones; no se restaura un capital hipotético.
