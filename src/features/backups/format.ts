import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";

export const backupColumns: Record<string, string[]> = {
  finance_news_events: ["id", "data"],
  finance_news_reviews: ["id", "data"],
  finance_news_briefs: ["id", "data"],
  finance_sync: ["id", "data"],
  finance_instruments: ["id", "data"],
  finance_movements: ["id", "data"],
  finance_marks: ["id", "data"],
  finance_policies: ["id", "data"],
  finance_theses: ["id", "data"],
  finance_decisions: ["id", "data"],
  finance_research: ["id", "data"],
  evidence_records: ["id", "data"],
  evidence_reviews: ["id", "data"],
  evidence_connectors: ["id", "data"],
  evidence_reports: ["id", "data"],
  stories: ["id", "url", "data"],
  opportunities: ["id", "data"],
  quotes: ["symbol", "data"],
  quote_history: ["id", "data"],
  source_states: ["id", "data"],
  jobs: ["id", "data"],
  editions: ["key", "data"],
  saved_items: ["id", "data"],
  read_items: ["id"],
  usage: ["key", "amount"],
  settings: ["key", "data"],
  opportunity_batches: ["key", "idea_ids"],
  research_models: ["id", "data"],
  research_notes: ["id", "data"],
  research_signals: ["id", "data"],
  daily_reports: ["date", "data"],
  opportunity_events: ["id", "data"],
  research_observations: ["id", "data"],
  validation_projects: ["id", "data"],
  interviews: ["id", "data"],
  operation_alerts: ["id", "data"],
  backup_runs: ["id", "data"],
};
export type BackupSnapshot = {
  version: 1;
  createdAt: string;
  tables: { name: string; rows: Record<string, unknown>[] }[];
};
const magic = Buffer.from("NOTICIERO_BACKUP_V1\n");
export function encryptionKey(value: string) {
  const key = Buffer.from(value, "base64");
  if (key.length !== 32)
    throw new Error("La clave debe contener 32 bytes en base64.");
  return key;
}
export function validateSnapshot(raw: unknown): BackupSnapshot {
  const data = raw as BackupSnapshot;
  if (
    !data ||
    data.version !== 1 ||
    !Number.isFinite(Date.parse(data.createdAt)) ||
    !Array.isArray(data.tables) ||
    ![22, 26, 33, 34, Object.keys(backupColumns).length].includes(
      data.tables.length,
    )
  )
    throw new Error("Formato de respaldo incompatible.");
  const names = new Set<string>();
  for (const table of data.tables) {
    const columns = backupColumns[table.name];
    if (!columns || names.has(table.name) || !Array.isArray(table.rows))
      throw new Error("Tablas de respaldo inválidas.");
    names.add(table.name);
    for (const row of table.rows) {
      if (
        !row ||
        typeof row !== "object" ||
        Array.isArray(row) ||
        Object.keys(row).sort().join() !== [...columns].sort().join()
      )
        throw new Error("Columnas de respaldo inválidas.");
      for (const column of columns) {
        const value = row[column];
        if (column === "data") {
          if (!value || typeof value !== "object" || Array.isArray(value))
            throw new Error("Documento inválido.");
        } else if (column === "idea_ids") {
          if (
            !Array.isArray(value) ||
            !value.every((item) => typeof item === "string")
          )
            throw new Error("Referencias inválidas.");
        } else if (column === "amount") {
          if (typeof value !== "number" || !Number.isFinite(value))
            throw new Error("Importe inválido.");
        } else if (typeof value !== "string" || value.length === 0)
          throw new Error("Identificador inválido.");
      }
    }
  }
  const required = Object.keys(backupColumns).filter((name) =>
    data.tables.length === 22
      ? !name.startsWith("evidence_") && !name.startsWith("finance_")
      : data.tables.length === 26
        ? !name.startsWith("finance_")
        : data.tables.length === 33
          ? name !== "finance_sync" && !name.startsWith("finance_news_")
          : data.tables.length === 34
            ? !name.startsWith("finance_news_")
            : true,
  );
  if (required.some((name) => !names.has(name)))
    throw new Error("Faltan tablas de respaldo.");
  return data;
}
export function sealBackup(snapshot: BackupSnapshot, key: string) {
  validateSnapshot(snapshot);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(key), iv);
  cipher.setAAD(magic);
  const encrypted = Buffer.concat([
    cipher.update(gzipSync(Buffer.from(JSON.stringify(snapshot)))),
    cipher.final(),
  ]);
  return Buffer.concat([magic, iv, cipher.getAuthTag(), encrypted]);
}
export function openBackup(bytes: Buffer, key: string): BackupSnapshot {
  if (
    bytes.length < magic.length + 29 ||
    !bytes.subarray(0, magic.length).equals(magic)
  )
    throw new Error("Archivo de respaldo desconocido.");
  const start = magic.length;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(key),
    bytes.subarray(start, start + 12),
  );
  decipher.setAAD(magic);
  decipher.setAuthTag(bytes.subarray(start + 12, start + 28));
  const compressed = Buffer.concat([
    decipher.update(bytes.subarray(start + 28)),
    decipher.final(),
  ]);
  return validateSnapshot(
    JSON.parse(
      gunzipSync(compressed, { maxOutputLength: 250000000 }).toString("utf8"),
    ),
  );
}
export function backupManifest(snapshot: BackupSnapshot, bytes: Buffer) {
  return {
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    counts: Object.fromEntries(
      snapshot.tables.map((table) => [table.name, table.rows.length]),
    ),
  };
}
