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
export const PROFECO_TELECOM_RESOURCE = "fd854822-65a6-47d1-86f9-5b406b72dd6d";
export const PROFECO_TELECOM_CATALOG = `https://www.datos.gob.mx/dataset/quejas_materia_telecomunicaciones/resource/${PROFECO_TELECOM_RESOURCE}`;
export const COLOMBIA_CATALOG = "https://www.datos.gov.co/d/xyy7-rn7p";
const CAP = 20;
async function colombiaJson(url: URL, now: Date, fetcher: typeof fetch) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await publicJson(url, now, fetcher, 30000);
    } catch (error) {
      const transient =
        error instanceof Error &&
        (/^HTTP 5\d\d$/.test(error.message) ||
          ["TypeError", "TimeoutError", "AbortError"].includes(error.name));
      if (!transient || attempt === 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Consulta pública no disponible.");
}
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
  if (id === "sfc-co" && batch.state.blocked) {
    try {
      batch.state.cursor = JSON.stringify({
        ...JSON.parse(previous?.cursor ?? "{}"),
        ...JSON.parse(batch.state.cursor ?? "{}"),
      });
    } catch {
      /* Retain the valid provider cooldown on a malformed legacy cursor. */
    }
  }
  if ((id === "profeco" || id === "profeco-telecom") && batch.state.blocked) {
    try {
      batch.state.cursor = JSON.stringify({
        ...JSON.parse(previous?.cursor ?? "{}"),
        ...JSON.parse(batch.state.cursor ?? "{}"),
        offset: position(previous),
      });
    } catch {
      /* Preserve normal cooldown if cursor is unavailable. */
    }
  }
  return batch;
}

