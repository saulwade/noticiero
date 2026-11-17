import { load } from "cheerio";
import { hash } from "@/features/news/normalize";
import {
  GITHUB_EVIDENCE_REPOSITORIES,
  MEXICO_EVIDENCE_REPOSITORIES,
} from "@/features/evidence/connectors";
import { canonicalSourceUrl } from "./quality";
import type { IdeaSource, IdeaSourceCheck } from "./types";

const MAX_BYTES = 256 * 1024;
const DAY = 86_400_000;
const HOSTS = new Set([
  "langfuse.com",
  "docs.litellm.ai",
  "docs.helicone.ai",
  "www.helicone.ai",
  "administrate.dev",
  "lumatrack.io",
  "flexprice.io",
  "n8n.io",
  "docs.n8n.io",
  "docs.langchain.com",
  "play.google.com",
]);
const REPOSITORIES = new Set<string>(
  [...GITHUB_EVIDENCE_REPOSITORIES, ...MEXICO_EVIDENCE_REPOSITORIES].map(
    (repo) => repo.toLowerCase(),
  ),
);
const APPS = new Set([
  "cl.fintual.fintualapp",
  "mx.com.procesar.aforemovil",
  "mx.zenfi.app",
]);
const interval = (kind: IdeaSource["kind"]) =>
  kind === "issue" ? 6 * 3_600_000 : DAY;

function urlFor(source: IdeaSource): URL | undefined {
  try {
    const url = new URL(source.url);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash
    )
      return;
    if (source.kind === "issue") {
      const match = url.pathname.match(
        /^\/([^/]+)\/([^/]+)\/issues\/([1-9]\d*)$/,
      );
      if (
        url.hostname !== "github.com" ||
        url.search ||
        !match ||
        !REPOSITORIES.has(`${match[1]}/${match[2]}`.toLowerCase())
      )
        return;
      return url;
    }
    if (source.kind !== "competitor" || !HOSTS.has(url.hostname)) return;
    if (url.hostname === "play.google.com") {
      const keys = [...url.searchParams.keys()];
      if (
        url.pathname !== "/store/apps/details" ||
        !APPS.has(url.searchParams.get("id") ?? "") ||
        keys.some((key) => key !== "id" && key !== "hl") ||
        keys.some((key) => url.searchParams.getAll(key).length !== 1)
      )
        return;
      if (
        url.searchParams.has("hl") &&
        !/^(?:es|es_MX|en|en_US)$/.test(url.searchParams.get("hl")!)
      )
        return;
    } else if (url.search) return;
    return url;
  } catch {
    return;
  }
}

/** Deliberately smaller than the app's general URL validator: no discovery URLs. */
export function validMemorySource(source: IdeaSource): boolean {
  return Boolean(urlFor(source));
}

function validDate(value: unknown, now: Date): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)
  )
    return false;
  const time = Date.parse(value);
  return (
    Number.isFinite(time) &&
    time <= now.getTime() &&
    new Date(time).toISOString().slice(0, 10) === value.slice(0, 10)
  );
}

