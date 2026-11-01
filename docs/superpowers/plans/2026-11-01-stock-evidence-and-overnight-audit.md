# Investigación automática de acciones y auditoría nocturna

> **For agentic workers:** Use executing-plans and independent requesting-code-review before publication. The user explicitly authorized overnight implementation, browser tests and production publication. Continue within that scope without another approval gate. Keep private account details outside Git.

**Goal:** Explicar exposiciones empresariales directas e indirectas con evidencia y fundamentales automáticos, y corregir los casos límite del motor de cartera sin añadir formularios ni pestañas.

**Architecture:** El servidor prepara emisores y relaciones documentadas a partir del archivo financiero, obtiene una muestra acotada de SEC con caché y conserva esas observaciones en el archivo existente. Python recibe esa captura inmutable junto con históricos ajustados; produce métricas comparables y preguntas falsables, separadas de la asignación estratégica. No incorpora acciones individuales al objetivo sin evaluación y decisión humana. Sin API de IA ni servicio nuevo.

**Tech Stack:** Next.js 16, TypeScript, PostgreSQL JSONB, Python 3.12/NumPy/scikit-learn, SEC EDGAR y Alpha/Frankfurter existentes. Leer guías instaladas de Next antes de cambios; ya revisadas data-security y route-handlers.

## Alcance y decisiones

Se conserva la cartera estable y se añade investigación explicable de acciones. Se descartan dos alternativas para esta entrega: un predictor diario sin evaluación temporal y un proveedor comercial de grafo corporativo. El grafo inicial tendrá fuentes primarias fechadas y condiciones de aplicación; no asumirá que todas las empresas de un sector son proveedores entre sí. Una relación no determina dirección de cotización. Las adquisiciones históricas no se presentan como noticia nueva ni las marcas privadas como acciones cotizadas.

## Tareas

- [x] **1. Auditar y corregir invariantes cuantitativas.** Revisar `scripts/finance_quant.py`, `automatic-validation.ts` y pruebas. Aplicar límites deterministas sin históricos, abstenerse de cantidades/compra con riesgo no calculable, detectar desvíos reales sin aportación, conservar estados compatibles y bloquear proyecciones sin muestra. Añadir casos Python y TS que fallen antes del arreglo; ejecutar `.data/finance-venv/bin/python -m unittest discover -s tests/python` y `npx vitest run tests/finance-automatic-service.test.ts`.
- [x] **2. Emisores y relaciones.** Crear catálogo financiero independiente de la selección de cotizaciones del briefing, con identidad SEC/ticker/mercado comprobada y relaciones proveedor/cliente/marca documentadas. Añadir emisores directos a fichas de noticias sin confundirlos con exposición indirecta. Probar límites de palabra, fuentes futuras, tema no relacionado, rumores/negación y marcas sin ticker.
- [x] **3. Preparación automática.** Crear servicio de investigación de acciones con hasta seis candidatos, máximo tres consultas de fundamentales por ciclo (SEC y alternativa Alpha INCOME_STATEMENT documentada), caché de siete días y enfriamiento de errores; priorizar vías indirectas sin afirmar tamaño o infravaloración. Conservar versiones en `finance_research`, sin crear instrumentos ni operaciones. Capturar procedencia, datos faltantes y candidatos en `finance_automation_inputs`. Fuentes fallidas conservan el archivo y se muestran pendientes; GET nunca llama proveedores. Presupuesto conjunto y 41 tablas de respaldo se mantienen.
- [x] **4. Fundamentales Python.** Calcular márgenes y flujo operativo menos inversión solo para períodos, monedas y fechas compatibles. Comparaciones interanuales solo con períodos comparables; ausencia no es cero. Mostrar hechos usados, preguntas y escenarios cualitativos contradictorios; no inventar P/E, valor razonable, probabilidades ni rentabilidad esperada. Validar identidad y procedencia contra la entrada congelada al publicar.
- [x] **5. Evidencia estadística y evaluación.** Mostrar limitaciones reales del modelo e incluir comprobación temporal del riesgo con ventanas pasadas y siguiente bloque, contra baseline explícito. No optimizar parámetros sobre la muestra futura ni llamar precisión predictiva a pruebas sintéticas. Incorporar histórico individual únicamente dentro de cuota y con muestra suficiente; señalar lo no disponible.
- [x] **6. Interfaz limpia.** Una sección desplegable dentro de Qué hacer y por qué para empresas relacionadas y fundamentos, sin nuevos enlaces principales. Fecha/hora CDMX en actualización; distinguir riesgo objetivo y real si corresponde. Pruebas de navegación, desbordamiento móvil y ausencia de proveedores en lecturas.
- [ ] **7. Cierre real.** Revisiones independientes, suite completa app/Python/E2E, lint/tipos/build, respaldo previo, push autorizado a main y Ready en Vercel, ejecución real de worker, revisión visual en navegador, monitor, respaldo posterior y restauración canónica de todas las filas. Reporte privado `.data/private/2026-11-01-noticiero-reporte-nocturno.md`, con realizado/limitaciones y flujo. Revisión matutina única programada a las 08:30 CDMX.

## Fuentes primarias revisadas

- SEC APIs/fair access: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- Identidad CIK/ticker/mercado: https://www.sec.gov/files/company_tickers_exchange.json
- Celestica/Google TPU: https://celestica.gcs-web.com/news-releases/news-release-details/celestica-announces-fourth-quarter-and-fy-2025-financial-results
- Nebius/Microsoft: https://nebius.com/newsroom/nebius-announces-multi-billion-dollar-agreement-with-microsoft-for-ai-infrastructure
- Amazon/Astera: https://www.sec.gov/Archives/edgar/data/1736297/000110465926012606/tm265461d1_8k.htm
- NVIDIA/energía/refrigeración: https://nvidianews.nvidia.com/news/european-ecosystem-builds-worlds-most-efficient-ai-factories-with-nvidia-dsx
- Crocs/HEYDUDE (histórico 2022): https://www.sec.gov/Archives/edgar/data/1334036/000133403622000014/exhibit991pressrelease21722.htm

## Criterios de cierre

No prometer completar investigación financiera universal, estrategias propietarias ni rentabilidad validada. Entregar funcionalidad automática utilizable, corregir errores comprobados y documentar honestamente cobertura, incertidumbre, cuotas y siguientes mejoras que requieran evidencia futura.

## Verificación previa a publicación

343 pruebas de aplicación/integración, 59 Python, 38 E2E completos de escritorio/teléfono, lint, tipos y build correctos. Revisiones independientes de cuantitativo y persistencia sin bloqueos después de corregir ausencia de historia, desvíos sin aportación, saldo cero, contratos de estados/proyecciones, tiempos e identidad de históricos, abstenciones de evaluación temporal y rollback/idempotencia. Dos feeds nuevos verificados en vivo y resultados Alpha de un emisor comprobados sin datos personales ni nuevos proveedores. Respaldo previo 41287367068 correcto. La publicación, ejecución real y recuperación posterior cierran la tarea 7.
