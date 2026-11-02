import { createHash } from "node:crypto";
const API = "https://api.github.com";
const REPOSITORY = "saulwade/noticiero-ops";
const MAX_BYTES = 40_000_000;

async function boundedBytes(response, maximum) {
  if (!response.ok || Number(response.headers.get("content-length")) > maximum)
    throw new Error("Descarga de archivo inválida.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Archivo sin contenido.");
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maximum) throw new Error("Archivo demasiado grande.");
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}

/** Append-only: no code path deletes or replaces a release, tag, or asset. */
export async function publishArchive({
  token,
  repository,
  bytes,
  at = new Date(),
  fetcher = fetch,
}) {
  if (
    !token ||
    repository !== REPOSITORY ||
    !Buffer.isBuffer(bytes) ||
    !bytes.length ||
    bytes.length < 49 ||
    !bytes.subarray(0, 20).equals(Buffer.from("NOTICIERO_BACKUP_V1\n")) ||
    bytes.length > MAX_BYTES
  )
    throw new Error("Configuración privada del archivo inválida.");
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Fecha inválida.");
  const tag = `history-${date.slice(0, 7)}`;
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const name = `noticiero-${date}-${sha256}.enc`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const request = (path, options = {}) =>
    fetcher(`${API}/repos/${REPOSITORY}${path}`, {
      ...options,
      headers: { ...headers, ...options.headers },
      redirect: "error",
      signal: AbortSignal.timeout(60000),
    });
  const info = await request("");
  if (!info.ok || (await info.json()).private !== true)
    throw new Error(
      "El destino debe ser el repositorio privado de operaciones.",
    );
  let response = await request(`/releases/tags/${tag}`);
  let release;
  if (response.status === 404) {
    response = await request("/releases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tag_name: tag,
        name: `Archivo histórico ${date.slice(0, 7)}`,
        body: "Copias comprimidas y cifradas. Sin expiración programada ni eliminación automática. Se requiere la clave privada de recuperación.",
        make_latest: "false",
      }),
    });
    if (response.status === 422)
      response = await request(`/releases/tags/${tag}`);
  }
  if (!response.ok) throw new Error("No se pudo preparar el archivo mensual.");
  release = await response.json();
  if (!Number.isSafeInteger(release.id) || release.id <= 0)
    throw new Error("Archivo mensual inválido.");
  let asset;
  for (let page = 1; page <= 10; page++) {
    const listed = await request(
      `/releases/${release.id}/assets?per_page=100&page=${page}`,
    );
    if (!listed.ok)
      throw new Error("No se pudo consultar el archivo existente.");
    const rows = await listed.json();
    if (!Array.isArray(rows)) throw new Error("Listado de archivo inválido.");
    asset = rows.find((row) => row.name === name);
    if (asset || rows.length < 100) break;
    if (page === 10) throw new Error("Revisar capacidad del archivo mensual.");
  }
  if (!asset) {
    const uploaded = await fetcher(
      `https://uploads.github.com/repos/${REPOSITORY}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/octet-stream" },
        body: bytes,
        redirect: "error",
        signal: AbortSignal.timeout(120000),
      },
    );
    if (!uploaded.ok) throw new Error("No se pudo añadir la copia histórica.");
    asset = await uploaded.json();
  }
  if (
    !Number.isSafeInteger(asset.id) ||
    asset.id <= 0 ||
    asset.name !== name ||
    asset.size !== bytes.length ||
    asset.state !== "uploaded"
  )
    throw new Error("Copia histórica incompleta.");
  let downloaded = await fetcher(
    `${API}/repos/${REPOSITORY}/releases/assets/${asset.id}`,
    {
      headers: { ...headers, Accept: "application/octet-stream" },
      redirect: "manual",
      signal: AbortSignal.timeout(60000),
    },
  );
  if ([301, 302, 303, 307, 308].includes(downloaded.status)) {
    const location = downloaded.headers.get("location");
    const url = location ? new URL(location) : undefined;
    if (
      !url ||
      url.protocol !== "https:" ||
      url.hostname !== "release-assets.githubusercontent.com"
    )
      throw new Error("Destino de descarga inesperado.");
    // Never send the GitHub token to the signed storage URL.
    downloaded = await fetcher(url.href, {
      redirect: "error",
      signal: AbortSignal.timeout(120000),
    });
  }
  const copy = await boundedBytes(downloaded, bytes.length);
  if (
    copy.length !== bytes.length ||
    createHash("sha256").update(copy).digest("hex") !== sha256
  )
    throw new Error(
      "La copia histórica no pasó la verificación de integridad.",
    );
  return {
    status: "completed",
    url: `https://github.com/${REPOSITORY}/releases/tag/${tag}`,
    bytes: bytes.length,
    sha256,
  };
}
