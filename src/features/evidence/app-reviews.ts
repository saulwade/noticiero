import { z } from "zod";
import { hash, plainText } from "@/features/news/normalize";
import { normalizedText } from "@/features/research/evidence-text";
import { cooldown, failure, publicJson } from "./connectors";
import type { ConnectorBatch, ConnectorState, EvidenceRecord } from "./types";

// IDs/name/genre checked with Apple's public lookup on 2026-11-17.
export const consumerApps = [
  { id: "570060128", name: "Duolingo", category: "idiomas" },
  { id: "379968583", name: "Busuu", category: "idiomas" },
  { id: "458023433", name: "Splitwise", category: "gastos-compartidos" },
  { id: "572688855", name: "Todoist", category: "organizacion-personal" },
  { id: "580669177", name: "Bring!", category: "listas-compras" },
  { id: "498477945", name: "Moovit", category: "movilidad" },
] as const;
export const consumerStorefronts = [
  "es",
  "mx",
  "ar",
  "co",
  "cl",
  "pe",
  "us",
] as const;
const pairs = consumerStorefronts.flatMap((store) =>
  consumerApps.map((app) => ({ store, app })),
);
const label = z.object({ label: z.string().min(1).max(16000) });
const review = z.object({
  id: label,
  title: label,
  content: label,
  updated: label,
  "im:rating": z.object({ label: z.enum(["1", "2", "3", "4", "5"]) }),
  author: z.object({ uri: label.optional() }).optional(),
});
const feed = z.object({
  feed: z.object({ entry: z.array(z.unknown()).max(50).optional() }),
});
const cursorSchema = z.object({
  offset: z
    .number()
    .int()
    .min(0)
    .max(pairs.length - 1),
  retries: z
    .array(
      z.object({
        index: z
          .number()
          .int()
          .min(0)
          .max(pairs.length - 1),
        after: z.string().datetime(),
      }),
    )
    .max(pairs.length),
  retryAt: z.string().datetime().optional(),
});

/** Conservative text evidence; storefront is neither language nor residence. */
export function spanishReview(text: string) {
  const words = new Set(normalizedText(text).match(/[a-z]+/g) ?? []);
  const es = [
    "mi",
    "me",
    "que",
    "para",
    "con",
    "una",
    "los",
    "las",
    "del",
    "por",
    "porque",
    "pero",
    "cuando",
    "puedo",
    "funciona",
    "quiero",
    "necesito",
    "desde",
    "siempre",
    "cada",
    "tengo",
    "hay",
    "como",
    "mis",
    "esta",
  ].filter((w) => words.has(w)).length;
  const en = [
    "the",
    "and",
    "this",
    "that",
    "with",
    "for",
    "have",
    "cannot",
    "my",
    "every",
    "does",
    "doesnt",
    "would",
  ].filter((w) => words.has(w)).length;
  return es >= 4 && es >= en + 2;
}
function redact(text: string) {
  return plainText(text)
    .replace(/(?:https?:\/\/|www\.)\S+/gi, "[enlace omitido]")
    .replace(
      /\b(?:t\.me|wa\.me|telegram\.me|instagram\.com|facebook\.com|wa\.link)\/\S+/gi,
      "[contacto omitido]",
    )
    .replace(
      /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/giu,
      "[contacto omitido]",
    )
    .replace(/@[\p{L}\p{N}_]{2,}/gu, "[contacto omitido]")
    .replace(/\b\d[\d ()+.-]{6,}\d\b/g, "[dato omitido]")
    .replace(
      /\b(?:mi\s+)?(?:telegram|instagram|usuario|handle|whatsapp)\s*(?:es|:|=)\s*[^\s,;.!?]{2,80}/gi,
      "[contacto omitido]",
    )
    .replace(
      /\b(?:mi direcci[oó]n es|domicilio:)\s*[^.!?\n]+/gi,
      "[dirección omitida]",
    )
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim();
}
export function parseAppReviews(
  raw: unknown,
  app: (typeof consumerApps)[number],
  now: Date,
): EvidenceRecord[] {
  const data = feed.parse(raw),
    result: EvidenceRecord[] = [];
  for (const value of data.feed.entry ?? []) {
    const parsed = review.safeParse(value);
    if (!parsed.success) continue;
    const r = parsed.data;
    if (!/^\d{1,30}$/.test(r.id.label)) continue;
    const at = r.updated.label,
      time = Date.parse(at),
      calendar = at.slice(0, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(at) ||
      !Number.isFinite(time) ||
      new Date(`${calendar}T12:00:00Z`).toISOString().slice(0, 10) !==
        calendar ||
      time > now.getTime() ||
      time < now.getTime() - 90 * 86400000
    )
      continue;
    const title = redact(r.title.label).slice(0, 160),
      quote = redact(r.content.label).slice(0, 1000);
    if (!spanishReview(quote) || !quote || !title) continue;
    let authorKey: string | undefined;
    try {
      const uri = new URL(r.author?.uri?.label ?? "");
      const profilePath = uri.pathname.match(
        /^\/[a-z]{2}\/reviews\/id(\d{1,30})$/,
      );
      const id = profilePath?.[1] ?? uri.searchParams.get("id");
      if (
        uri.protocol === "https:" &&
        uri.hostname === "itunes.apple.com" &&
        !uri.username &&
        !uri.password &&
        (Boolean(profilePath) ||
          uri.pathname.endsWith("viewUsersUserReviews")) &&
        id &&
        /^\d{1,30}$/.test(id)
      )
        authorKey = `app-store:${hash(id)}`;
    } catch {
      /* No author identity is inferred from a display name. */
    }
    const externalId = `${app.id}:${r.id.label}`;
    result.push({
      id: `app-store:${hash(externalId)}`,
      externalId,
      source: "app-store",
      sourceName: "Apple App Store · reseñas públicas",
      url: `https://apps.apple.com/app/id${app.id}?see-all=reviews&reviewId=${r.id.label}`,
      title,
      quote,
      occurredAt: new Date(time).toISOString(),
      capturedAt: now.toISOString(),
      language: "es",
      kind: "community",
      authorKey,
      product: app.name,
      appId: app.id,
      appCategory: app.category,
      segment: `Uso personal · ${app.category}`,
      rating: Number(r["im:rating"].label),
      dateBasis: "source_updated",
      historical: time < now.getTime() - 30 * 86400000,
    });
    if (result.length === 20) break;
  }
  return result;
}

