import { validCron } from "@/lib/access";
import { dispatchUpdate } from "./dispatch";
export async function cronHandler(request: Request) {
  if (!validCron(request))
    return Response.json(
      { error: "Credencial de tarea inválida." },
      { status: 401 },
    );
  try {
    return Response.json(await dispatchUpdate(), { status: 202 });
  } catch {
    return Response.json(
      { error: "No se pudo iniciar la actualización." },
      { status: 503 },
    );
  }
}
