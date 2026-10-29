export async function fetchExternal(
  url: string,
  allowedHosts: string[],
  attempts = 3,
): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !allowedHosts.includes(parsed.hostname))
    throw new Error("Dominio de fuente no autorizado.");
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      redirect: "error",
      headers: {
        "User-Agent": "Noticiero/0.1 (personal news reader)",
        Accept:
          "application/json, application/rss+xml, application/atom+xml, text/xml",
      },
      cache: "no-store",
    });
    if (response.status === 429 || response.status >= 500) {
      if (attempt < attempts - 1) {
        const retry = Number(response.headers.get("retry-after"));
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Number.isFinite(retry) && retry > 0
              ? Math.min(retry * 1000, 10000)
              : 500 * 2 ** attempt,
          ),
        );
        continue;
      }
    }
    if (!response.ok)
      throw new Error(`La fuente respondió HTTP ${response.status}.`);
    return response;
  }
  throw new Error("La fuente no respondió después de tres intentos.");
}
export async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const current = index++;
        results[current] = await fn(items[current]);
      }
    }),
  );
  return results;
}
