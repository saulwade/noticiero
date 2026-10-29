import { allowed, sameOrigin, validCron } from "@/lib/access";
import { dispatchUpdate } from "@/features/jobs/dispatch";
export const maxDuration = 300;
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  if (!(await allowed(request)) && !validCron(request))
    return Response.json({ error: "Acceso privado." }, { status: 401 });
  try {
    return Response.json(await dispatchUpdate(), { status: 202 });
  } catch {
    return Response.json(
      { error: "No se pudo iniciar la actualización. Intenta de nuevo." },
      { status: 503 },
    );
  }
}
