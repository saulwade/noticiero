import { allowed } from "@/lib/access";
import { getIdeaMemory } from "@/features/idea-memory/service";
import { ideaMemoryMarkdown } from "@/features/idea-memory/markdown";
export async function GET(request: Request) {
  if (!(await allowed(request)))
    return Response.json({ error: "Acceso requerido." }, { status: 401 });
  const query = new URL(request.url).searchParams;
  const before = query.get("before"),
    beforeId = query.get("beforeId");
  if (
    (before || beforeId) &&
    (!before ||
      !beforeId ||
      query.get("history") !== "1" ||
      !Number.isFinite(Date.parse(before)) ||
      before.length > 40 ||
      !/^[A-Za-z0-9:_-]{1,160}$/.test(beforeId))
  )
    return Response.json(
      { error: "Cursor de historial inválido." },
      { status: 400 },
    );
  if (query.get("format") && !["json", "md"].includes(query.get("format")!))
    return Response.json({ error: "Formato json o md." }, { status: 400 });
  const memory =
    before && beforeId
      ? await getIdeaMemory(new Date(), true, {
          before: new Date(before).toISOString(),
          beforeId,
        })
      : await getIdeaMemory(new Date(), query.get("history") === "1");
  const headers = { "Cache-Control": "private, no-store" };
  if (query.get("format") === "md")
    return new Response(ideaMemoryMarkdown(memory), {
      headers: {
        ...headers,
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition":
          "attachment; filename=noticiero-memoria-ideas.md",
      },
    });
  return Response.json(memory, { headers });
}
