import { allowed, sameOrigin } from "@/lib/access";
import { financeAction, getFinanceData } from "@/features/finance/service";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  if (!(await allowed(request)))
    return Response.json(
      { error: "Acceso requerido." },
      { status: 401, headers },
    );
  return Response.json(await getFinanceData(), { headers });
}
export async function POST(request: Request) {
  if (!(await allowed(request)) || !sameOrigin(request))
    return Response.json(
      { error: "Acceso requerido." },
      { status: 403, headers },
    );
  try {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > 1_100_000)
      return Response.json(
        { error: "Máximo 1 MB de CSV." },
        { status: 413, headers },
      );
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Falta el contenido.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_100_000) {
        await reader.cancel();
        return Response.json(
          { error: "Máximo 1 MB de CSV." },
          { status: 413, headers },
        );
      }
      chunks.push(value);
    }
    return Response.json(
      await financeAction(JSON.parse(Buffer.concat(chunks).toString("utf8"))),
      { headers },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo guardar.";
    // Validation and domain messages never include account values, SQL or remote bodies.
    const safe =
      !(
        error &&
        typeof error === "object" &&
        ("code" in error || "errno" in error)
      ) &&
      message.length <= 260 &&
      !/postgres|password|connection|socket|timeout|https?:|syntax|constraint|column|relation|JSON|Unexpected|SELECT|INSERT|ECONN/i.test(
        message,
      );
    return Response.json(
      {
        error: safe
          ? message
          : "No se pudo guardar. Revisa los campos o vuelve a intentarlo.",
      },
      { status: 400, headers },
    );
  }
}
