import { allowed } from "@/lib/access";
import { exportFinance } from "@/features/finance/service";
export async function GET(request: Request) {
  if (!(await allowed(request)))
    return Response.json(
      { error: "Acceso requerido." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  const bytes = new TextEncoder().encode(await exportFinance());
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 65536)
          controller.enqueue(bytes.subarray(i, i + 65536));
        controller.close();
      },
    }),
    {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": "attachment; filename=noticiero-portafolio.md",
        "Cache-Control": "private, no-store",
      },
    },
  );
}