async function responseText(response: Response) {
  if (
    Number(response.headers.get("content-length")) > MAX_BYTES ||
    !response.body
  ) {
    await response.body?.cancel();
    throw new Error("Invalid source size");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0,
    text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error("Source size exceeded");
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function publicReferences(value: string) {
  const references = new Set<string>();
  for (const match of value.matchAll(/https:\/\/[^\s<>"'`]+/g)) {
    const candidate = match[0].replace(/[).,;\]}]+$/, "");
    try {
      const url = new URL(candidate);
      const path = url.pathname.match(
        /^\/([^/]+)\/([^/]+)\/(?:issues|pull)\/[1-9]\d*$/,
      );
      const githubReference =
        url.hostname === "github.com" &&
        !url.search &&
        !url.hash &&
        !url.username &&
        !url.password &&
        !url.port &&
        path &&
        REPOSITORIES.has(`${path[1]}/${path[2]}`.toLowerCase());
      if (
        githubReference ||
        validMemorySource({ url: candidate, kind: "competitor" })
      )
        references.add(canonicalSourceUrl(candidate));
    } catch {
      /* Unknown references stay in the original archive, never queried. */
    }
    if (references.size >= 12) break;
  }
  return [...references];
}

function retryTime(response: Response, now: Date) {
  const header = response.headers.get("retry-after");
  let until = now.getTime() + 3_600_000;
  if (header && /^\d+$/.test(header))
    until = now.getTime() + Number(header) * 1000;
  else if (header && Number.isFinite(Date.parse(header)))
    until = Date.parse(header);
  else {
    const reset = Number(response.headers.get("x-ratelimit-reset")) * 1000;
    if (Number.isFinite(reset) && reset > now.getTime()) until = reset;
  }
  return new Date(
    Math.min(now.getTime() + 7 * DAY, Math.max(now.getTime() + 60_000, until)),
  ).toISOString();
}

/** One bounded anonymous GET; failures are appended without overwriting success. */
export async function checkMemorySource(
  source: IdeaSource,
  now: Date,
  fetcher: typeof fetch = fetch,
): Promise<IdeaSourceCheck> {
  if (!Number.isFinite(now.getTime()))
    throw new Error("Corte de fuentes inválido.");
  const base = {
    url: canonicalSourceUrl(source.url),
    kind: source.kind,
    checkedAt: now.toISOString(),
  };
  const result = (
    data: Omit<IdeaSourceCheck, "id" | "url" | "kind" | "checkedAt">,
  ): IdeaSourceCheck => {
    const check = { ...base, ...data };
    return { id: hash(JSON.stringify(check)), ...check };
  };
  const sourceUrl = urlFor(source);
  if (!sourceUrl)
    return result({
      status: "error",
      message:
        "Fuente fuera de la cobertura pública permitida; no se consultó.",
    });
  try {
    const requestUrl =
      source.kind === "issue"
        ? `https://api.github.com/repos${sourceUrl.pathname}`
        : sourceUrl.href;
    const response = await fetcher(requestUrl, {
      method: "GET",
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      headers: {
        Accept:
          source.kind === "issue"
            ? "application/vnd.github+json"
            : "text/html,text/plain;q=0.9",
        "User-Agent": "Noticiero-idea-memory/1.0",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (
      response.redirected ||
      (response.url && response.url !== requestUrl) ||
      (response.status >= 300 && response.status < 400)
    ) {
      await response.body?.cancel();
      throw new Error("Redirect disallowed");
    }
    if (
      response.status === 429 ||
      (response.status === 403 &&
        (response.headers.get("x-ratelimit-remaining") === "0" ||
          response.headers.has("retry-after")))
    ) {
      await response.body?.cancel();
      return result({
        status: "rate-limited",
        retryAt: retryTime(response, now),
        message:
          "La fuente pidió una pausa; el último resultado válido se conserva.",
      });
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("Unavailable source");
    }
    const raw = await responseText(response);
    if (source.kind === "issue") {
      const data = JSON.parse(raw) as Record<string, unknown>;
      if (
        !data ||
        typeof data !== "object" ||
        (data.state !== "open" && data.state !== "closed") ||
        typeof data.title !== "string" ||
        !data.title.trim() ||
        (data.body !== null && typeof data.body !== "string") ||
        !validDate(data.updated_at, now) ||
        typeof data.html_url !== "string" ||
        data.number !== Number(sourceUrl.pathname.split("/").at(-1))
      )
        throw new Error("Invalid issue");
      const identity = urlFor({ url: data.html_url, kind: "issue" });
      if (
        !identity ||
        identity.href.toLowerCase() !== sourceUrl.href.toLowerCase()
      )
        throw new Error("Wrong issue identity");
      if (
        data.created_at !== undefined &&
        (!validDate(data.created_at, now) ||
          Date.parse(data.created_at) > Date.parse(data.updated_at))
      )
        throw new Error("Invalid issue chronology");
      const reason = ["completed", "not_planned", "reopened", null].includes(
        data.state_reason as string | null,
      )
        ? (data.state_reason as IdeaSourceCheck["stateReason"])
        : undefined;
      const text = `${data.title}\n${data.body ?? ""}`
        .replace(/\u0000/g, "")
        .trim();
      const issueData = {
        issueState: data.state as "open" | "closed",
        stateReason: reason,
        sourceUpdatedAt: new Date(data.updated_at).toISOString(),
        excerpt: text.slice(0, 1600),
        references: publicReferences(String(data.body ?? "")),
      };
      return result({
        status: "ok",
        ...issueData,
        contentHash: hash(JSON.stringify({ ...issueData, excerpt: text })),
        message:
          data.state === "closed"
            ? reason === "completed"
              ? "GitHub declara el issue completado; comprobar versión y vigencia antes de interpretar el problema."
              : "Issue cerrado sin corrección comprobada; se conserva como antecedente por contrastar."
            : "Issue abierto; la incidencia y sus referencias no demuestran intención de compra.",
      });
    }
    const contentType = response.headers.get("content-type");
    if (
      contentType &&
      !/text\/(?:html|plain|markdown)|application\/xhtml\+xml/i.test(
        contentType,
      )
    )
      throw new Error("Unexpected page content");
    const $ = load(raw);
    $(
      "script,style,nav,header,footer,noscript,template,svg,form,button",
    ).remove();
    const visible = ($("main").length ? $("main").text() : $("body").text())
      .replace(/\s+/g, " ")
      .trim();
    if (visible.length < 4) throw new Error("Empty visible page");
    return result({
      status: "ok",
      contentHash: hash(visible),
      excerpt: visible.slice(0, 1600),
      message:
        "Documento público observado; cambios de texto requieren revisión y no confirman nuevas funciones, ventas ni demanda.",
    });
  } catch {
    return result({
      status: "error",
      message:
        "No se pudo comprobar la fuente dentro de los límites de seguridad y tamaño; se conserva el historial anterior.",
    });
  }
}

/** Six calls at most: reserve three for overdue checks so discovery cannot starve monitoring. */
export async function refreshMemorySources(
  sources: IdeaSource[],
  previous: IdeaSourceCheck[],
  now: Date,
  guard: () => Promise<unknown> = async () => {},
  fetcher: typeof fetch = fetch,
): Promise<IdeaSourceCheck[]> {
  if (!Number.isFinite(now.getTime()))
    throw new Error("Corte de fuentes inválido.");
  const latest = new Map<string, IdeaSourceCheck>();
  for (const check of previous) {
    const at = Date.parse(check.checkedAt);
    if (!Number.isFinite(at) || at > now.getTime()) continue;
    const key = `${check.kind}:${canonicalSourceUrl(check.url)}`;
    const old = latest.get(key);
    if (
      !old ||
      old.checkedAt.localeCompare(check.checkedAt) < 0 ||
      (old.checkedAt === check.checkedAt && old.id.localeCompare(check.id) < 0)
    )
      latest.set(key, check);
  }
  const unique = new Map<string, IdeaSource>();
  for (const source of sources) {
    if (!validMemorySource(source)) continue;
    const normalized = { ...source, url: canonicalSourceUrl(source.url) };
    unique.set(`${source.kind}:${normalized.url}`, normalized);
  }
  const eligible = [...unique]
    .flatMap(([key, source]) => {
      const last = latest.get(key);
      if (
        last &&
        (now.getTime() - Date.parse(last.checkedAt) < interval(source.kind) ||
          (last.retryAt && Date.parse(last.retryAt) > now.getTime()))
      )
        return [];
      return [
        {
          source,
          checkedAt: last
            ? Date.parse(last.checkedAt)
            : Number.NEGATIVE_INFINITY,
        },
      ];
    })
    .sort(
      (a, b) =>
        a.checkedAt - b.checkedAt || a.source.url.localeCompare(b.source.url),
    );
  const overdue = eligible.filter((entry) => Number.isFinite(entry.checkedAt));
  const unseen = eligible.filter((entry) => !Number.isFinite(entry.checkedAt));
  const reserved = overdue.slice(0, 3);
  const discovering = unseen.slice(0, 6 - reserved.length);
  const remaining = 6 - reserved.length - discovering.length;
  // Borrow either unused quota without letting the combined request count grow.
  const pending = [
    ...reserved,
    ...discovering,
    ...overdue.slice(reserved.length, reserved.length + remaining),
  ];
  const checks: IdeaSourceCheck[] = [];
  for (let index = 0; index < pending.length; index += 2) {
    await guard();
    const batch = await Promise.all(
      pending
        .slice(index, index + 2)
        .map(({ source }) => checkMemorySource(source, now, fetcher)),
    );
    await guard();
    checks.push(...batch);
  }
  return checks;
}
