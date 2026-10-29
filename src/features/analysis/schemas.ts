import { z } from "zod";
export const analysisSchema = z.object({
  title: z.string().min(8).max(240),
  summary: z.string().min(20).max(1100),
  why: z.string().min(10).max(500),
  evidenceIds: z.array(z.string()).min(1),
});
export const ideaSchema = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string().min(5).max(140),
        problem: z.string().min(15).max(600),
        customer: z.string().min(5).max(250),
        proposal: z.string().min(15).max(600),
        mvp: z.string().min(10).max(500),
        experiment: z.string().min(10).max(500),
        successSignal: z.string().min(5).max(250),
        whyNow: z.string().min(10).max(400),
        evidence: z
          .array(
            z.object({
              storyId: z.string(),
              reason: z.string().min(10).max(350),
            }),
          )
          .min(1)
          .max(4),
        difficulty: z.enum(["Baja", "Media", "Alta"]),
        confidence: z.enum(["Exploratoria", "Moderada"]),
        caveat: z.string().min(10).max(400),
      }),
    )
    .max(3),
});
export function verifyEvidence(evidence: string[], allowed: string[]) {
  if (!evidence.length || evidence.some((id) => !allowed.includes(id)))
    throw new Error("El análisis contiene referencias no disponibles.");
}
