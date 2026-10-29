import { allowed } from "@/lib/access";
import { researchBrief } from "@/features/research/brief";
export async function GET(request: Request) {
  if (!(await allowed(request)))
    return Response.json({ error: "Acceso requerido." }, { status: 401 });
  const days = Number(new URL(request.url).searchParams.get("days") ?? 3);
  if (!Number.isInteger(days) || days < 1 || days > 90)
    return Response.json(
      { error: "Periodo entre 1 y 90 días." },
      { status: 400 },
    );
  return new Response(await researchBrief(days), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="noticiero-investigacion-${days}-dias.md"`,
      "Cache-Control": "no-store",
    },
  });
}
