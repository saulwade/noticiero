import { z } from "zod";
import { safePublicUrl } from "@/features/news/normalize";
import { validMemorySource } from "./sources";

const date = z.iso.datetime();
const publicUrl = z
  .string()
  .max(1000)
  .refine(
    (value) => Boolean(safePublicUrl(value)) && value.startsWith("https://"),
    "Referencia pública inválida",
  );
const matcher = z
  .object({
    scopeKey: z.string().min(3).max(600).optional(),
    groups: z
      .array(z.array(z.string().trim().min(2).max(80)).min(2).max(8))
      .max(25),
  })
  .strict()
  .refine((v) => Boolean(v.scopeKey) || v.groups.length > 0);
export const memoryImportSchema = z
  .object({
    definitions: z
      .array(
        z
          .object({
            id: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
            title: z.string().trim().min(5).max(240),
            hypothesis: z.string().trim().min(10).max(2000),
            origin: z.enum(["review", "automatic"]),
            createdAt: date,
            match: z
              .object({
                scopeKey: z.string().min(3).max(600).optional(),
                groups: z
                  .array(
                    z.array(z.string().trim().min(2).max(80)).min(2).max(8),
                  )
                  .max(25),
              })
              .refine((v) => Boolean(v.scopeKey) || v.groups.length > 0),
            sources: z
              .array(
                z
                  .object({
                    url: publicUrl,
                    kind: z.enum(["competitor", "issue"]),
                  })
                  .refine(
                    validMemorySource,
                    "Fuente fuera de cobertura pública permitida",
                  ),
              )
              .max(16),
          })
          .strict(),
      )
      .max(100),
    decisions: z
      .array(
        z
          .object({
            id: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
            ideaId: z.string().max(100),
            at: date,
            actor: z.literal("research-review"),
            decision: z.enum(["watch", "investigate", "pause", "discard"]),
            reason: z.string().trim().min(10).max(4000),
            references: z.array(publicUrl).max(24),
            excludedAuthors: z.array(z.string().max(120)).max(50),
            excludedUrls: z.array(publicUrl).max(50),
            matchOverride: matcher.optional(),
          })
          .strict(),
      )
      .max(200),
  })
  .strict()
  .superRefine((data, ctx) => {
    for (const key of ["definitions", "decisions"] as const) {
      const ids = new Set<string>();
      data[key].forEach((row, index) => {
        if (ids.has(row.id))
          ctx.addIssue({
            code: "custom",
            path: [key, index, "id"],
            message: "Identificador duplicado en la importación.",
          });
        ids.add(row.id);
      });
    }
  });
