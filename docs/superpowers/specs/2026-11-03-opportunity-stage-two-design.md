# Segunda etapa: calidad y acumulación de evidencia

El usuario aprobó el 3 de noviembre evaluar 100 ejemplos reales, mejorar agrupaciones y comparación semanal, y ampliar evidencia local gratuita. Aclaración posterior: dejar acumular hasta el domingo 8; todavía no elegir negocio, preparar entrevistas ni contactar personas. Se mantienen investigación en segundo plano, UI simple, portafolio intacto y conservación de datos.

## Diseño aprobado y decisiones de implementación

Se prioriza un motor local medible sobre añadir volumen sin control o contratar un modelo generativo. Reglas explícitas con evaluación reproducible permiten corregir atribución, ofertas laborales, causas distintas y fechas, conservando las citas originales. Más fuentes por sí solas no validan demanda; un modelo nuevo queda fuera del alcance.

1. Evaluación fija de 100 observaciones públicas reales ES/EN: citas, URL, fecha, criterio de etiqueta y partición de ajuste/comprobación. Etiquetas revisadas por agente; no son entrevistas ni un estudio humano independiente. Reportar matriz de confusión, precisión, cobertura y omisiones. Incluir textos que el detector no aceptó, estadísticas, ofertas laborales y casos conciliados. La meta 85% no es una afirmación de precisión universal ni permite ocultar errores. No cambiar etiquetas para aprobar la métrica.
2. Separar contenido editorial/reclutamiento de experiencia operativa y mantener causa, tarea, producto y segmento en agrupaciones. Un fallo JWT, una política RLS, rotación de credenciales y una conexión PAM no son el mismo problema por compartir Supabase. Una reparación, una devolución de mercancía y un depósito tienen mecanismos distintos. Resolver/conciliar es evidencia de resolución del caso, no demanda activa. Texto original y reportes cerrados permanecen.
3. Comparación de ventanas de 7/30/90 días: primera captura de un caso, nuevas versiones, antecedentes, fechas originales, autores nuevos/conocidos, casos resueltos y problemas sin nueva observación. Etiquetar cobertura histórica insuficiente; no inferir crecimiento de mercado ni abandono porque haya menos capturas. Los informes automáticos y la exportación existente incorporan el balance; sin añadir pantallas/botones.
4. Evidencia mexicana: cambiar la cabecera PROFECO de identificador a fecha y validar estrictamente calendarios. Muestra real devuelve septiembre/octubre, además de cinco fechas futuras corruptas que deben rechazarse. Conservar recorrido histórico anterior y versionar el cursor para el nuevo orden. Verificar telecomunicaciones como recurso adicional oficial gratuito: esquema, atribución, licencia, fechas y presupuesto antes de habilitar. Si sólo aporta antecedentes, declararlo. Ninguna fuente que necesite acceso nuevo se activa.

## Persistencia y límites

Cambios aditivos en tipos JSON, sin borrar tablas/filas ni reescribir reportes cerrados. Evidencia versionada conserva fuente, identidad oficial del caso, publicación y captura. Dos recursos de PROFECO pertenecen a la misma familia y no se presentan como fuentes independientes; un expediente compartido no crea dos casos. Se mantienen las cuotas por ciclo, seis horas, Retry-After y máximo de bytes. No descargar CSV completos ni ampliar planes.

## Criterios de cierre

Dataset y métricas auditables; regresiones de contenido/agrupación y fechas; pruebas de cronología/versiones/autores/resoluciones; suite de aplicación, lint/tipos/build y E2E. Revisión independiente antes de publicar. Copia cifrada previa y posterior, Vercel Ready, actualización real y consultas de sólo lectura prueban persistencia y conservación. Explicar las limitaciones que queden. La evaluación comercial se retoma después del corte del domingo, sin programar contactos o tareas nuevas.
