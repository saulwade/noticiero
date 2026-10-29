import { aiConfig } from "./config";
import { reserveBudget, settleBudget } from "./budget";
import { z } from "zod";
const responseSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string() }) }))
    .min(1),
  usage: z
    .object({ prompt_tokens: z.number(), completion_tokens: z.number() })
    .optional(),
});
export async function generateJson(
  system: string,
  input: unknown,
  maxTokens = 900,
): Promise<unknown> {
  const config = aiConfig();
  if (!config.configured)
    throw new Error(
      "Configura un proveedor de IA y sus tarifas para generar análisis.",
    );
  const text = JSON.stringify(input);
  const reserved =
    ((Buffer.byteLength(text + system, "utf8") + 256) * config.inputPrice +
      maxTokens * config.outputPrice) /
    1_000_000;
  if (!(await reserveBudget(reserved, config.monthlyBudget)))
    throw new Error("Se alcanzó el presupuesto mensual de IA.");
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    redirect: "error",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.LLM_API_KEY
        ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.3,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: text },
      ],
    }),
  });
  if (!response.ok)
    throw new Error(`El proveedor de IA respondió HTTP ${response.status}.`);
  const result = responseSchema.parse(await response.json());
  if (result.usage)
    await settleBudget(
      reserved,
      (result.usage.prompt_tokens * config.inputPrice +
        result.usage.completion_tokens * config.outputPrice) /
        1_000_000,
    );
  return JSON.parse(
    result.choices[0].message.content.replace(/^```(?:json)?\s*|\s*```$/g, ""),
  );
}
