import type { Instrument } from "./types";
import { movementSchema } from "./validation";
const columns = [
  "date",
  "kind",
  "symbol",
  "exchange",
  "currency",
  "quantity",
  "price",
  "amount",
  "fee",
  "fxRate",
  "note",
  "reference",
];
export function parseFinanceCsv(csv: string, instruments: Instrument[]) {
  if (Buffer.byteLength(csv) > 1_000_000)
    throw new Error("El CSV supera 1 MB.");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  const source = csv.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
      continue;
    }
    if (c === '"') {
      if (field || closed) throw new Error("Comillas inválidas en CSV.");
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
      closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((s) => s.trim())) rows.push(row);
      row = [];
      field = "";
      closed = false;
    } else {
      if (closed) throw new Error("Texto después de comillas en CSV.");
      field += c;
    }
    if (rows.length > 501) throw new Error("Máximo 500 movimientos por CSV.");
  }
  if (quoted) throw new Error("Comillas sin cerrar.");
  row.push(field);
  if (row.some((s) => s.trim())) rows.push(row);
  const header = rows.shift()?.map((s) => s.trim());
  if (!header || header.join() !== columns.join())
    throw new Error(`Columnas requeridas: ${columns.join(",")}`);
  if (!rows.length || rows.length > 500)
    throw new Error("El CSV requiere entre 1 y 500 movimientos.");
  return rows.map((cells, index) => {
    if (cells.length !== columns.length)
      throw new Error(`Fila ${index + 2}: número de columnas incorrecto.`);
    const values = Object.fromEntries(
      columns.map((c, i) => [c, cells[i].trim()]),
    );
    const symbol = values.symbol.toUpperCase();
    const instrument = symbol
      ? instruments.find(
          (i) =>
            i.symbol === symbol &&
            i.exchange.toUpperCase() === values.exchange.toUpperCase() &&
            i.currency === values.currency,
        )
      : undefined;
    if (symbol && !instrument)
      throw new Error(
        `Fila ${index + 2}: registra primero el instrumento y mercado.`,
      );
    const result = movementSchema.safeParse({
      kind: values.kind,
      date: values.date,
      currency: values.currency,
      instrumentId: instrument?.id,
      quantity: values.quantity || undefined,
      price: values.price || undefined,
      amount: values.amount || "0",
      fee: values.fee || "0",
      fxRate: values.fxRate || undefined,
      note: values.note,
      reference: values.reference || undefined,
    });
    if (!result.success)
      throw new Error(`Fila ${index + 2}: ${result.error.issues[0].message}`);
    return result.data;
  });
}
