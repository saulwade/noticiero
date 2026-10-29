import { validServiceSecret } from "@/lib/access";
import { recordBackup } from "@/features/operations/service";
export async function POST(request: Request) {
  if (!validServiceSecret(request, "OPS_REPORT_SECRET"))
    return Response.json({ error: "Acceso requerido." }, { status: 401 });
  if (Number(request.headers.get("content-length")) > 20000)
    return Response.json(
      { error: "Manifiesto demasiado grande." },
      { status: 413 },
    );
  try {
    await recordBackup(await request.json());
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "No se pudo registrar el respaldo." },
      { status: 400 },
    );
  }
}
