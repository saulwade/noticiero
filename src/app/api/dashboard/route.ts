import { allowed } from "@/lib/access";
import { getDashboardData } from "@/db/repository";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!(await allowed(request)))
    return Response.json({ error: "Acceso privado." }, { status: 401 });
  return Response.json(await getDashboardData(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
