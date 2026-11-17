import { expect, it } from "vitest";
import { consumerContext } from "@/features/research/consumer-context";
import { buildDossiers, timelineAssessor } from "@/features/evidence/engine";
import { weeklyReport } from "@/features/evidence/engine";
import {
  buildConsumerDigest,
  consumerDigestMarkdown,
} from "@/features/evidence/consumer-digest";
import { evidenceTimeline } from "@/features/evidence/timeline";
import { classifyIdeaEvidence } from "@/features/idea-memory/quality";
import { assessIdea } from "@/features/idea-memory/engine";
import type { EvidenceRecord } from "@/features/evidence/types";
import type { IdeaDefinition } from "@/features/idea-memory/types";
const now = new Date("2026-11-17T12:00:00Z");
const record = (
  id = "a",
  patch: Partial<EvidenceRecord> = {},
): EvidenceRecord => ({
  id,
  externalId: id,
  source: "app-store",
  sourceName: "App Store",
  url: `https://apps.apple.com/app/id580669177?reviewId=${id}`,
  title: "Lista",
  quote:
    "No puedo sincronizar la lista con mi pareja. Cada día tengo que copiar los productos a mano.",
  occurredAt: "2026-11-16T12:00:00Z",
  capturedAt: "2026-11-17T10:00:00Z",
  language: "es",
  kind: "community",
  authorKey: `app-store:${id}`,
  product: "Bring!",
  appCategory: "listas-compras",
  rating: 2,
  dateBasis: "source_updated",
  ...patch,
});
it("agrupa la misma tarea/causa entre alternativas y separa problemas distintos", () => {
  const a = record(),
    b = record("b", { product: "Otra lista" });
  expect(consumerContext(a).accepted).toBe(true);
  expect(buildDossiers([a, b], [], now)).toHaveLength(1);
  const cancellation = record("c", {
    quote: "No puedo cancelar la suscripción y me siguen cobrando cada mes.",
  });
  expect(consumerContext(cancellation).scope?.key).not.toBe(
    consumerContext(a).scope?.key,
  );
  expect(buildDossiers([a, b, cancellation], [], now)).toHaveLength(2);
});
it("una estrella, elogios, anuncios o causas en otra oración no crean demanda", () => {
  for (const quote of [
    "La aplicación es mala",
    "La lista se sincroniza bien con mi pareja y me resulta muy útil.",
    "No puedo entrar a mi cuenta. La lista se sincroniza bien con mi familia.",
    "No puedo sincronizar la lista con mi pareja: usa mi código de referido.",
  ])
    expect(consumerContext(record("x", { quote, rating: 1 })).accepted).toBe(
      false,
    );
});
it("conserva resoluciones y no interpreta precio como validación de otra app", () => {
  const solved = record("fixed", {
    quote: "Ya funciona la sincronización de la lista con mi pareja.",
  });
  expect(consumerContext(solved).correction).toBe(true);
  const digest = buildConsumerDigest([record(), record("b"), solved], [], now);
  expect(digest.candidates[0].resolvedCases).toBe(1);
  expect(digest.candidates[0].gaps.join(" ")).toContain("disposición a pagar");
  expect(consumerDigestMarkdown(digest).join("\n")).toContain("actualización");
});
it("no mezcla español con país, revisiones con casos ni updated con publicación original", () => {
  const a = record(),
    revision = record("a2", {
      externalId: "a",
      revision: 2,
      capturedAt: "2026-11-17T11:00:00Z",
    });
  const digest = buildConsumerDigest([a, revision], [], now);
  expect(digest.reviews).toBe(1);
  expect(digest.sourceUpdatedDates).toBe(1);
  expect(digest.candidates[0].cases).toBe(1);
  const timeline = evidenceTimeline(
    [a, revision],
    timelineAssessor([], now),
    now,
    7,
  );
  expect(timeline.total.newCases).toBe(1);
  expect(timeline.total.publishedCases).toBe(0);
  const scope = consumerContext(a).scope!;
  const idea: IdeaDefinition = {
    id: "c",
    title: scope.label,
    hypothesis: "Investigar",
    origin: "automatic",
    createdAt: "2026-11-17T09:00:00Z",
    match: { scopeKey: scope.key, groups: [] },
    sources: [],
  };
  const link = classifyIdeaEvidence(idea, a, [], [], now)!;
  expect(link.dateBasis).toBe("source_updated");
  const assessment = assessIdea(idea, [link], [], [], now);
  expect(assessment.weekly.currentCases).toBe(0);
  expect(assessment.weekly.newCaptures).toBe(1);
  expect(assessment.gaps.join(" ")).toContain("no se requiere México");
});
it("rechazos humanos y cortes temporales se respetan en el reporte consumer", () => {
  const a = record(),
    future = record("future", { capturedAt: "2027-01-01T00:00:00Z" });
  const digest = buildConsumerDigest(
    [a, future],
    [
      {
        id: a.id,
        decision: "rejected",
        note: "ruido",
        at: "2026-11-17T11:00:00Z",
      },
    ],
    now,
  );
  expect(digest.reviews).toBe(0);
  expect(digest.candidates).toHaveLength(0);
});
it("recupera tareas consumer concretas sin confundir comparar planes con un cobro doble", () => {
  for (const quote of [
    "No deja hacer exámenes parciales para pasar de una sección a otra.",
    "Cada vez que grabo audio la aplicación vuelve a la pantalla de inicio.",
    "Es imposible usar la aplicación porque me obligan a ver un anuncio después de cada lección.",
    "Me cargaron la suscripción mensual que elegí y también otra anual.",
  ])
    expect(
      consumerContext(record("x", { quote, appCategory: "idiomas" })).accepted,
    ).toBe(true);
  expect(
    consumerContext(
      record("x", {
        quote: "No puedo comparar el plan mensual y el anual.",
        appCategory: "idiomas",
      }),
    ).accepted,
  ).toBe(false);
});
it("no crea obstáculos con elogios negados ni atribuye otra cláusula a sincronización", () => {
  for (const [quote, appCategory] of [
    [
      "Los recordatorios no son malos y me ayudan cada día con mis tareas.",
      "organizacion-personal",
    ],
    ["Las respuestas correctas no son un problema para mí.", "idiomas"],
    [
      "No puedo iniciar sesión, pero la lista compartida se sincroniza bien con mi pareja.",
      "listas-compras",
    ],
    [
      "No puedo borrar los recordatorios antiguos de mis tareas.",
      "organizacion-personal",
    ],
    [
      "No puedo cambiar el sonido de los recordatorios de mis tareas.",
      "organizacion-personal",
    ],
  ])
    expect(consumerContext(record("x", { quote, appCategory })).accepted).toBe(
      false,
    );
  expect(
    consumerContext(
      record("x", {
        quote: "No recibo los recordatorios de mis tareas a tiempo.",
        appCategory: "organizacion-personal",
      }),
    ).accepted,
  ).toBe(true);
});
it("una resolución de otra tarea no cancela el problema y la semana no inventa publicaciones", () => {
  const active = record("active", {
    quote:
      "No puedo sincronizar la lista con mi pareja. Ya funciona el inicio de sesión.",
  });
  expect(consumerContext(active)).toMatchObject({
    accepted: true,
    correction: false,
  });
  expect(buildConsumerDigest([active], [], now).problemReviews).toBe(1);
  const weekly = weeklyReport([active], [], now).markdown;
  expect(weekly).toContain("Casos publicados esta semana: 0");
  expect(weekly).toContain("actualizado en fuente (original desconocido)");
});
it("prioriza tareas todavía bloqueadas sobre otra resolución y conserva conflictos", () => {
  const fixed = consumerContext(
    record("fixed", {
      appCategory: "idiomas",
      quote: "Ya funciona el audio después de la falla de ayer.",
    }),
  );
  expect(fixed).toMatchObject({ accepted: false, correction: true });
  const cancellation = consumerContext(
    record("x", {
      appCategory: "idiomas",
      quote:
        "Ya funciona el audio después de la falla de ayer. No puedo cancelar la suscripción y me siguen cobrando.",
    }),
  );
  expect(cancellation).toMatchObject({ accepted: true, correction: false });
  expect(cancellation.scope?.mechanism).toBe("subscription-cancellation");
  const partial = consumerContext(
    record("x", {
      quote:
        "Ya funciona la sincronización de la lista con mi pareja. Pero no puedo sincronizar la lista con mi familia.",
    }),
  );
  expect(partial).toMatchObject({ accepted: true, correction: false });
});