/** Official bounded samples; resources share an authority, never independent voices. */
export function collectProfeco(
  previous?: ConnectorState,
  now = new Date(),
  fetcher: typeof fetch = fetch,
) {
  return collectProfecoResource("profeco", previous, now, fetcher);
}
export function collectProfecoTelecom(
  previous?: ConnectorState,
  now = new Date(),
  fetcher: typeof fetch = fetch,
) {
  return collectProfecoResource("profeco-telecom", previous, now, fetcher);
}
async function collectProfecoResource(
  id: "profeco" | "profeco-telecom",
  previous: ConnectorState | undefined,
  now: Date,
  fetcher: typeof fetch,
): Promise<ConnectorBatch> {
  const paused = cooldown(id, previous, now);
  if (paused) return paused;
  try {
    const telecom = id === "profeco-telecom";
    let cursor: {
      version?: string;
      offset?: number;
      headNext?: boolean;
      legacyOffset?: number;
    } = {};
    try {
      cursor = JSON.parse(previous?.cursor ?? "{}");
    } catch {
      /* Reset malformed traversal without touching evidence. */
    }
    const currentOrder = cursor.version === "date-v1";
    const offset = currentOrder ? position(previous) : 0;
    const headNext = currentOrder ? (cursor.headNext ?? offset === 0) : true;
    const requestedOffset = headNext ? 0 : offset;
    const url = new URL(
      "https://www.datos.gob.mx/api/3/action/datastore_search",
    );
    url.search = new URLSearchParams({
      resource_id: telecom ? PROFECO_TELECOM_RESOURCE : PROFECO_RESOURCE,
      limit: String(CAP),
      offset: String(requestedOffset),
      sort: "fecha_ingreso desc, _id desc",
      fields: `${telecom ? "expediente" : "id_expediente"},fecha_ingreso,nombre_comercial,giro,motivo_reclamacion,estado_procesal`,
    }).toString();
    const raw = await publicJson(url, now, fetcher);
    // Only the documented telecom ID alias differs; never infer a schema from arbitrary columns.
    if (telecom && raw && typeof raw === "object") {
      const result = (raw as { result?: { records?: unknown } }).result;
      if (Array.isArray(result?.records))
        result.records = result.records.map((r: Record<string, unknown>) => ({
          ...r,
          id_expediente: r.expediente,
        }));
    }
    const data = profecoSchema.parse(raw),
      records: EvidenceRecord[] = [];
    for (const row of data.result.records) {
      if (!/^[\p{L}\p{N}./_ -]{1,120}$/u.test(row.id_expediente)) continue;
      const rawDate = telecom
        ? row.fecha_ingreso.replace(/^(\d{4})\/(\d{2})\/(\d{2})$/, "$1-$2-$3")
        : row.fecha_ingreso;
      const date = calendar(rawDate, now);
      if (!date) continue;
      const issue = clean(row.motivo_reclamacion),
        sector = clean(row.giro),
        status = clean(row.estado_procesal);
      if (!issue || !sector) continue;
      records.push({
        id: `${id}:${hash(row.id_expediente)}`,
        externalId: row.id_expediente,
        source: id,
        sourceName: telecom
          ? "PROFECO · telecomunicaciones (CC BY 4.0)"
          : "PROFECO · datos.gob.mx",
        url: telecom ? PROFECO_TELECOM_CATALOG : PROFECO_CATALOG,
        title: issue,
        quote: `Motivo administrativo: ${issue}. Giro: ${sector}. Estado procesal: ${status}. Registro estructurado, sin narrativa personal.`,
        issue,
        product: clean(row.nombre_comercial),
        segment: `Usuarios · ${sector}`,
        occurredAt: date,
        capturedAt: now.toISOString(),
        language: "es",
        kind: "complaint",
        country: "MX",
        countryBasis:
          "Registro del conjunto oficial nacional de PROFECO; no se infiere residencia individual.",
        historical:
          Date.parse(`${date}T12:00:00Z`) < now.getTime() - 30 * 86400000,
        resolution: /^conciliada$/i.test(status)
          ? "resolved"
          : /^no conciliada$/i.test(status)
            ? "unresolved"
            : "unknown",
      });
    }
    if (data.result.records.length > 0 && records.length === 0)
      throw new Error("La muestra no contiene fechas/campos válidos.");
    const exhausted = data.result.records.length < CAP;
    const nextOffset = exhausted
      ? 0
      : headNext
        ? Math.max(CAP, offset)
        : offset + CAP >= 10000
          ? CAP
          : offset + CAP;
    const latest = records
      .map((r) => r.occurredAt)
      .sort()
      .at(-1);
    return {
      records,
      state: {
        id,
        status: "limited",
        checkedAt: now.toISOString(),
        count: records.length,
        cursor: JSON.stringify({
          version: "date-v1",
          offset: nextOffset,
          headNext: exhausted || !headNext,
          legacyOffset: currentOrder ? cursor.legacyOffset : position(previous),
        }),
        message: `Muestra automática de hasta ${CAP} casos por ciclo del datastore oficial; cabecera por fecha y antecedentes paginados. ${data.result.records.length - records.length} filas descartadas por fecha/campos inválidos. Última fecha válida en este lote: ${latest ?? "ninguna"}. Fecha original y estado conservados; los antecedentes no prueban demanda actual. Cobertura parcial; sin narrativa ni datos de denunciantes. ${telecom ? "Recurso de telecomunicaciones del mismo organismo; no es una familia independiente de PROFECO." : ""}`,
      },
    };
  } catch (error) {
    return fail(id, previous, now, error);
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
    // A scalar MAX avoids globally sorting millions of complaint rows just to find one period.
    url.search = new URLSearchParams({
      $select: "max(a_o_creacion*100+mes_creacion) as periodo",
      $where: `a_o_creacion >= ${year - 1} AND (a_o_creacion < ${year} OR (a_o_creacion = ${year} AND mes_creacion <= ${month})) AND mes_creacion >= 1 AND mes_creacion <= 12`,
    }).toString();
    const periodRows = z
      .array(z.object({ periodo: value }))
      .max(1)
      .parse(await colombiaJson(url, now, fetcher));
    const latest = periodRows[0];
    if (!latest) throw new Error("No hay un periodo publicado verificable.");
    if (!/^\d{6}$/.test(latest.periodo))
      throw new Error("Periodo agregado inválido.");
    const latestYear = Number(latest.periodo.slice(0, 4)),
      latestMonth = Number(latest.periodo.slice(4));
    if (
      !Number.isInteger(latestYear) ||
      latestYear < year - 1 ||
      latestYear > year ||
      !Number.isInteger(latestMonth) ||
      latestMonth < 1 ||
      latestMonth > 12 ||
      !calendar(`${latestYear}-${String(latestMonth).padStart(2, "0")}-01`, now)
    )
      throw new Error("Periodo publicado inválido.");
    const periodKey = `${latestYear}-${String(latestMonth).padStart(2, "0")}`;
    let scanOffset = 0,
      head = true;
    try {
      const cursor = JSON.parse(previous?.cursor ?? "{}");
      if (
        cursor.period === periodKey &&
        Number.isSafeInteger(cursor.offset) &&
        cursor.offset >= 0 &&
        cursor.offset <= 10000 &&
        typeof cursor.headNext === "boolean"
      ) {
        scanOffset = cursor.offset;
        head = cursor.headNext;
      }
    } catch {
      /* A legacy cursor starts at the head; stored evidence is unchanged. */
    }
    const offset = head ? 0 : scanOffset;
    url.search = new URLSearchParams({
      $select:
        "a_o_creacion,mes_creacion,motivo,producto,sum(cantidad_quejas_recibidas) as total",
      $group: "a_o_creacion,mes_creacion,motivo,producto",
      $where: `a_o_creacion = ${latestYear} AND mes_creacion = ${latestMonth}`,
      $order:
        "a_o_creacion DESC,mes_creacion DESC,total DESC,motivo ASC,producto ASC",
      $limit: String(CAP),
      $offset: String(offset),
    }).toString();
    const data = colombiaSchema.parse(await colombiaJson(url, now, fetcher));
    const records: EvidenceRecord[] = [];
    for (const row of data) {
      const y = Number(row.a_o_creacion),
        m = Number(row.mes_creacion),
        total = Number(row.total);
      if (
        !Number.isInteger(y) ||
        y !== latestYear ||
        m !== latestMonth ||
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
        cursor: JSON.stringify({
          period: periodKey,
          offset: head
            ? Math.max(scanOffset, CAP)
            : data.length < CAP || offset + CAP >= 10000
              ? 0
              : offset + CAP,
          headNext: !head || data.length < CAP,
        }),
        message: `Hasta ${CAP} grupos por consulta del último periodo publicado ${periodKey}, alternando cabecera y páginas por producto/motivo del conjunto oficial xyy7-rn7p. Estadísticas agregadas, no testimonios ni autores. La fecha representa el inicio del periodo indicado; no crecimiento diario ni censo completo.`,
      },
    };
  } catch (error) {
    return fail("sfc-co", previous, now, error);
  }
}
