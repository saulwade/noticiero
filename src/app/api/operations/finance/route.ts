import { validServiceSecret } from "@/lib/access";
import {
  prepareAutomationInput,
  publishAutomationReport,
  recordAutomationFailure,
} from "@/features/finance/automatic-service";

export const maxDuration = 300;
const headers = { "Cache-Control": "private, no-store" };
const MAX_BYTES = 600_000;
async function body(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES)
    throw new Error("size");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new Error("size");
    }
    chunks.push(value);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("body");
  return parsed as Record<string, unknown>;
}

export async function POST(request: Request) {
  if (!validServiceSecret(request, "OPS_REPORT_SECRET"))
    return Response.json(
      { error: "Acceso requerido." },
      { status: 401, headers },
    );
  try {
    const input = await body(request);
    if (
      typeof input.attemptId !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        input.attemptId,
      )
    )
      return Response.json(
        { error: "Falta identificar la ejecución." },
        { status: 400, headers },
      );
    if (input.action === "prepare")
      return Response.json(
        await prepareAutomationInput(new Date(), undefined, input.attemptId),
        { headers },
      );
    if (input.action === "publish")
      return Response.json(
        await publishAutomationReport(
          input.report,
          new Date(),
          input.attemptId,
        ),
        { headers },
      );
    if (input.action === "failed") {
      await recordAutomationFailure(undefined, new Date(), input.attemptId);
      return Response.json({ ok: true }, { headers });
    }
    return Response.json(
      { error: "Acción no disponible." },
      { status: 400, headers },
    );
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "size";
    return Response.json(
      {
        error: tooLarge
          ? "Solicitud demasiado grande."
          : "No se pudo completar el análisis automático. Se conserva el anterior.",
      },
      { status: tooLarge ? 413 : 400, headers },
    );
  }
}
