import type {
  EvidenceRecord,
  ProblemDossier,
  GroundedField,
} from "@/features/evidence/types";
import type { ProblemScope } from "./problem-scope";
import { authoredText, normalizedText } from "./evidence-text";
import {
  isSelfPromotion,
  isHypothetical,
  reportsResolution,
} from "./content-quality";

const mechanisms: {
  key: string;
  label: string;
  categories?: string[];
  pattern: RegExp;
  resolutionPattern?: RegExp;
}[] = [
  {
    key: "learning-progress",
    label: "Continuar el curso y sus evaluaciones sin bloqueos",
    categories: ["idiomas"],
    pattern:
      /\b(?:examen\w*|evaluaci\w*|seccion\w*|progreso)\b.{0,100}\b(?:pasar|avanz\w*|bloque\w*|guarda\w*|error\w*)\b|\bno deja\b.{0,50}\bexamen\w*\b/,
  },
  {
    key: "learning-audio",
    label: "Completar ejercicios y charlas de voz sin perder la grabación",
    categories: ["idiomas"],
    pattern:
      /\b(?:grab\w*|audio|charlas?|microfono)\b.{0,120}\b(?:pantalla|cierra|pierde|falla|error|funciona)\b/,
  },
  {
    key: "subscription-double-charge",
    label: "Evitar cargos simultáneos de dos planes de suscripción",
    pattern:
      /\b(?:cargaron|cobraron|cobro|cargo|cobrando)\b.{0,180}\bmensual\b.{0,100}\banual\b|\b(?:cobro|cargo)\w*\b.{0,50}\bduplic\w*\b/,
  },
  {
    key: "ad-interruption",
    label: "Completar la tarea sin interrupciones publicitarias repetidas",
    pattern:
      /\b(?:anunci\w*|publicidad)\b.{0,120}\b(?:cada|oblig\w*|interrump\w*|impide|esper\w*|leccion\w*)\b|\boblig\w*\b.{0,80}\b(?:anunci\w*|publicidad)\b/,
  },
  {
    key: "exercise-correction",
    label: "Recibir correcciones fiables en ejercicios de idiomas",
    categories: ["idiomas"],
    pattern:
      /\b(?:correcci\w*|corrige\w*|respuesta\w*|traducci\w*|teclado)\b.{0,100}\b(?:mal|incorrect\w*|error\w*|correcta\w*)\b|\b(?:mal|incorrect\w*|error\w*)\b.{0,60}\b(?:correcci\w*|respuesta\w*|traducci\w*)\b/,
  },
  {
    key: "learning-limits",
    label: "Mantener la práctica sin límites de energía o vidas",
    categories: ["idiomas"],
    pattern:
      /\b(?:energia|vidas|corazones)\b.{0,100}\b(?:agot\w*|limit\w*|acaba\w*|pagar|esperar|practicar)\b|\b(?:agot\w*|acaba\w*)\b.{0,60}\b(?:energia|vidas|corazones)\b/,
  },
  {
    key: "subscription-cancellation",
    label: "Cancelar una suscripción y detener su renovación",
    pattern:
      /\b(?:cancel\w*|baja|renovacion\w*)\b.{0,90}\b(?:suscrip\w*|cobr\w*|pago\w*|renov\w*)\b|\bsuscrip\w*\b.{0,90}\b(?:cancel\w*|baja)\b/,
  },
  {
    key: "shared-list-sync",
    label: "Sincronizar listas de compras entre personas y dispositivos",
    categories: ["listas-compras"],
    pattern:
      /\b(?:no puedo sincron\w*|no (?:se |me )?(?:sincron\w*|actualiz\w*))\b.{0,100}\b(?:lista\w*|pareja|familia|productos|dispositivos)\b|\b(?:lista\w*|productos)\b.{0,70}\bno (?:se |me )?(?:sincron\w*|actualiz\w*)\b/,
    resolutionPattern:
      /\b(?:sincron\w*|actualiz\w*)\b.{0,100}\b(?:lista\w*|pareja|familia|productos|dispositivos)\b|\blista\w*\b.{0,80}\b(?:sincron\w*|actualiz\w*)\b/,
  },
  {
    key: "expense-currency",
    label: "Conciliar gastos compartidos en varias monedas",
    categories: ["gastos-compartidos"],
    pattern:
      /\b(?:monedas?|divisas?|tipo de cambio|conversion)\b.{0,70}\b(?:incorrect\w*|error\w*|no (?:funciona|cambia|coincide)|falla\w*)\b|\bno puedo\b.{0,30}\b(?:convertir|cambiar)\b.{0,30}\b(?:monedas?|divisas?)\b/,
    resolutionPattern: /\b(?:monedas?|divisas?|tipo de cambio|conversion)\b/,
  },
  {
    key: "expense-balance",
    label: "Mantener saldos y repartos correctos de gastos compartidos",
    categories: ["gastos-compartidos"],
    pattern:
      /\b(?:saldo\w*|repart\w*|deuda\w*|gasto\w*)\b.{0,80}\b(?:incorrect\w*|mal|duplic\w*|sincron\w*|cuadra\w*)\b/,
  },
  {
    key: "missed-reminders",
    label: "Recibir recordatorios personales a tiempo",
    categories: ["organizacion-personal"],
    pattern:
      /\b(?:no (?:recibo|me llegan?|llegan?|recibe)|nunca (?:llegan?|recibo))\b.{0,70}\b(?:recordatori\w*|notificaci\w*|alertas?)\b|\b(?:recordatori\w*|notificaci\w*|alertas?)\b.{0,70}\b(?:no llegan?|tarde|retrasad\w*)\b/,
    resolutionPattern: /\b(?:recordatori\w*|notificaci\w*|alertas?)\b/,
  },
  {
    key: "route-timing",
    label: "Consultar horarios y llegadas de transporte fiables",
    categories: ["movilidad"],
    pattern:
      /\b(?:horari\w*|llegada\w*|autobus\w*|camion\w*|ruta\w*|transporte)\b.{0,100}\b(?:incorrect\w*|coincid\w*|reales|actualiz\w*|esper\w*|lleg\w*|mal)\b/,
  },
  {
    key: "personal-data-export",
    label: "Conservar y mover datos personales entre apps",
    pattern:
      /\b(?:export\w*|copia de seguridad)\b.{0,100}\b(?:datos|gastos|listas|tareas|historial)\b|\b(?:datos|historial)\b.{0,80}\bexport\w*\b/,
  },
];
const obstacle =
  /\b(?:no puedo|no (?:funciona|sincroniza|carga|recibo|permite|coincid\w*|cuadr\w*|notifica|avisa)|no (?:me |se )?(?:deja\w*|guarda|sincroniza|actualiza|permite|lleg\w*)|no son (?:reales|correctos|fiables)|falla\w*|incorrect\w*|demasiado|pierdo|perdi|mal|agot\w*|se acaba\w*|tengo que esperar|sigue\w* cobrando|me cobran|me cargaron|limit\w*|oblig\w*|imposible|vuelve a la pantalla|se cierra|se bloquea|tarde|retrasad\w*)\b/;
