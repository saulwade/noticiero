/** Transport only for the existing free FX provider, never for quota-counted Alpha calls. */
export class FreeFxError extends Error {
  constructor(
    public status?: number,
    public retryable = false,
  ) {
    super("No se confirmó la respuesta de divisas.");
  }
}
export async function freeFxJson(
  url: URL,
  fetcher: typeof fetch,
  maxBytes = 65536,
): Promise<unknown> {
  if (
    url.protocol !== "https:" ||
    url.hostname !== "api.frankfurter.dev" ||
    url.username ||
    url.password
  )
    throw new FreeFxError();
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetcher(url, {
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
        credentials: "omit",
        headers: {
          Accept: "application/json",
          "User-Agent": "Noticiero/0.1 (bounded free FX references)",
        },
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new FreeFxError(response.status, response.status >= 500);
      }
      const declared = response.headers.get("content-length");
      if (
        !response.body ||
        (declared !== null &&
          (!/^\d+$/.test(declared) || Number(declared) > maxBytes))
      )
        throw new FreeFxError();
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) throw new FreeFxError();
          chunks.push(value);
        }
      } catch (error) {
        await reader.cancel().catch(() => {});
        throw error;
      }
      try {
        return JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        throw new FreeFxError();
      }
    } catch (error) {
      const problem =
        error instanceof FreeFxError ? error : new FreeFxError(undefined, true);
      if (!problem.retryable || attempt === 1) throw problem;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new FreeFxError();
}
