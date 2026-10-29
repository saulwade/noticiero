import { validServiceSecret } from "@/lib/access";
import { reconcileOperations } from "@/features/operations/service";
export async function GET(request: Request) {
  if (!validServiceSecret(request, "OPS_MONITOR_SECRET"))
    return Response.json({ error: "Acceso requerido." }, { status: 401 });
  const data = await reconcileOperations();
  return Response.json(
    {
      ok: data.alerts.length === 0,
      findings: data.alerts.map(({ id, message }) => ({ id, message })),
    },
    {
      status: data.alerts.length ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
