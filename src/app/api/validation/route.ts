import { allowed, sameOrigin } from "@/lib/access";
import {
  getValidationData,
  saveValidation,
} from "@/features/validation/service";
export async function GET(request: Request) {
  if (!(await allowed(request)))
    return Response.json({ error: "Acceso requerido." }, { status: 401 });
  return Response.json(await getValidationData());
}
export async function POST(request: Request) {
  if (!(await allowed(request)) || !sameOrigin(request))
    return Response.json({ error: "Acceso requerido." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > 100000)
    return Response.json(
      { error: "Formulario demasiado grande." },
      { status: 413 },
    );
  try {
    return Response.json(await saveValidation(await request.json()));
  } catch {
    return Response.json(
      {
        error:
          "Revisa los campos y el proyecto seleccionado. Usa enlaces HTTPS.",
      },
      { status: 400 },
    );
  }
}
