import { authoredText, normalizedText } from "./evidence-text";

/** Context may be valuable to archive without being a customer's own obstacle. */
export function isRecruitment(value: string) {
  const text = normalizedText(value);
  return (
    /\b(?:who is hiring|we(?:'re| are) hiring|join our team|we(?:'re| are) looking for (?:extraordinary builders|a .{0,50}(?:engineer|developer|designer))|open positions|buscamos (?:personal|candidatos|un desarrollador)|vacantes disponibles)\b/.test(
      text,
    ) ||
    /\b(?:roles|positions|puestos|vacantes)\b[\s\S]{0,250}\b(?:equity|salary|remote|apply|salario|postulate)\b/.test(
      text,
    )
  );
}
export function isHypothetical(value: string) {
  return /\b(?:let['’]s say|suppose (?:you|we)|imagine (?:you|your)|supongamos|imagina que)\b/i.test(
    value,
  );
}
export function isEditorialReflection(value: string) {
  return /\b(?:i loved coding|used to enjoy coding)\b[\s\S]{0,180}\b(?:reason|purpose|necessary)\b/i.test(
    value,
  );
}
export function reportsResolution(value: string) {
  return authoredText(value)
    .split(/(?<=[.!?])\s+/)
    .some((sentence) => {
      const text = normalizedText(sentence);
      if (
        /[?]/.test(text) ||
        /\b(?:not|never|isn['’]t|wasn['’]t|hasn['’]t|unresolved|sin|no)\b.{0,25}\b(?:fixed|resolved|solved|resuelto|solucionado)\b/.test(
          text,
        )
      )
        return false;
      // Require a completed assertion. "can/will be fixed by", "if fixed" and
      // suggested workarounds are not observations that the case was resolved.
      if (/\b(?:if|unless|suppose|si|quizas|ojala|however|but)\b/.test(text))
        return false;
      return (
        /^(?:update:\s*)?(?:(?:this|it|that|(?:the|this|our) (?:(?:[a-z_-]+)\s+){0,5}(?:issue|problem|bug|case|ticket))\s+(?:is|was|has been|is now|was finally)\s+(?:fixed|resolved|solved)|(?:we|i)\s+(?:have\s+)?(?:fixed|resolved|solved)\s+(?:the|this|our)\s+(?:issue|problem|bug)|(?:fixed|resolved|solved)\s+(?:now|by|after))\b/.test(
          text.trim(),
        ) ||
        /^(?:(?:it|this|that|account access|the (?:app|application|tool|export|backup|sync|account|service)) works now|(?:ya (?:esta|quedo)|ha quedado)\s+(?:resuelto|solucionado)|ya funciona)\b/.test(
          text.trim(),
        ) ||
        /^(?:fixed|resolved|solved|resuelto|solucionado)[.!]?$/.test(
          text.trim(),
        )
      );
    });
}
export const operationalFailure =
  /\b(?:cannot|can['’]t|unable|blocked|fails?|failed|failure|broken|crash\w*|freez\w*|error|incorrect|inaccurate|401|403|pgrst303|silently (?:drop\w*|fail\w*|remov\w*)|(?:does|did)(?:n['’]t| not)[\s\S]{0,35}(?:work\w*|load\w*|upload\w*|download\w*|line up|select\w*)|not[\s\S]{0,20}(?:upload\w*|download\w*|translat\w*|detect\w*|receiv\w*)|(?:encountering|having|have) (?:a|one|the) problem|deletes? (?:the rest|part|all)|glitch\w*|laggy|jitter\w*|resets? to|too (?:long|slow)|lack.{0,25}(?:detail|information)|missing|mismatch|reject\w*|denied|spills?|black frame|no funciona|no puedo|fall[ao]\w*|no (?:carga|sincroniza|recibo|permite)|negativa|incumpl\w*)\b/i;
