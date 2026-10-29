import { allowed } from "@/lib/access";
import { getDb } from "@/db/client";
import { dailyReports } from "@/db/schema";
import { eq } from "drizzle-orm";
export async function GET(
  request: Request,
  context: { params: Promise<{ date: string }> },
) {
  if (!(await allowed(request)))
    return Response.json({ error: "Acceso privado." }, { status: 401 });
  const { date } = await context.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return Response.json({ error: "Fecha inválida." }, { status: 400 });
  const db = await getDb();
  const report = (
    await db.select().from(dailyReports).where(eq(dailyReports.date, date))
  )[0]?.data;
  if (!report)
    return Response.json({ error: "Reporte no encontrado." }, { status: 404 });
  return new Response(report.markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="noticiero-${date}.md"`,
      "Cache-Control": "private, no-store",
    },
  });
}
