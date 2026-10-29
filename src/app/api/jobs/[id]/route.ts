import { getJob } from "@/db/repository";
import { allowed } from "@/lib/access";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await allowed(request)))
    return Response.json({ error: "Acceso privado." }, { status: 401 });
  const { id } = await context.params;
  const job = await getJob(id);
  return job
    ? Response.json(job, { headers: { "Cache-Control": "private, no-store" } })
    : Response.json({ error: "Actualización no encontrada." }, { status: 404 });
}