export async function collectAppReviews(
  previous?: ConnectorState,
  now = new Date(),
  fetcher: typeof fetch = fetch,
): Promise<ConnectorBatch> {
  const paused = cooldown("app-store", previous, now);
  if (paused) return paused;
  if (
    previous?.checkedAt &&
    now.getTime() - Date.parse(previous.checkedAt) < 6 * 3600000
  )
    return { records: [], state: previous };
  let cursor: z.infer<typeof cursorSchema> = { offset: 0, retries: [] };
  try {
    cursor = cursorSchema.parse(JSON.parse(previous?.cursor ?? "{}"));
  } catch {
    /* Invalid cursor restarts a bounded traversal, not history. */
  }
  const selected: number[] = [];
  const retry = [...cursor.retries]
    .sort((a, b) => a.after.localeCompare(b.after))
    .find((r) => Date.parse(r.after) <= now.getTime());
  if (retry) selected.push(retry.index);
  let offset = cursor.offset;
  while (selected.length < 3) {
    const index = offset;
    offset = (offset + 1) % pairs.length;
    if (!selected.includes(index)) selected.push(index);
  }
  const pending = cursor.retries.filter((r) => !selected.includes(r.index));
  const batches = await Promise.all(
    selected.map(async (index) => {
      const { app, store } = pairs[index];
      try {
        const url = new URL(
          `https://itunes.apple.com/${store}/rss/customerreviews/page=1/id=${app.id}/sortby=mostrecent/json`,
        );
        const raw = await publicJson(url, now, fetcher);
        return { records: parseAppReviews(raw, app, now), index };
      } catch (error) {
        return {
          records: [],
          index,
          failure: failure("app-store", undefined, now, error).state,
        };
      }
    }),
  );
  let retryAt: string | undefined;
  for (const batch of batches)
    if (batch.failure) {
      let until = new Date(now.getTime() + 6 * 3600000).toISOString();
      try {
        const value = JSON.parse(batch.failure.cursor ?? "{}").retryAt;
        if (value && Date.parse(value) > Date.parse(until))
          until = new Date(
            Math.min(Date.parse(value), now.getTime() + 7 * 86400000),
          ).toISOString();
      } catch {
        /* Use bounded default cooldown. */
      }
      pending.push({ index: batch.index, after: until });
      if (batch.failure.status === "limited" && (!retryAt || until > retryAt))
        retryAt = until;
    }
  const records = batches.flatMap((b) => b.records),
    failures = batches.filter((b) => b.failure).length;
  return {
    records,
    state: {
      id: "app-store",
      status: failures || !records.length ? "limited" : "ok",
      blocked: Boolean(retryAt),
      count: records.length,
      checkedAt: now.toISOString(),
      cursor: JSON.stringify({
        offset,
        retries: pending,
        ...(retryAt ? { retryAt } : {}),
      }),
      message: `Muestra pública en español: ${records.length} reseñas de hasta tres feeds; ${failures} consultas pendientes. Rotación de seis apps y siete tiendas. Tienda no prueba residencia; updated no prueba fecha original. Sin descargas/usuarios estimados ni API de pago.${!records.length ? " Sin reseñas elegibles en este turno; no demuestra ausencia de problemas." : ""}`,
    },
  };
}
