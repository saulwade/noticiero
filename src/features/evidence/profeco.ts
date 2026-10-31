import type { EvidenceRecord } from "./types";

export const PROFECO_CSV_MAX_BYTES = 1_048_576;
export const PROFECO_CSV_MAX_ROWS = 500;
export const PROFECO_DATASET_URL =
  "https://www.datos.gob.mx/dataset/quejas_materia_servicios";

/** Recognized individual-complaint schema (never aggregate statistics):
 * expediente + fecha_ingreso + proveedor + (motivo_reclamacion or giro).
 * Explicit aliases below cover accents, spaces and underscores in official exports.
 * https://www.datos.gob.mx/dataset/quejas_materia_servicios/resource/e93eee6a-014b-4836-b47e-04744bfe109f
 * Catalog confirms expediente/date/provider/giro; source download was inaccessible at implementation.
 * Unknown columns, including names, addresses, RFC, CURP, telephone, email and free-text accounts,
 * are discarded. CSV schema validation does not authenticate a file's provenance.
 */
const ALIASES = {
  id: [
    "expediente",
    "numero_expediente",
    "numero_de_expediente",
    "no_expediente",
    "folio",
  ],
  date: [
    "fecha_ingreso",
    "fecha_de_ingreso",
    "fecha_recepcion",
    "fecha_de_recepcion",
    "fecha_presentacion",
    "fecha_de_presentacion",
    "fecha_de_presentacion_de_la_queja",
  ],
  provider: [
    "proveedor",
    "nombre_del_proveedor",
    "nombre_proveedor",
    "razon_social",
    "nombre_comercial",
  ],
  issue: [
    "motivo",
    "motivo_reclamacion",
    "motivo_de_reclamacion",
    "motivo_de_la_reclamacion",
    "motivos_de_reclamacion",
    "motivo_queja",
    "motivo_de_la_queja",
  ],
  category: ["giro", "giro_comercial", "giro_del_proveedor", "sector"],
  status: ["estado_procesal", "estatus_procesal"],
} as const;
type Column = keyof typeof ALIASES;
function header(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
function parseRows(csv: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const pushCell = () => {
    row.push(cell);
    cell = "";
    closed = false;
  };
  const pushRow = () => {
    pushCell();
    if (row.some((value) => value.trim())) rows.push(row);
    row = [];
    if (rows.length > PROFECO_CSV_MAX_ROWS + 1)
      throw new Error("El CSV supera 500 filas de datos.");
  };
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (quoted) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += char;
    } else if (char === '"') {
      if (cell.length || closed)
        throw new Error("Comillas malformadas en el CSV.");
      quoted = true;
    } else if (char === delimiter) pushCell();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && csv[i + 1] === "\n") i++;
      pushRow();
    } else {
      if (closed) throw new Error("Contenido después del cierre de comillas.");
      cell += char;
    }
  }
  if (quoted) throw new Error("Comillas sin cerrar en el CSV.");
  if (cell || row.length || closed) pushRow();
  return rows;
}
function parseDate(value: string, row: number): string {
  let year: number, month: number, day: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (iso) [, year, month, day] = iso.map(Number);
  else if (local) [, day, month, year] = local.map(Number);
  else
    throw new Error(
      `Fecha no reconocida en fila ${row}: use AAAA-MM-DD o DD/MM/AAAA.`,
    );
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1900 ||
    year > 2100 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    throw new Error(`Fecha inválida en fila ${row}.`);
  // Administrative receipt records contain a calendar day, not a midnight event.
  return date.toISOString().slice(0, 10);
}
function publicValue(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[dato personal omitido]")
    .replace(/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/gi, "[dato personal omitido]")
    .replace(
      /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/gi,
      "[dato personal omitido]",
    )
    .replace(/(?:\+?\d[\d ()-]{8,}\d)/g, "[dato personal omitido]")
    .trim()
    .slice(0, 600);
}

