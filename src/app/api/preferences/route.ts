import { z } from "zod";
import { allowed, sameOrigin } from "@/lib/access";
import {
  getSourceSettings,
  savePreference,
  setSourceEnabled,
} from "@/db/repository";
import { allSourceDefinitions } from "@/features/sources/registry";
const schema = z.object({
  action: z.enum(["save", "read", "note", "source"]),
  id: z.string().min(1).max(120),
  kind: z.enum(["story", "idea", "note"]).optional(),
  enabled: z.boolean().optional(),
  note: z.string().max(4000).optional(),
  state: z.enum(["explore", "validating", "dismissed"]).optional(),
});
export async function GET(request: Request) {
  if (!(await allowed(request)))
    return Response.json({ error: "Acceso privado." }, { status: 401 });
  return Response.json({ sources: await getSourceSettings() });
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  if (!(await allowed(request)))
    return Response.json({ error: "Acceso privado." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Datos inválidos." }, { status: 400 });
  const input = parsed.data;
  if (input.action === "source") {
    if (
      !allSourceDefinitions.some((source) => source.id === input.id) ||
      typeof input.enabled !== "boolean"
    )
      return Response.json({ error: "Fuente inválida." }, { status: 400 });
    await setSourceEnabled(input.id, input.enabled);
  } else {
    await savePreference({ ...input, action: input.action });
  }
  return Response.json({ ok: true });
}
