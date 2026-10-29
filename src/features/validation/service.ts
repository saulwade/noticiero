import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  validationProjects,
  interviews,
  opportunities,
  opportunityEvents,
  savedItems,
} from "@/db/schema";
import { safePublicUrl, hash } from "@/features/news/normalize";
import type { ValidationData, ValidationProject, Interview } from "@/lib/types";

const text = z.string().trim().max(12000).default("");
const identifier = z.string().min(1).max(100);
const source = z.object({
  title: z.string().max(400),
  url: z
    .string()
    .refine(
      (value) => Boolean(safePublicUrl(value)),
      "Usa un enlace HTTPS público.",
    ),
});
export const validationInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("from-opportunity"),
    opportunityId: identifier,
    eventId: identifier.optional(),
    savedId: identifier.optional(),
  }),
  z.object({
    action: z.literal("project"),
    id: identifier.optional(),
    title: z.string().trim().min(3).max(200),
    segment: z.string().trim().min(2).max(1000),
    problem: z.string().trim().min(5).max(12000),
    hypothesis: text,
    successCriteria: text,
    sources: z.array(source).max(20).default([]),
    status: z
      .enum(["explore", "interviewing", "pilot", "archived"])
      .default("explore"),
  }),
  z.object({
    action: z.literal("interview"),
    id: identifier.optional(),
    projectId: identifier,
    alias: z.string().trim().min(1).max(200),
    role: z.string().trim().max(400).default(""),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => !Number.isNaN(Date.parse(value))),
    currentSolution: text,
    frequency: text,
    consequence: text,
    quote: text,
    notes: text,
    nextStep: text,
    status: z.enum(["planned", "completed"]).default("planned"),
  }),
]);
export async function getValidationData(): Promise<ValidationData> {
  const db = await getDb();
  const [projects, conversations] = await Promise.all([
    db.select().from(validationProjects),
    db.select().from(interviews),
  ]);
  return {
    projects: projects
      .map((row) => row.data)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    interviews: conversations
      .map((row) => row.data)
      .sort((a, b) => b.date.localeCompare(a.date)),
  };
}
export async function saveValidation(
  raw: unknown,
): Promise<{ projectId: string }> {
  const input = validationInput.parse(raw);
  const db = await getDb();
  const now = new Date().toISOString();
  if (input.action === "from-opportunity") {
    const existing = (await db.select().from(validationProjects)).find(
      (row) =>
        row.data.opportunityId === input.opportunityId &&
        row.data.opportunityEventId === input.eventId &&
        row.data.opportunitySavedId === input.savedId,
    );
    if (existing) return { projectId: existing.id };
    if (input.eventId && input.savedId)
      throw new Error("Elige una sola versión de evidencia.");
    const saved = input.savedId
      ? (
          await db
            .select()
            .from(savedItems)
            .where(eq(savedItems.id, input.savedId))
        )[0]?.data
      : undefined;
    const savedIdea =
      saved?.snapshot?.kind === "idea" ? saved.snapshot.idea : undefined;
    if (input.savedId && (!savedIdea || savedIdea.id !== input.opportunityId))
      throw new Error("Idea guardada no encontrada.");
    const event = input.eventId
      ? (
          await db
            .select()
            .from(opportunityEvents)
            .where(eq(opportunityEvents.id, input.eventId))
        )[0]?.data
      : undefined;
    if (
      input.eventId &&
      (!event || event.opportunityId !== input.opportunityId)
    )
      throw new Error("Revisión de oportunidad no encontrada.");
    const idea =
      savedIdea ??
      event?.idea ??
      (
        await db
          .select()
          .from(opportunities)
          .where(eq(opportunities.id, input.opportunityId))
      )[0]?.data ??
      (await db.select().from(opportunityEvents)).find(
        (row) => row.data.opportunityId === input.opportunityId,
      )?.data.idea;
    if (!idea) throw new Error("La oportunidad no está disponible.");
    const data: ValidationProject = {
      id: `from-${hash(`${idea.id}:${input.savedId ? `saved:${input.savedId}` : (input.eventId ?? "current")}`)}`,
      title: idea.title,
      segment: idea.customer,
      problem: idea.problem,
      hypothesis: idea.proposal,
      successCriteria: idea.successSignal,
      sources: idea.evidence.flatMap((item) =>
        item.url && safePublicUrl(item.url)
          ? [{ title: item.sourceName ?? "Evidencia", url: item.url }]
          : [],
      ),
      opportunityId: idea.id,
      opportunityEventId: input.eventId,
      opportunitySavedId: input.savedId,
      status: "explore",
      createdAt: now,
      updatedAt: now,
    };
    await db
      .insert(validationProjects)
      .values({ id: data.id, data })
      .onConflictDoNothing({ target: validationProjects.id });
    return { projectId: data.id };
  }
  if (input.action === "project") {
    const old = input.id
      ? (
          await db
            .select()
            .from(validationProjects)
            .where(eq(validationProjects.id, input.id))
        )[0]?.data
      : undefined;
    if (input.id && !old) throw new Error("Proyecto no encontrado.");
    const { action: _, ...fields } = input;
    void _;
    const data: ValidationProject = {
      ...fields,
      id: old?.id ?? randomUUID(),
      opportunityId: old?.opportunityId,
      opportunityEventId: old?.opportunityEventId,
      opportunitySavedId: old?.opportunitySavedId,
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
    };
    await db
      .insert(validationProjects)
      .values({ id: data.id, data })
      .onConflictDoUpdate({ target: validationProjects.id, set: { data } });
    return { projectId: data.id };
  }
  const project = (
    await db
      .select()
      .from(validationProjects)
      .where(eq(validationProjects.id, input.projectId))
  )[0];
  if (!project) throw new Error("Proyecto no encontrado.");
  const old = input.id
    ? (await db.select().from(interviews).where(eq(interviews.id, input.id)))[0]
        ?.data
    : undefined;
  if (input.id && (!old || old.projectId !== input.projectId))
    throw new Error("Entrevista no encontrada en este proyecto.");
  const { action: _, ...fields } = input;
  void _;
  const data: Interview = {
    ...fields,
    id: old?.id ?? randomUUID(),
    createdAt: old?.createdAt ?? now,
    updatedAt: now,
  };
  await db
    .insert(interviews)
    .values({ id: data.id, data })
    .onConflictDoUpdate({ target: interviews.id, set: { data } });
  return { projectId: data.projectId };
}
