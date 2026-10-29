export function aiConfig() {
  const baseUrl = process.env.LLM_BASE_URL?.replace(/\/$/, "");
  const model = process.env.LLM_MODEL;
  const inputPrice = Number(process.env.AI_INPUT_USD_PER_MILLION);
  const outputPrice = Number(process.env.AI_OUTPUT_USD_PER_MILLION);
  const monthlyBudget = Number(process.env.AI_MONTHLY_BUDGET_USD ?? 10);
  const local = baseUrl
    ? /^http:\/\/(localhost|127\.0\.0\.1):\d+\/v1$/.test(baseUrl)
    : false;
  const configured = Boolean(
    baseUrl &&
    model &&
    (local || (baseUrl.startsWith("https://") && process.env.LLM_API_KEY)) &&
    process.env.AI_INPUT_USD_PER_MILLION !== undefined &&
    process.env.AI_INPUT_USD_PER_MILLION !== "" &&
    process.env.AI_OUTPUT_USD_PER_MILLION !== undefined &&
    process.env.AI_OUTPUT_USD_PER_MILLION !== "" &&
    Number.isFinite(inputPrice) &&
    inputPrice >= 0 &&
    Number.isFinite(outputPrice) &&
    outputPrice >= 0 &&
    Number.isFinite(monthlyBudget) &&
    monthlyBudget > 0,
  );
  return {
    baseUrl,
    model,
    inputPrice,
    outputPrice,
    monthlyBudget: Number.isFinite(monthlyBudget) ? monthlyBudget : 10,
    configured,
    local,
  };
}
export function analysisMode(): "local" | "api" {
  return process.env.ANALYSIS_MODE === "api" ? "api" : "local";
}
