import { allowed, sameOrigin } from "@/lib/access";
import { saveDailyReport } from "@/features/research/service";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  if (!(await allowed(request)))
    return Response.json({ error: "Acceso privado." }, { status: 401 });
  const report = await saveDailyReport();
  return Response.json(report);
}