const benign =
  /\b(?:no (?:son|es|esta|estan) (?:un |una )?(?:problema\w*|mal[ao]s?|incorrect\w*)|no (?:tengo|tiene|hay) (?:ningun |ninguna )?(?:problema\w*|error\w*|fallo\w*)|sin (?:problema\w*|errores)|no funciona mal)\b/;
function grounded(own: string, regex: RegExp): GroundedField | undefined {
  const sentence = own
    .split(/(?<=[.!?])\s+/)
    .find((s) => regex.test(normalizedText(s)));
  return sentence
    ? { value: sentence.slice(0, 240), quote: sentence }
    : undefined;
}
/** Additive interpretation only for the new consumer review source. */
export function consumerContext(record: EvidenceRecord) {
  const own = authoredText(record.quote),
    text = normalizedText(own);
  const category = record.appCategory ?? "";
  const clauses = own
    .split(/(?<=[.!?])\s+|\b(?:pero|aunque|sin embargo)\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const failed = clauses.filter(
    (s) =>
      obstacle.test(normalizedText(s)) &&
      !benign.test(normalizedText(s)) &&
      !reportsResolution(s),
  );
  const eligible = mechanisms.filter(
    (m) => !m.categories || m.categories.includes(category),
  );
  const mechanism =
    eligible.find((m) =>
      failed.some((s) => m.pattern.test(normalizedText(s))),
    ) ??
    eligible.find((m) =>
      clauses.some(
        (s) =>
          reportsResolution(s) &&
          (m.resolutionPattern ?? m.pattern).test(normalizedText(s)),
      ),
    );
  const matched =
    mechanism && failed.find((s) => mechanism.pattern.test(normalizedText(s)));
  const correction = Boolean(
    mechanism &&
    !matched &&
    clauses.some(
      (s) =>
        reportsResolution(s) &&
        (mechanism.resolutionPattern ?? mechanism.pattern).test(
          normalizedText(s),
        ),
    ),
  );
  const promoted =
    isSelfPromotion(own) ||
    /\b(?:mi codigo|codigo de referido|descarga mi|usa mi enlace)\b/.test(text);
  const accepted =
    record.source === "app-store" &&
    record.language === "es" &&
    Boolean(matched) &&
    !promoted &&
    !isHypothetical(own);
  const scope: ProblemScope | undefined = mechanism
    ? {
        key: `consumer:${category}:${mechanism.key}`,
        task: mechanism.key,
        label: mechanism.label,
        segment: "uso-personal",
        product: `consumer:${category}`,
        domain: category,
        mechanism: mechanism.key,
      }
    : undefined;
  const fields: ProblemDossier["fields"] = {
    obstacle:
      accepted && matched
        ? { value: matched.slice(0, 240), quote: matched }
        : undefined,
    task: mechanism ? grounded(own, mechanism.pattern) : undefined,
    frequency: grounded(
      own,
      /\b(?:cada|diario|siempre|semanal|mensual|todos los dias)\b/,
    ),
    consequence: grounded(
      own,
      /(?:\d[\d.,]*\s*(?:horas?|dias?|minutos?|euros?|pesos|usd|mxn)|[$€]|pierdo tiempo|perdi|horas)/,
    ),
    workaround: grounded(
      own,
      /\b(?:a mano|manualmente|copiar|papel|whatsapp|excel|hoja de calculo|otra app)\b/,
    ),
  };
  return { accepted, correction, topic: scope?.label, scope, fields };
}
