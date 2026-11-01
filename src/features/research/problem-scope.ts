import { normalizedText, rolePattern } from "./evidence-text";

export type ProblemScope = {
  key: string;
  task: string;
  label: string;
  segment: string;
  product: string;
  domain: string;
};
const tasks: [string, string, RegExp][] = [
  [
    "account-region",
    "Cambiar la región de una cuenta",
    /\b(?:switch|change|cambiar)\b.{0,35}\b(?:account region|region|pais)\b/,
  ],
  [
    "invoice-reconcile",
    "Conciliar facturas y registros",
    /\b(?:invoice\w*|factura\w*)\b.{0,70}\b(?:reconcil\w*|concili\w*|match\w*)\b|\b(?:reconcil\w*|concili\w*|match\w*)\b.{0,70}\b(?:invoice\w*|factura\w*)\b/,
  ],
  [
    "budget-control",
    "Controlar consumo y presupuesto",
    /\b(?:quota|cuota|token\w*|usage|consumo)\b.{0,90}\b(?:cost\w*|coste|budget|presupuesto|burn\w*|exhaust\w*|limit\w*|agot\w*|minut\w*)\b|\b(?:burn\w* through|exhaust\w*|agot\w*)\b.{0,70}\b(?:usage|quota|budget|credits|consumo|presupuesto)\b|\b(?:ai|ia|llm\w*)\b.{0,30}\b(?:costs?|pricing|costos?|presupuesto)\b/,
  ],
  [
    "data-export",
    "Exportar e importar datos",
    /\b(?:export\w*|import\w*|exportar|importar)\b/,
  ],
  [
    "data-integration",
    "Conectar y sincronizar herramientas",
    /\b(?:sync\w*|integrat\w*|sincroni\w*|integracion\w*)\b/,
  ],
  [
    "record-correction",
    "Corregir registros y datos",
    /\b(?:incorrect|inaccurate|dispute|credit report|group=null|getcategories|updatecategory|datos incorrectos|informacion incorrecta|corregir registros)\b/,
  ],
  [
    "workflow-execution",
    "Ejecutar y recuperar automatizaciones",
    /\b(?:workflow\w*|chatbot\w*|automations?|automatizaciones|reintentar|retry|retries)\b/,
  ],
  ["payroll", "Preparar nómina y pagos al personal", /\b(?:payroll|nomina)\b/],
  [
    "inventory",
    "Controlar inventario y existencias",
    /\b(?:inventory|inventario|stock levels|existencias)\b/,
  ],
  [
    "insurance",
    "Gestionar seguros y reclamaciones",
    /\b(?:insurance|seguros?|polizas?)\b/,
  ],
  [
    "meeting-followup",
    "Dar seguimiento a reuniones",
    /\b(?:meetings?|reuniones|reunion|transcri\w*)\b/,
  ],
  [
    "security-workflow",
    "Proteger accesos y procesos",
    /\b(?:security|seguridad|credential\w*|credenciales)\b/,
  ],
  [
    "account-access",
    "Recuperar acceso y autenticación",
    /\b(?:login|log in|sign in|locked out|access.{0,25}account|account.{0,40}(?:blocked|restrict|access)|authenticat\w*|unauthorized|401|403|acceso|entrar.{0,20}cuenta|cuenta.{0,30}(?:bloque|restric)|contrasena|verificacion|verification|secret.{0,10}keys?)\b/,
  ],
  [
    "refund",
    "Gestionar cancelaciones y devoluciones",
    /\b(?:refund\w*|reembolso\w*|devoluci\w*|devolver|cancelacion\w*|cancel(?:led|lation))\b/,
  ],
  [
    "order-tracking",
    "Entregar y localizar pedidos",
    /\b(?:delivery|shipping|shipment|tracking|entrega\w*|envio\w*|paquete\w*)\b|\b(?:order|pedido)\b.{0,45}\b(?:where|status|track|locat|estado|seguimiento|donde)\w*/,
  ],
  [
    "product-repair",
    "Reparar y hacer válida una garantía",
    /\b(?:defect\w*|repair\w*|warranty|reparacion\w*|garantia\w*|averia\w*)\b/,
  ],
  [
    "payments",
    "Cobrar, pagar y aclarar cargos",
    /\b(?:payment\w*|billing|invoice\w*|charge\w*|cobro\w*|pago\w*|factura\w*|transaccion\w*)\b/,
  ],
  [
    "support",
    "Resolver incidencias de soporte",
    /\b(?:support|customer service|ticket|soporte|atencion|reclamacion\w*)\b/,
  ],
  [
    "manual-work",
    "Automatizar un proceso manual",
    /\b(?:manually|manualmente|spreadsheet\w*|copy.{0,12}paste|hoja.{0,12}calculo|copiar.{0,12}pegar|workaround)\b/,
  ],
];

export function problemScope(
  text: string,
  product = "",
  segment = "",
): ProblemScope | undefined {
  const normalized = normalizedText(text);
  if (
    /\b(?:environmental|societal|social|ambiental)\s+cost\w*\b/.test(normalized)
  )
    return;
  const matches = tasks
    .map((task) => ({ task, index: normalized.search(task[2]) }))
    .filter((m) => m.index >= 0);
  const specific = matches.filter(
    (m) => !["manual-work", "payments", "support"].includes(m.task[0]),
  );
  const task = (specific.length ? specific : matches).sort(
    (a, b) => a.index - b.index,
  )[0]?.task;
  if (!task) return;
  const role = normalized.match(rolePattern)?.[0] ?? "";
  const roleKey = /accountant|contador|contable|bookkeeper/.test(role)
    ? "contabilidad"
    : /developer|desarrollador|engineer|ingenier/.test(role)
      ? "desarrollo"
      : /teacher|docente|profesor/.test(role)
        ? "educacion"
        : /shop owner|retailer|comerciante/.test(role)
          ? "comercio"
          : role
            ? role
            : "desconocido";
  const domain = /\b(invoice\w*|factura\w*|accounting|contabilidad)\b/.test(
    normalized,
  )
    ? "facturacion"
    : /\b(payroll|nomina)\b/.test(normalized)
      ? "nomina"
      : /\b(photos?|images?|video\w*|fotograf\w*|fotos?)\b/.test(normalized)
        ? "multimedia"
        : /\b(credit report|reporte.{0,10}credito)\b/.test(normalized)
          ? "reporte-crediticio"
          : "general";
  const provider =
    product ||
    (/\b(?:claude|anthropic)\b/.test(normalized)
      ? "anthropic-claude"
      : /\bfable\b/.test(normalized)
        ? "fable"
        : "desconocido");
  const buyer = normalizedText(segment || roleKey);
  const scope = {
    task: task[0],
    label: task[1],
    segment: buyer,
    product: normalizedText(provider),
    domain,
  };
  return {
    ...scope,
    key: [scope.task, scope.domain, scope.product, scope.segment].join(":"),
  };
}
