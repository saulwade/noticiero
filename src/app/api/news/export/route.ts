import { allowed } from "@/lib/access";
import {
  cursorKey,
  exportWindow,
  parseExportQuery,
  verifyNewsSecret,
} from "@/features/business-news/export";
import { readBusinessExport } from "@/features/business-news/service";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (
    !(authorization ? verifyNewsSecret(authorization) : await allowed(request))
  )
    return Response.json(
      { error: "Acceso requerido." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  let query;
  const key = cursorKey();
  try {
    query = parseExportQuery(new URL(request.url).searchParams);
    exportWindow(query, key);
  } catch {
    return Response.json(
      { error: "Filtros o cursor inválidos; inicia una consulta nueva." },
      { status: 400 },
    );
  }
  try {
    return Response.json(await readBusinessExport(query, key), {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "Exportación temporalmente no disponible." },
      { status: 503 },
    );
  }
}
