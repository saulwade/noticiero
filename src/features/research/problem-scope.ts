import { normalizedText, rolePattern } from "./evidence-text";

export type ProblemScope = {
  key: string;
  task: string;
  label: string;
  segment: string;
  product: string;
  domain: string;
  mechanism?: string;
};
/** These generic words preserve an observation but cannot establish a shared job. */
export function isSpecificScope(scope: ProblemScope) {
  return (
    !["support", "manual-work"].includes(scope.task) &&
    !(scope.task === "payments" && scope.domain === "general")
  );
}
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
    "workflow-loop",
    "Evitar bucles y ejecuciones repetidas",
    /\b(?:infinite loop|endless loop|repeat message|bucle infinito|bucle sin fin)\b/,
  ],
  [
    "unexpected-trigger",
    "Evitar activaciones sin una solicitud",
    /\b(?:trigger\w*|dispar\w*)\b[\s\S]{0,100}\b(?:without|sin)\b/,
  ],
  [
    "missed-notification",
    "Recibir notificaciones sin omisiones",
    /\b(?:email\w*|notification\w*|correo\w*|notificaci\w*)\b[\s\S]{0,90}\b(?:not detected|miss\w*|no detect\w*|no recib\w*)\b|\b(?:miss\w*|not detect\w*)\b[\s\S]{0,60}\b(?:email\w*|notification\w*)\b/,
  ],
  [
    "api-contract",
    "Adaptar parámetros y contratos de APIs",
    /\b(?:unsupported parameter|invalid payload|incompatible schema|parametro no soportado|parametro no admitido)\b/,
  ],
  [
    "timezone-conversion",
    "Corregir conversiones de zonas horarias",
    /\b(?:invalid timezone|timezone conversion|zona horaria invalida|conversion de zona horaria)\b/,
  ],
  [
    "runtime-resources",
    "Reducir consumo excesivo de recursos",
    /\b(?:cpu|memory|memoria)\b[\s\S]{0,90}\b(?:usage|overhead|cost|excess\w*|consumo)\b|\b(?:excessive|high|sustained|excesivo)\b[\s\S]{0,60}\b(?:cpu|memory|memoria)\b/,
  ],
  [
    "workflow-recovery",
    "Recuperar ejecuciones fallidas",
    /\b(?:retry|retries|recover\w*|re-?queu\w*|reintent\w*|recuperar)\b[\s\S]{0,60}\b(?:workflow\w*|jobs?|ejecucion\w*|tareas?)\b/,
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

// Mechanisms require explicit text. Co-mentioning a vendor does not establish
// that two people encountered the same failure or need the same intervention.
const mechanisms: [string, string, string, RegExp][] = [
  [
    "credential-rotation",
    "account-access",
    "Recuperar acceso y autenticación",
    /\b(?:password|credential|contrasena)\b.{0,30}\b(?:rotation|rotat\w*|cambio)\b|\brotat\w*\b.{0,30}\b(?:password|credential|contrasena)\b/,
  ],
  [
    "custom-role-pooler",
    "account-access",
    "Recuperar acceso y autenticación",
    /\b(?:custom|restricted)\b.{0,45}\b(?:role|roles)\b[\s\S]{0,100}\b(?:supavisor|pooler)\b|\bsupavisor\b.{0,60}\bcustom\b/,
  ],
  [
    "pam-authentication",
    "account-access",
    "Recuperar acceso y autenticación",
    /\bpam\s+authentication\b/,
  ],
  [
    "jwt-validation",
    "account-access",
    "Recuperar acceso y autenticación",
    /\bpgrst303\b|\bjwt\b.{0,60}\b(?:reject\w*|validat\w*|claim\w*)\b/,
  ],
  [
    "extension-ownership",
    "security-workflow",
    "Proteger accesos y procesos",
    /\bspatial_ref_sys\b/,
  ],
  [
    "row-security-write",
    "account-access",
    "Recuperar acceso y autenticación",
    /\brls\b.{0,50}\b(?:policy|policies|insert|writes?)\b|\brow.level security\b/,
  ],
  [
    "backup-vpn",
    "data-integration",
    "Conectar y sincronizar herramientas",
    /\b(?:vpn|unmetered)\b[\s\S]{0,150}\b(?:backup|sync|connection)\b|\b(?:backup|sync)\b[\s\S]{0,150}\bvpn\b/,
  ],
  [
    "backup-background",
    "data-integration",
    "Conectar y sincronizar herramientas",
    /\b(?:background|segundo plano)\b.{0,80}\b(?:backup|upload|sync)\b|\b(?:backup|sync|upload)\b[\s\S]{0,200}\b(?:minimize|background|app.{0,15}closed)\b/,
  ],
  [
    "backup-cellular-policy",
    "data-integration",
    "Conectar y sincronizar herramientas",
    /\bbackup\b[\s\S]{0,140}\bcellular\b/,
  ],
  [
    "queue-persistence",
    "workflow-recovery",
    "Recuperar ejecuciones fallidas",
    /\bredis\b[\s\S]{0,250}\b(?:volume|persist\w*)\b/,
  ],
  [
    "missing-job-retry",
    "workflow-recovery",
    "Recuperar ejecuciones fallidas",
    /\b(?:no retry|no retries|without retry|silently dropped)\b/,
  ],
  [
    "deposit-return",
    "refund",
    "Recuperar depósitos y anticipos",
    /\b(?:devolucion de deposito|devolver.{0,20}(?:deposito|anticipo)|deposit refund|return.{0,15}deposit)\b/,
  ],
  [
    "goods-return",
    "refund",
    "Gestionar cambios y devoluciones",
    /\b(?:cambio o devolucion|return.{0,20}(?:goods|merchandise)|product refund)\b/,
  ],
  [
    "contract-cancellation",
    "refund",
    "Gestionar cancelaciones de contratos",
    /\b(?:rescision del contrato|cancelacion.{0,20}contrato|contract cancellation)\b/,
  ],
  [
    "warranty-refusal",
    "product-repair",
    "Hacer efectiva una garantía",
    /\b(?:hacer efectiva la garantia|warranty.{0,30}(?:refus\w*|denied))\b/,
  ],
  [
    "repair-quality",
    "product-repair",
    "Corregir reparaciones deficientes",
    /\b(?:deficiencia en la reparacion|faulty repair|poor repair)\b/,
  ],
  [
    "unsolicited-product",
    "order-tracking",
    "Aclarar productos no solicitados",
    /\b(?:producto o servicio no solicitado|unsolicited product)\b/,
  ],
  [
    "credit-identity",
    "record-correction",
    "Corregir información crediticia ajena",
    /\binformation belongs to someone else\b/,
  ],
  [
    "credit-status",
    "record-correction",
    "Corregir el estado de una cuenta",
    /\baccount status incorrect\b/,
  ],
  [
    "credit-values",
    "record-correction",
    "Corregir datos de una cuenta",
    /\baccount information incorrect\b/,
  ],
  [
    "credit-investigation",
    "record-correction",
    "Dar seguimiento a correcciones crediticias",
    /\binvestigation\b.{0,60}\b(?:problem|error|fix)\b/,
  ],
  [
    "debt-not-owed",
    "record-correction",
    "Aclarar cobros de deuda ajena",
    /\b(?:debt not owed|debt is not yours)\b/,
  ],
  [
    "debt-collection-threat",
    "payments",
    "Aclarar prácticas de cobranza",
    /\b(?:threatened|threats?)\b.{0,80}\b(?:credit|legal|action)\b/,
  ],
];

export function problemScope(
  text: string,
  product = "",
  segment = "",
): ProblemScope | undefined {
  const normalized = normalizedText(text);
  const mechanismText = normalized
    .split(/;|\n|\b(?:but|although|even though|however|pero|aunque)\b/)
    .filter(
      (clause) =>
        !/\b(?:ruled out|not caused by|not due to|unrelated to|not related to|there (?:was|is) no|(?:we|i) (?:do|did) not (?:use|change|rotate)|not using|no password rotation|no credential rotation|no hubo|no usamos|descartamos)\b/.test(
          clause,
        ),
    )
    .join(" ");
  const mechanism = mechanisms.find((m) => m[3].test(mechanismText));
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
  const rootCauses = specific.filter((m) =>
    [
      "workflow-loop",
      "unexpected-trigger",
      "missed-notification",
      "api-contract",
      "timezone-conversion",
      "runtime-resources",
      "workflow-recovery",
    ].includes(m.task[0]),
  );
  const task = mechanism
    ? ([mechanism[1], mechanism[2], mechanism[3]] as const)
    : (rootCauses.length
        ? rootCauses
        : specific.length
          ? specific
          : matches
      ).sort((a, b) => a.index - b.index)[0]?.task;
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
    ...(mechanism ? { mechanism: mechanism[0] } : {}),
  };
  return {
    ...scope,
    key: [
      scope.task,
      scope.domain,
      scope.product,
      scope.segment,
      ...(mechanism ? [mechanism[0]] : []),
    ].join(":"),
  };
}
