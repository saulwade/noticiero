import { z } from "zod";
import { hash } from "@/features/news/normalize";
import { editionFor } from "@/lib/time";
import { cooldown, failure, publicJson } from "./connectors";
import type {
  ConnectorBatch,
  ConnectorState,
  EvidenceRecord,
  EvidenceSource,
} from "./types";

export const PROFECO_RESOURCE = "e93eee6a-014b-4836-b47e-04744bfe109f";
export const PROFECO_CATALOG = `https://www.datos.gob.mx/dataset/quejas_materia_servicios/resource/${PROFECO_RESOURCE}`;
export const COLOMBIA_CATALOG = "https://www.datos.gov.co/d/xyy7-rn7p";
const CAP = 20;
const value = z.string().min(1).max(3000);
const profecoSchema = z.object({
  success: z.literal(true),
  result: z.object({
    records: z
      .array(
        z.object({
          id_expediente: value,
          fecha_ingreso: value,
          nombre_comercial: value,
          giro: value,
          motivo_reclamacion: value,
          estado_procesal: value,
        }),
      )
      .max(CAP),
  }),
});
const colombiaSchema = z
  .array(
    z.object({
      a_o_creacion: value,
      mes_creacion: value,
      motivo: value,
      producto: value,
      total: value,
    }),
  )
  .max(CAP);
