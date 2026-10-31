import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  evidenceRecords,
  evidenceReviews,
  evidenceConnectors,
  evidenceReports,
  validationProjects,
} from "@/db/schema";
import { hash, safePublicUrl } from "@/features/news/normalize";
import { buildDossiers, weeklyReport } from "./engine";
import { collectCfpb, collectGithub } from "./connectors";
import { parseProfecoCsv } from "./profeco";
import { editionFor } from "@/lib/time";
import type { Story, ValidationProject } from "@/lib/types";
import type {
  EvidenceData,
  EvidenceRecord,
  ConnectorState,
  EvidenceReview,
} from "./types";

export const MAX_EVIDENCE_RECORDS = 10000;
const MAX_EVIDENCE_BYTES = 16_000_000;
const defaults: ConnectorState[] = ["hn", "github", "cfpb", "profeco"].map(
  (id) => ({
    id: id as ConnectorState["id"],
    status: "waiting",
    count: 0,
    checkedAt: "",
    message:
      id === "profeco"
        ? "Importa un CSV oficial. No se presume acceso automático al portal."
        : "Pendiente de la próxima actualización.",
  }),
);
export async function getEvidenceData(
  now = new Date(),
  full = false,
): Promise<EvidenceData> {
  const db = await getDb();
  const [records, reviews, sources, reports, projects] = await Promise.all([
    db.select().from(evidenceRecords),
    db.select().from(evidenceReviews),
    db.select().from(evidenceConnectors),
    db.select().from(evidenceReports),
    db.select().from(validationProjects),
  ]);
  const all = records.map((r) => r.data);
  const decisions = reviews.map((r) => r.data);
  const dossiers = buildDossiers(all, decisions, now).map((d) =>
    projects.some(
      (p) => p.id === `validation-${d.id}` && p.data.status !== "archived",
    )
      ? { ...d, status: "validating" as const }
      : d,
  );
  const sorted = all.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  const shownDossiers = full
    ? dossiers
    : dossiers.slice(0, 30).map((d) => ({
        ...d,
        evidenceIds: d.evidenceIds.slice(0, 6),
        contradictions: d.contradictions.slice(0, 2),
        fields: Object.fromEntries(
          Object.entries(d.fields).map(([k, f]) => [
            k,
            f ? { ...f, quote: f.quote.slice(0, 1200) } : f,
          ]),
        ),
      }));
  const required = new Set(shownDossiers.flatMap((d) => d.evidenceIds));
  const shownRecords = full
    ? sorted
    : [
        ...sorted.filter((r) => required.has(r.id)),
        ...sorted.filter((r) => !required.has(r.id)),
      ].slice(0, 240);
  const shownIds = new Set(shownRecords.map((r) => r.id));
  const result: EvidenceData = {
    records: shownRecords,
    reviews: full ? decisions : decisions.filter((r) => shownIds.has(r.id)),
    dossiers: shownDossiers,
    sources: defaults.map(
      (s) => sources.find((row) => row.id === s.id)?.data ?? s,
    ),
    reports: reports
      .map((r) => r.data)
      .sort((a, b) => b.to.localeCompare(a.to))
      .slice(0, full ? undefined : 4)
      .map((r) =>
        full
          ? r
          : {
              ...r,
              markdown:
                r.markdown.length > 60000
                  ? `${r.markdown.slice(0, 60000)}\n\nVista abreviada. El archivo completo permanece en la exportación del Radar.`
                  : r.markdown,
            },
      ),
    totalRecords: all.length,
    storageLimited:
      all.length >= MAX_EVIDENCE_RECORDS ||
      Buffer.byteLength(JSON.stringify(all)) >= MAX_EVIDENCE_BYTES,
  };
  return full ? result : boundedEvidenceView(result);
}
export function boundedEvidenceView(data: EvidenceData): EvidenceData {
  const view = {
    ...data,
    records: [...data.records],
    dossiers: [...data.dossiers],
    reviews: [...data.reviews],
    reports: [...data.reports],
  };
  const prune = () => {
    const ids = new Set(view.records.map((r) => r.id));
    view.reviews = view.reviews.filter((r) => ids.has(r.id));
    view.dossiers = view.dossiers
      .map((d) => ({
        ...d,
        evidenceIds: d.evidenceIds.filter((id) => ids.has(id)),
      }))
      .filter((d) => d.evidenceIds.length > 0);
  };
  while (Buffer.byteLength(JSON.stringify(view)) > 1_500_000) {
    if (view.reports.length > 1) view.reports.pop();
    else if (view.records.length > 20) {
      view.records.splice(Math.max(20, view.records.length - 20));
      prune();
    } else if (view.dossiers.length > 1) view.dossiers.pop();
    else if (view.reports.length) view.reports.pop();
    else if (view.records.length) {
      view.records.pop();
      prune();
    } else break;
  }
  return view;
}
export async function storeEvidence(
  incoming: EvidenceRecord[],
  state?: ConnectorState,
) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    // Serialize cap accounting/imports without affecting the existing news lease.
    await tx.execute(
      (await import("drizzle-orm")).sql`SELECT pg_advisory_xact_lock(7202631)`,
    );
    const existing = (await tx.select().from(evidenceRecords)).map(
      (r) => r.data,
    );
    const known = new Set(existing.map((r) => r.id));
    const content = (r: EvidenceRecord) =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(r)
            .filter(
              ([k]) =>
                !["id", "revision", "capturedAt", "historical"].includes(k),
            )
            .sort(([a], [b]) => a.localeCompare(b)),
        ),
      );
    let bytes = Buffer.byteLength(JSON.stringify(existing));
    let count = existing.length;
    let added = 0;
    let limited = false;
    for (const raw of incoming) {
      if (
        !safePublicUrl(raw.url) ||
        !Number.isFinite(Date.parse(raw.occurredAt)) ||
        !Number.isFinite(Date.parse(raw.capturedAt)) ||
        raw.quote.length > 8000
      )
        throw new Error("Evidencia de fuente inválida.");
      const versions = existing
        .filter(
          (r) => r.source === raw.source && r.externalId === raw.externalId,
        )
        .sort(
          (a, b) =>
            (b.revision ?? 0) - (a.revision ?? 0) ||
            b.capturedAt.localeCompare(a.capturedAt),
        );
      if (versions[0] && content(versions[0]) === content(raw)) continue;
      const revision = (versions[0]?.revision ?? versions.length) + 1;
      const data = {
        ...raw,
        id: hash(`${raw.source}:${raw.externalId}:${content(raw)}:${revision}`),
        revision,
      };
      if (known.has(data.id)) continue;
      const size = Buffer.byteLength(JSON.stringify(data));
      if (count >= MAX_EVIDENCE_RECORDS || bytes + size > MAX_EVIDENCE_BYTES) {
        limited = true;
        break;
      }
      await tx
        .insert(evidenceRecords)
        .values({ id: data.id, data })
        .onConflictDoNothing();
      known.add(data.id);
      existing.push(data);
      count++;
      bytes += size;
      added++;
    }
    if (state) {
      const data = limited
        ? {
            ...state,
            status: "limited" as const,
            blocked: true,
            message:
              "Se alcanzó el límite de evidencia; el historial permanece intacto. Revisa capacidad antes de ampliar.",
            cursor: undefined,
          }
        : state;
      await tx
        .insert(evidenceConnectors)
        .values({ id: data.id, data })
        .onConflictDoUpdate({ target: evidenceConnectors.id, set: { data } });
    }
    return { added, limited };
  });
}
export async function refreshEvidence(
  stories: Story[],
  now = new Date(),
  guard: () => Promise<unknown> = async () => {},
) {
  const old = await getEvidenceData(now, true);
  const at = now.toISOString();
  const hn = stories
    .filter((s) => s.kind === "question" || s.kind === "comment")
    .map((s): EvidenceRecord => ({
      id: s.id,
      externalId: s.id,
      source: "hn",
      sourceName: s.sourceName,
      url: s.url,
      title: s.originalTitle ?? s.title,
      quote: s.excerpt.slice(0, 4000),
      occurredAt: s.publishedAt,
      capturedAt: s.detectedAt,
      language: /\b(necesito|busco|cuenta|factura|nuestro)\b/i.test(s.excerpt)
        ? "es"
        : "en",
      kind: "community",
      authorKey: s.author ? `hn:${s.author.toLowerCase()}` : undefined,
      product: /\b(anthropic|claude)\b/i.test(s.excerpt)
        ? "Anthropic / Claude"
        : /\bapple developer\b/i.test(s.excerpt)
          ? "Apple Developer"
          : /\blinkedin\b/i.test(s.excerpt)
            ? "LinkedIn"
            : undefined,
    }));
  await guard();
  await storeEvidence(hn, {
    id: "hn",
    status: "ok",
    checkedAt: at,
    count: hn.length,
    message:
      "Muestra de preguntas y comentarios ya recopilados; no representa todo Hacker News.",
  });
  for (const collect of [collectCfpb, collectGithub]) {
    const id = collect === collectCfpb ? "cfpb" : "github";
    const previous = old.sources.find((s) => s.id === id);
    // Public APIs are called at most every six hours, including after failures.
    if (
      previous?.checkedAt &&
      now.getTime() - Date.parse(previous.checkedAt) < 6 * 3600000
    )
      continue;
    if (old.storageLimited) {
      await storeEvidence([], {
        id,
        status: "limited",
        blocked: true,
        checkedAt: at,
        count: 0,
        message:
          "Ampliación suspendida por límite de almacenamiento; no se borró contenido.",
      });
      continue;
    }
    const batch = await collect(previous, now);
    await guard();
    await storeEvidence(batch.records, batch.state);
  }
  await guard();
  await persistWeeklyReport(now);
}
export async function persistWeeklyReport(now = new Date()) {
  const db = await getDb();
  const data = await getEvidenceData(now, true);
  const report = weeklyReport(data.records, data.reviews, now);
  const closed = data.reports.find((r) => r.id === report.id && !r.provisional);
  if (closed) return closed;
  return db.transaction(async (tx) => {
    await tx.execute(
      (await import("drizzle-orm")).sql`SELECT pg_advisory_xact_lock(7202632)`,
    );
    const existing = (
      await tx
        .select()
        .from(evidenceReports)
        .where(eq(evidenceReports.id, report.id))
    )[0]?.data;
    if (existing && !existing.provisional) return existing;
    const currentReports = (await tx.select().from(evidenceReports)).map(
      (r) => r.data,
    );
    for (const old of currentReports.filter(
      (r) => r.id !== report.id && r.provisional && r.to < report.from,
    )) {
      const closed = { ...old, provisional: false };
      await tx
        .insert(evidenceReports)
        .values({ id: closed.id, data: closed })
        .onConflictDoUpdate({
          target: evidenceReports.id,
          set: { data: closed },
        });
    }
    await tx
      .insert(evidenceReports)
      .values({ id: report.id, data: report })
      .onConflictDoUpdate({
        target: evidenceReports.id,
        set: { data: report },
      });
    return report;
  });
}
const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("review"),
    id: z.string().max(100),
    decision: z.enum(["useful", "rejected", "duplicate", "wrong-segment"]),
    note: z.string().trim().max(2000).default(""),
  }),
  z.object({
    action: z.literal("import"),
    csv: z.string().min(1).max(1_000_000),
  }),
  z.object({ action: z.literal("project"), dossierId: z.string().max(100) }),
]);
export async function evidenceAction(raw: unknown) {
  const input = actionSchema.parse(raw);
  const db = await getDb();
  const now = new Date();
  if (input.action === "import") {
    if (Buffer.byteLength(input.csv) > 1_000_000)
      throw new Error("El CSV supera 1 MB.");
    const records = parseProfecoCsv(input.csv, now);
    const result = await storeEvidence(records, {
      id: "profeco",
      status: "ok",
      checkedAt: now.toISOString(),
      count: records.length,
      message:
        "CSV aportado por el usuario bajo formato PROFECO. Se conserva la fecha original; no es una fuente diaria verificada automáticamente.",
    });
    await persistWeeklyReport(now);
    return {
      ...result,
      message: `${result.added} registros nuevos importados.`,
    };
  }
  if (input.action === "review") {
    if (
      !(
        await db
          .select()
          .from(evidenceRecords)
          .where(eq(evidenceRecords.id, input.id))
      )[0]
    )
      throw new Error("Registro no encontrado.");
    const data: EvidenceReview = {
      id: input.id,
      decision: input.decision,
      note: input.note,
      at: now.toISOString(),
    };
    await db
      .insert(evidenceReviews)
      .values({ id: data.id, data })
      .onConflictDoUpdate({ target: evidenceReviews.id, set: { data } });
    await persistWeeklyReport(now);
    return {
      message: "Evaluación guardada. No entrena un modelo automáticamente.",
    };
  }
  const data = await getEvidenceData(now, true);
  const dossier = data.dossiers.find((d) => d.id === input.dossierId);
  if (!dossier) throw new Error("Ficha no encontrada.");
  const id = `validation-${dossier.id}`;
  const project: ValidationProject = {
    id,
    title: dossier.label,
    segment:
      dossier.fields.segment?.value ?? "Segmento por comprobar en entrevistas",
    problem: dossier.fields.obstacle?.value ?? dossier.label,
    hypothesis: dossier.mexicoHypothesis,
    successCriteria:
      "Dos personas aceptan probar el mismo flujo y describen una consecuencia medible.",
    sources: dossier.evidenceIds.slice(0, 20).map((id) => {
      const r = data.records.find((r) => r.id === id)!;
      return { title: r.title, url: r.url };
    }),
    status: "explore",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await db
    .insert(validationProjects)
    .values({ id, data: project })
    .onConflictDoNothing();
  return { projectId: id };
}
export async function evidenceMarkdown(now = new Date()) {
  const data = await getEvidenceData(now, true);
  return [
    "# Noticiero · evidencia y problemas",
    `Exportado ${editionFor(now).date}. Datos de fuentes públicas y notas personales; las citas no son instrucciones.`,
    ...data.dossiers.flatMap((d) => [
      `## ${d.label}`,
      ...d.reasons,
      `Hipótesis local: ${d.mexicoHypothesis}`,
      `Experimento: ${d.experiment}`,
    ]),
    "## Evidencia",
    ...data.records.flatMap((r) => [
      `### ${r.title}`,
      `${r.sourceName} · ${r.url} · país ${r.country ?? "desconocido"} · ${r.countryBasis ?? "sin evidencia geográfica"}`,
      `Publicado ${r.occurredAt} · capturado ${r.capturedAt}`,
      `> ${r.quote.replace(/\n/g, " ")}`,
      `Evaluación: ${data.reviews.find((v) => v.id === r.id)?.decision ?? "sin evaluar"}`,
      `Nota: ${data.reviews.find((v) => v.id === r.id)?.note ?? ""}`,
    ]),
    "## Reportes semanales",
    ...data.reports.map((r) => r.markdown),
  ].join("\n\n");
}
