import { z } from "zod";
import type {
  ConnectorBatch,
  ConnectorState,
  EvidenceRecord,
  EvidenceSource,
} from "./types";

/** Public APIs only: one request, <=20 rows and <=1 MiB decoded bytes per run.
 * CFPB schema: https://raw.githubusercontent.com/cfpb/ccdb5-api/main/swagger-config.yaml
 * GitHub schema: https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests
 * These are bounded samples, never an exhaustive complaint or issue census.
 */
const CAP = 20;
const MAX_BYTES = 1_048_576;
const DAY = 86_400_000;
export const GITHUB_EVIDENCE_REPOSITORIES = [
  "n8n-io/n8n",
  "supabase/supabase",
  "immich-app/immich",
  "actualbudget/actual",
] as const;
type Fetcher = typeof fetch;
const date = z.string().refine((value) => {
  if (
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    return false;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  return (
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day
  );
}, "Fecha inválida");
const cfpbHit = z.object({
  _source: z.object({
    complaint_id: z.union([
      z.string().regex(/^\d+$/),
      z.number().int().nonnegative(),
    ]),
    date_received: date,
    product: z.string().min(1),
    issue: z.string().min(1),
    sub_issue: z.string().nullable().optional(),
    // Older/public editions may include this optional field; a category is never substituted for a narrative.
    complaint_what_happened: z.string().nullable().optional(),
  }),
});
const cfpbSchema = z.object({
  timed_out: z.boolean().optional(),
  hits: z.object({
    total: z.object({ value: z.number().nonnegative() }),
    hits: z.array(cfpbHit).max(CAP),
  }),
  _meta: z
    .object({
      is_data_stale: z.boolean().optional(),
      has_data_issue: z.boolean().optional(),
    })
    .optional(),
});
const githubItem = z.object({
  id: z.number().int().positive(),
  number: z.number().int().positive(),
  html_url: z.string().url(),
  repository_url: z.string().url(),
  title: z.string().min(1),
  body: z.string().nullable(),
  created_at: date,
  updated_at: date,
  user: z.object({ login: z.string().min(1), type: z.string() }).nullable(),
  pull_request: z.unknown().optional(),
  state: z.enum(["open", "closed"]).optional(),
});
const githubSchema = z.object({
  total_count: z.number().nonnegative(),
  incomplete_results: z.boolean(),
  items: z.array(githubItem).max(CAP),
});

function cursor(previous?: ConnectorState): {
  since?: string;
  retryAt?: string;
} {
  if (!previous?.cursor) return {};
  if (date.safeParse(previous.cursor).success)
    return { since: previous.cursor };
  try {
    const parsed: unknown = JSON.parse(previous.cursor);
    const result = z
      .object({ since: date.optional(), retryAt: date.optional() })
      .safeParse(parsed);
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}
class Limited extends Error {
  constructor(public retryAt: string) {
    super("Límite temporal de la API pública");
  }
}
export function cooldown(
  source: EvidenceSource,
  previous: ConnectorState | undefined,
  now: Date,
): ConnectorBatch | undefined {
  const { retryAt } = cursor(previous);
  if (retryAt && Date.parse(retryAt) > now.getTime())
    return {
      records: [],
      state: {
        id: source,
        status: "limited",
        blocked: true,
        checkedAt: now.toISOString(),
        count: 0,
        message: `Pausa solicitada por la API hasta ${retryAt}.`,
        cursor: previous?.cursor,
      },
    };
}
export function failure(
  source: EvidenceSource,
  previous: ConnectorState | undefined,
  now: Date,
  error: unknown,
): ConnectorBatch {
  const limited = error instanceof Limited;
  return {
    records: [],
    state: {
      id: source,
      status: limited ? "limited" : "error",
      blocked: limited,
      checkedAt: now.toISOString(),
      count: 0,
      message: limited
        ? `Pausa solicitada por la API hasta ${error.retryAt}.`
        : "No se pudo validar u obtener la muestra pública; se conserva el historial anterior.",
      cursor: limited
        ? JSON.stringify({
            since: cursor(previous).since,
            retryAt: error.retryAt,
          })
        : previous?.cursor,
    },
  };
}
export async function publicJson(
  url: URL,
  now: Date,
  fetcher: Fetcher,
): Promise<unknown> {
  const response = await fetcher(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "Noticiero-public-evidence/1.0",
    },
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (
    response.status === 429 ||
    (response.status === 403 &&
      (response.headers.get("x-ratelimit-remaining") === "0" ||
        response.headers.has("retry-after")))
  ) {
    const retry = response.headers.get("retry-after");
    const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : undefined;
    const reset = Number(response.headers.get("x-ratelimit-reset")) * 1000;
    const until =
      seconds !== undefined
        ? now.getTime() + seconds * 1000
        : retry && Number.isFinite(Date.parse(retry))
          ? Date.parse(retry)
          : reset > now.getTime()
            ? reset
            : now.getTime() + 60 * 60 * 1000;
    await response.body?.cancel();
    throw new Limited(
      new Date(
        Math.min(8_640_000_000_000_000, Math.max(until, now.getTime() + 1000)),
      ).toISOString(),
    );
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`HTTP ${response.status}`);
  }
  if (Number(response.headers.get("content-length")) > MAX_BYTES) {
    await response.body?.cancel();
    throw new Error("Presupuesto de bytes excedido");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Respuesta vacía");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "",
    bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Presupuesto de bytes excedido");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(text);
}
function clean(value: string, max = 4000) {
  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
}
function language(text: string): EvidenceRecord["language"] {
  return /\b(el|la|los|las|necesito|problema|puedo|factura)\b/i.test(text) &&
    /[áéíóúñ¿¡]|\b(necesito|puedo|factura)\b/i.test(text)
    ? "es"
    : "unknown";
}

export async function collectCfpb(
  previous?: ConnectorState,
  now = new Date(),
  fetcher: Fetcher = fetch,
): Promise<ConnectorBatch> {
  const paused = cooldown("cfpb", previous, now);
  if (paused) return paused;
  try {
    // Receipt is a source calendar date; the API's encoding does not establish an event time.
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const since = cursor(previous).since?.slice(0, 10);
    // Revisit 30 days because publication can lag receipt; newest 20 remain a declared sample.
    const from = new Date(
      Date.parse(since && since < today ? since : today) - 30 * DAY,
    )
      .toISOString()
      .slice(0, 10);
    const url = new URL(
      "https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/",
    );
    url.search = new URLSearchParams({
      size: String(CAP),
      sort: "created_date_desc",
      no_aggs: "true",
      no_highlight: "true",
      date_received_min: from,
    }).toString();
    // Never set `format`: CFPB's export parameter ignores size and can download the entire dataset.
    const data = cfpbSchema.parse(await publicJson(url, now, fetcher));
    const records: EvidenceRecord[] = [
      ...new Map(
        data.hits.hits.map(({ _source: item }) => {
          const externalId = String(item.complaint_id);
          const issue = clean(
            [item.issue, item.sub_issue].filter(Boolean).join(" — "),
            600,
          );
          const narrative = item.complaint_what_happened?.trim();
          const occurredAt = item.date_received.slice(0, 10);
          if (occurredAt > today) throw new Error("Fecha de recepción futura");
          const record: EvidenceRecord = {
            id: `cfpb:${externalId}`,
            externalId,
            source: "cfpb",
            sourceName: "CFPB Consumer Complaint Database (CC0)",
            url: `https://www.consumerfinance.gov/data-research/consumer-complaints/search/detail/${externalId}`,
            title: clean(item.issue, 240),
            quote: narrative
              ? clean(narrative)
              : `Categoría declarada (sin narrativa pública): ${issue}. Producto: ${clean(item.product, 400)}.`,
            occurredAt,
            capturedAt: now.toISOString(),
            language: narrative ? language(narrative) : "en",
            kind: "complaint",
            country: "US",
            countryBasis:
              "Jurisdicción de la fuente CFPB; no verifica residencia ni mercado mexicano.",
            product: clean(item.product, 400),
            issue,
          };
          return [record.id, record] as const;
        }),
      ).values(),
    ];
    const limited =
      data.hits.total.value > records.length ||
      data.timed_out ||
      data._meta?.is_data_stale ||
      data._meta?.has_data_issue;
    const latest =
      records
        .map((item) => item.occurredAt)
        .sort()
        .at(-1) ?? since;
    return {
      records,
      state: {
        id: "cfpb",
        status: limited ? "limited" : "ok",
        checkedAt: now.toISOString(),
        count: records.length,
        cursor: latest,
        message: `Muestra de hasta ${CAP} reclamaciones recientes desde ${from}; ventana revisitada de 30 días. Categorías sin narrativa se identifican como datos estructurados. No representa a todos los consumidores.${data._meta?.is_data_stale || data._meta?.has_data_issue || data.timed_out ? " La fuente informa datos incompletos o desactualizados." : ""}`,
      },
    };
  } catch (error) {
    return failure("cfpb", previous, now, error);
  }
}

export async function collectGithub(
  previous?: ConnectorState,
  now = new Date(),
  fetcher: Fetcher = fetch,
): Promise<ConnectorBatch> {
  const paused = cooldown("github", previous, now);
  if (paused) return paused;
  try {
    const since =
      cursor(previous).since ?? new Date(now.getTime() - 7 * DAY).toISOString();
    const url = new URL("https://api.github.com/search/issues");
    url.search = new URLSearchParams({
      q: `${GITHUB_EVIDENCE_REPOSITORIES.map((repo) => `repo:${repo}`).join(" ")} is:issue is:public updated:>=${since}`,
      sort: "updated",
      order: "desc",
      per_page: String(CAP),
      page: "1",
    }).toString();
    const data = githubSchema.parse(await publicJson(url, now, fetcher));
    const records: EvidenceRecord[] = [];
    let latest = since;
    for (const item of data.items) {
      const repository = item.repository_url.replace(
        "https://api.github.com/repos/",
        "",
      );
      if (
        !GITHUB_EVIDENCE_REPOSITORIES.includes(
          repository as (typeof GITHUB_EVIDENCE_REPOSITORIES)[number],
        )
      )
        throw new Error("Repositorio fuera de cobertura");
      if (item.pull_request) continue;
      if (
        item.html_url !==
        `https://github.com/${repository}/issues/${item.number}`
      )
        throw new Error("Enlace de issue inválido");
      latest = new Date(
        Math.max(Date.parse(latest), Date.parse(item.updated_at)),
      ).toISOString();
      if (
        !item.user ||
        item.user.type !== "User" ||
        /(?:\[bot\]|[-_]bot)$/i.test(item.user.login)
      )
        continue;
      records.push({
        id: `github:${item.id}`,
        externalId: String(item.id),
        source: "github",
        sourceName: "GitHub Issues · muestra pública",
        url: item.html_url,
        title: clean(item.title, 240),
        quote: clean(item.body?.trim() || item.title),
        occurredAt: new Date(item.created_at).toISOString(),
        capturedAt: now.toISOString(),
        language: language(`${item.title} ${item.body ?? ""}`),
        kind: "community",
        authorKey: `github:${item.user.login.toLowerCase()}`,
        product: repository,
        caseStatus: item.state,
      });
    }
    return {
      records: [
        ...new Map(records.map((record) => [record.id, record])).values(),
      ],
      state: {
        id: "github",
        status:
          data.incomplete_results || data.total_count > data.items.length
            ? "limited"
            : "ok",
        checkedAt: now.toISOString(),
        count: new Set(records.map((record) => record.id)).size,
        cursor: data.incomplete_results ? previous?.cursor : latest,
        message: `Muestra de hasta ${CAP} issues por actualización en ${GITHUB_EVIDENCE_REPOSITORIES.join(", ")}; excluye PR y bots. La fecha del caso es la creación original. Cobertura parcial, sin país inferido.${data.incomplete_results ? " GitHub devolvió resultados incompletos; cursor anterior conservado." : ""}`,
      },
    };
  } catch (error) {
    return failure("github", previous, now, error);
  }
}