export function parseProfecoCsv(
  csv: string,
  now = new Date(),
): EvidenceRecord[] {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  if (new TextEncoder().encode(csv).byteLength > PROFECO_CSV_MAX_BYTES)
    throw new Error("El CSV supera 1 MiB.");
  csv = csv.replace(/^\uFEFF/, "");
  // Delimiters are decided only from the header, outside quoted values.
  let quoted = false,
    commas = 0,
    semicolons = 0;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') i++;
      else quoted = !quoted;
    }
    if (!quoted && /[\r\n]/.test(char)) break;
    if (!quoted && char === ",") commas++;
    if (!quoted && char === ";") semicolons++;
  }
  const rows = parseRows(csv, semicolons > commas ? ";" : ",");
  if (rows.length < 2)
    throw new Error("El CSV debe contener encabezados y al menos una queja.");
  const headers = rows[0].map(header);
  if (
    new Set(headers).size !== headers.length ||
    headers.some((value) => !value)
  )
    throw new Error("Encabezados vacíos o duplicados.");
  const columns: Partial<Record<Column, number>> = {};
  for (const [key, aliases] of Object.entries(ALIASES)) {
    const indexes = headers.flatMap((value, index) =>
      (aliases as readonly string[]).includes(value) ? [index] : [],
    );
    // Provider + trade name and giro + sector are normal official paired columns; prefer documented alias order.
    if (indexes.length)
      columns[key as Column] = aliases
        .map((alias) => headers.indexOf(alias))
        .find((index) => index >= 0);
    if (indexes.length > 1 && key !== "provider" && key !== "category")
      throw new Error(`Columnas ambiguas para ${key}.`);
  }
  if (
    columns.id === undefined ||
    columns.date === undefined ||
    columns.provider === undefined ||
    (columns.issue === undefined && columns.category === undefined)
  )
    throw new Error(
      "Esquema PROFECO no reconocido: requiere expediente, fecha de ingreso, proveedor y motivo o giro.",
    );
  const records = new Map<string, EvidenceRecord>();
  for (const [index, row] of rows.slice(1).entries()) {
    const rowNumber = index + 2;
    if (row.length !== headers.length)
      throw new Error(`Número de columnas inválido en fila ${rowNumber}.`);
    const read = (key: Column) =>
      columns[key] === undefined ? "" : row[columns[key]!].trim();
    const externalId = read("id");
    if (!/^[\p{L}\p{N}./_ -]{1,120}$/u.test(externalId) || /@/.test(externalId))
      throw new Error(`Expediente inválido o ausente en fila ${rowNumber}.`);
    const occurredAt = parseDate(read("date"), rowNumber);
    if (occurredAt > today)
      throw new Error(`Fecha futura en fila ${rowNumber}.`);
    const provider = publicValue(read("provider")),
      issue = publicValue(read("issue")),
      category = publicValue(read("category")),
      status = publicValue(read("status"));
    if (!provider || (!issue && !category))
      throw new Error(
        `Proveedor y motivo o giro requeridos en fila ${rowNumber}.`,
      );
    const record: EvidenceRecord = {
      id: `profeco:${encodeURIComponent(externalId)}`,
      externalId,
      source: "profeco",
      sourceName: "PROFECO · CSV aportado (CC BY 4.0)",
      url: PROFECO_DATASET_URL,
      title: `Queja registrada: ${issue || category}`.slice(0, 240),
      quote: `Registro administrativo, sin narrativa personal. Proveedor: ${provider}.${issue ? ` Motivo de reclamación: ${issue}.` : ""}${category ? ` Giro/sector: ${category}.` : ""}${status ? ` Estado procesal: ${status}.` : ""}`,
      occurredAt,
      capturedAt: now.toISOString(),
      language: "es",
      kind: "complaint",
      country: "MX",
      countryBasis:
        "Jurisdicción del conjunto PROFECO México; procedencia declarada por quien importa, sin verificar residencia.",
      product: provider,
      ...(issue ? { issue } : {}),
      historical: Date.parse(today) - Date.parse(occurredAt) > 30 * 86_400_000,
    };
    const existing = records.get(record.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(record))
      throw new Error(
        `Expediente duplicado con datos contradictorios en fila ${rowNumber}.`,
      );
    records.set(record.id, record);
  }
  return [...records.values()];
}
