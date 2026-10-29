import { describe, it, expect, beforeEach } from "vitest";
import {
  getValidationData,
  saveValidation,
} from "@/features/validation/service";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { demoData } from "@/lib/demo-data";
beforeEach(async () => {
  const db = await getDb();
  for (const table of [
    schema.validationProjects,
    schema.interviews,
    schema.opportunities,
    schema.opportunityEvents,
    schema.savedItems,
  ])
    await db.delete(table);
});
describe("investigaciones y entrevistas", () => {
  it("respeta la copia favorita al preparar entrevistas desde Guardados", async () => {
    const db = await getDb();
    const idea = {
      ...demoData().opportunities[0],
      id: "saved-validation-idea",
    };
    await db
      .insert(schema.opportunities)
      .values({
        id: idea.id,
        data: { ...idea, proposal: "Propuesta posterior" },
      });
    await db
      .insert(schema.savedItems)
      .values({
        id: idea.id,
        data: {
          id: idea.id,
          kind: "idea",
          note: "Mi selección",
          state: "explore",
          createdAt: idea.createdAt,
          snapshot: { kind: "idea", idea },
        },
      });
    const { projectId } = await saveValidation({
      action: "from-opportunity",
      opportunityId: idea.id,
      savedId: idea.id,
    });
    expect(
      (await getValidationData()).projects.find(
        (project) => project.id === projectId,
      )?.hypothesis,
    ).toBe(idea.proposal);
  });
  it("prepara entrevistas con la revisión histórica seleccionada", async () => {
    const db = await getDb();
    const current = {
      ...demoData().opportunities[0],
      id: "versioned-idea",
      proposal: "Hipótesis actual",
    };
    await db
      .insert(schema.opportunities)
      .values({ id: current.id, data: current });
    await db.insert(schema.opportunityEvents).values({
      id: "historical-event",
      data: {
        id: "historical-event",
        opportunityId: current.id,
        kind: "discovered",
        at: "2026-10-28T13:00:00Z",
        idea: {
          ...current,
          proposal: "Hipótesis original",
          evidence: [
            {
              storyId: "s",
              reason: "Original",
              url: "https://example.com/original",
            },
          ],
        },
      },
    });
    await saveValidation({
      action: "from-opportunity",
      opportunityId: current.id,
    });
    const result = await saveValidation({
      action: "from-opportunity",
      opportunityId: current.id,
      eventId: "historical-event",
    });
    const project = (await getValidationData()).projects.find(
      (project) => project.id === result.projectId,
    )!;
    expect(project.hypothesis).toBe("Hipótesis original");
    expect(project.sources[0].url).toBe("https://example.com/original");
    expect(project.opportunityEventId).toBe("historical-event");
    await expect(
      saveValidation({
        action: "from-opportunity",
        opportunityId: "other",
        eventId: "historical-event",
      }),
    ).rejects.toThrow();
  });
  it("vincula evidencia desde una oportunidad y evita duplicar el proyecto", async () => {
    const idea = {
      ...demoData().opportunities[0],
      id: "validation-idea",
      evidence: [
        {
          storyId: "s1",
          reason: "Solicitud",
          url: "https://example.com/evidence",
          quote: "I need a tool",
          sourceName: "HN",
        },
      ],
    };
    const db = await getDb();
    await db.insert(schema.opportunities).values({ id: idea.id, data: idea });
    const [one, concurrent] = await Promise.all([
      saveValidation({ action: "from-opportunity", opportunityId: idea.id }),
      saveValidation({ action: "from-opportunity", opportunityId: idea.id }),
    ]);
    expect(concurrent).toEqual(one);
    expect(
      await saveValidation({
        action: "from-opportunity",
        opportunityId: idea.id,
      }),
    ).toEqual(one);
    const data = await getValidationData();
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].sources[0].url).toBe(idea.evidence[0].url);
  });
  it("conserva entrevistas y contradicciones al archivar una investigación", async () => {
    const project = {
      action: "project",
      title: "Conciliación para despachos",
      segment: "Despachos pequeños",
      problem: "Comparan facturas a mano",
      hypothesis: "Reducir errores",
      successCriteria: "Dos pilotos",
      status: "interviewing",
    };
    const { projectId } = await saveValidation(project);
    await saveValidation({
      action: "interview",
      projectId,
      alias: "Persona A",
      role: "Contadora",
      date: "2026-10-29",
      status: "completed",
      notes: "No necesita otra herramienta",
      currentSolution: "Excel",
      frequency: "Semanal",
      consequence: "Dos horas",
      quote: "Mi proceso funciona",
      nextStep: "Buscar otro segmento",
    });
    const before = await getValidationData();
    await saveValidation({ ...project, id: projectId, status: "archived" });
    const after = await getValidationData();
    expect(after.interviews).toEqual(before.interviews);
    expect(after.projects[0].createdAt).toBe(before.projects[0].createdAt);
    expect(after.projects[0].status).toBe("archived");
  });
  it("rechaza referencias inexistentes y enlaces peligrosos", async () => {
    await expect(
      saveValidation({
        action: "interview",
        projectId: "missing",
        alias: "A",
        date: "2026-10-29",
      }),
    ).rejects.toThrow();
    await expect(
      saveValidation({
        action: "project",
        title: "Proyecto",
        segment: "Pymes",
        problem: "Problema",
        sources: [{ title: "Mal", url: "javascript:alert(1)" }],
      }),
    ).rejects.toThrow();
  });
});
