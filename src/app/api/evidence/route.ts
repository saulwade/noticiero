import { allowed, sameOrigin } from "@/lib/access";
import { evidenceAction, getEvidenceData } from "@/features/evidence/service";
export async function GET(request: Request) {
  if (!(await allowed(request)))
    return Response.json({ error: "Acceso requerido." }, { status: 401 });
  return Response.json(await getEvidenceData(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function POST(request: Request) {
  if (!(await allowed(request)) || !sameOrigin(request))
    return Response.json({ error: "Acceso requerido." }, { status: 403 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 1_100_000)
    return Response.json(
      { error: "La importación supera 1 MB." },
      { status: 413 },
    );
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Falta contenido.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_100_000) {
        await reader.cancel();
        return Response.json(
          { error: "La importación supera 1 MB." },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    return Response.json(
      await evidenceAction(JSON.parse(Buffer.concat(chunks).toString("utf8"))),
    );
  } catch {
    return Response.json(
      {
        error:
          "No se pudo guardar. Revisa el identificador, las columnas, fechas y límites del CSV (1 MB / 500 filas).",
      },
      { status: 400 },
    );
  }
}