function clean(value: string) {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[dato omitido]")
    .replace(/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/gi, "[dato omitido]")
    .replace(/\b\d[\d ()-]{8,}\d\b/g, "[dato omitido]")
    .replace(/[\u0000-\u001f<>]/g, " ")
    .trim()
    .slice(0, 500);
}
function calendar(value: string, now: Date) {
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const parsed = new Date(`${day}T12:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== day ||
    day < "2000-01-01" ||
    day > editionFor(now).date
  )
    return;
  return day;
}
function position(previous?: ConnectorState) {
  try {
    const p = JSON.parse(previous?.cursor ?? "{}");
    return typeof p.offset === "number" &&
      Number.isSafeInteger(p.offset) &&
      p.offset >= 0 &&
      p.offset <= 10000
      ? p.offset
      : 0;
  } catch {
    return 0;
  }
}
function fail(
  id: EvidenceSource,
  previous: ConnectorState | undefined,
  now: Date,
  error: unknown,
): ConnectorBatch {
  const batch = failure(id, previous, now, error);
  if (id === "profeco" && batch.state.blocked) {
    try {
      batch.state.cursor = JSON.stringify({
        ...JSON.parse(batch.state.cursor ?? "{}"),
        offset: position(previous),
      });
    } catch {
      /* Preserve normal cooldown if cursor is unavailable. */
    }
  }
  return batch;
}

/** Official datastore sample; never download its 250 MB CSV or an unbounded catalog. */
export async function collectProfeco(
  previous?: ConnectorState,
  now = new Date(),
  fetcher: typeof fetch = fetch,
): Promise<ConnectorBatch> {
  const paused = cooldown("profeco", previous, now);
  if (paused) return paused;
  try {
    const offset = position(previous);
    let headNext = offset === 0;
    try {
      headNext = JSON.parse(previous?.cursor ?? "{}").headNext ?? headNext;
    } catch {
      /* Start with current head. */
    }
    const requestedOffset = headNext ? 0 : offset;
    const url = new URL(
      "https://www.datos.gob.mx/api/3/action/datastore_search",
    );
    url.search = new URLSearchParams({
      resource_id: PROFECO_RESOURCE,
      limit: String(CAP),
      offset: String(requestedOffset),
      sort: "_id desc",
      fields:
        "id_expediente,fecha_ingreso,nombre_comercial,giro,motivo_reclamacion,estado_procesal",
    }).toString();
    const data = profecoSchema.parse(await publicJson(url, now, fetcher));
    const records: EvidenceRecord[] = [];
    for (const row of data.result.records) {
      const day = calendar(row.fecha_ingreso, now);
      if (!day) continue;
      const issue = clean(row.motivo_reclamacion),
        sector = clean(row.giro),
        status = clean(row.estado_procesal);
      if (!issue || !sector) continue;
      records.push({
        id: `profeco:${hash(row.id_expediente)}`,
        externalId: row.id_expediente,
        source: "profeco",
        sourceName: "PROFECO · datos.gob.mx",
        url: PROFECO_CATALOG,
        title: issue,
        quote: `Motivo administrativo: ${issue}. Giro: ${sector}. Estado procesal: ${status}. Registro estructurado, sin narrativa personal.`,
        issue,
        product: clean(row.nombre_comercial),
        segment: `Usuarios · ${sector}`,
        occurredAt: day,
        capturedAt: now.toISOString(),
        language: "es",
        kind: "complaint",
        country: "MX",
        countryBasis:
          "Registro del conjunto oficial nacional de PROFECO; no se infiere residencia individual.",
        historical:
          Date.parse(`${day}T12:00:00Z`) < now.getTime() - 30 * 86400000,
        resolution: /^conciliada$/i.test(status)
          ? "resolved"
          : /^no conciliada$/i.test(status)
            ? "unresolved"
            : "unknown",
      });
    }
    const exhausted = data.result.records.length < CAP;
    const nextOffset = exhausted
      ? 0
      : headNext
        ? Math.max(CAP, offset)
        : offset + CAP >= 10000
          ? CAP
          : offset + CAP;
    return {
      records,
      state: {
        id: "profeco",
        status: "limited",
        checkedAt: now.toISOString(),
        count: records.length,
        cursor: JSON.stringify({
          offset: nextOffset,
          headNext: exhausted || !headNext,
        }),
        message: `Muestra automática de hasta ${CAP} casos por ciclo del datastore oficial; alterna publicaciones de cabecera y antecedentes paginados. Fecha original y estado conservados; los antecedentes no prueban demanda actual. ${data.result.records.length - records.length} filas descartadas por fecha/campos inválidos. Cobertura parcial; sin narrativa ni datos de denunciantes.`,
      },
    };
  } catch (error) {
    return fail("profeco", previous, now, error);
  }
}

/** SFC's monthly totals are context, not twenty individual customers or testimonies. */
export async function collectColombia(
  previous?: ConnectorState,
  now = new Date(),
  fetcher: typeof fetch = fetch,
): Promise<ConnectorBatch> {
  const paused = cooldown("sfc-co", previous, now);
  if (paused) return paused;
  try {
    const today = editionFor(now).date,
      [year, month] = today.split("-").map(Number);
    const url = new URL("https://www.datos.gov.co/resource/xyy7-rn7p.json");
    url.search = new URLSearchParams({
      $select:
        "a_o_creacion,mes_creacion,motivo,producto,sum(cantidad_quejas_recibidas) as total",
      $group: "a_o_creacion,mes_creacion,motivo,producto",
      $where: `a_o_creacion >= ${year - 1} AND (a_o_creacion < ${year} OR mes_creacion <= ${month})`,
      $order:
        "a_o_creacion DESC,mes_creacion DESC,total DESC,motivo ASC,producto ASC",
      $limit: String(CAP),
    }).toString();
    const data = colombiaSchema.parse(await publicJson(url, now, fetcher));
    const records: EvidenceRecord[] = [];
    for (const row of data) {
      const y = Number(row.a_o_creacion),
        m = Number(row.mes_creacion),
        total = Number(row.total);
      if (
        !Number.isInteger(y) ||
        !Number.isInteger(m) ||
        m < 1 ||
        m > 12 ||
        !Number.isSafeInteger(total) ||
        total < 1
      )
        continue;
      const period = `${y}-${String(m).padStart(2, "0")}`,
        day = calendar(`${period}-01`, now);
      if (!day) continue;
      const issue = clean(row.motivo),
        product = clean(row.producto);
      const externalId = hash(`${period}:${issue}:${product}`);
      records.push({
        id: `sfc-co:${externalId}`,
        externalId,
        source: "sfc-co",
        sourceName: "Superfinanciera de Colombia · datos.gov.co",
        url: COLOMBIA_CATALOG,
        title: `${issue} · ${product}`,
        quote: `Periodo mensual: ${period}. Producto: ${product}. Motivo: ${issue}. Cantidad de quejas recibidas: ${total}. Total agregado de la muestra oficial; no es narrativa ni identidad individual.`,
        issue,
        product,
        occurredAt: day,
        period,
        aggregateCount: total,
        capturedAt: now.toISOString(),
        language: "es",
        kind: "statistic",
        country: "CO",
        countryBasis:
          "Cobertura nacional declarada por la Superintendencia Financiera de Colombia; total agregado, sin residencia individual.",
        historical:
          Date.parse(`${day}T12:00:00Z`) < now.getTime() - 30 * 86400000,
      });
    }
    return {
      records,
      state: {
        id: "sfc-co",
        status: "limited",
        checkedAt: now.toISOString(),
        count: records.length,
        message: `Hasta ${CAP} grupos mensuales por producto/motivo del conjunto oficial xyy7-rn7p. Estadísticas agregadas, no testimonios ni autores. La fecha representa el inicio del periodo indicado; no crecimiento diario ni censo completo.`,
      },
    };
  } catch (error) {
    return fail("sfc-co", previous, now, error);
  }
}
