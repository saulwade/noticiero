import { allowed } from "@/lib/access";
import { evidenceMarkdown } from "@/features/evidence/service";
export async function GET(request: Request) {
  if (!(await allowed(request)))
    return Response.json({ error: "Acceso requerido." }, { status: 401 });
  const bytes = new TextEncoder().encode(await evidenceMarkdown());
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 65536)
        controller.enqueue(bytes.subarray(i, i + 65536));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": "attachment; filename=noticiero-radar.md",
      "Cache-Control": "private, no-store",
    },
  });
}
