import { expect, it, vi } from "vitest";
import {
  collectAppReviews,
  parseAppReviews,
  consumerApps,
  spanishReview,
} from "@/features/evidence/app-reviews";
const now = new Date("2026-11-17T12:00:00Z");
const row = (
  id = "1",
  text = "No puedo sincronizar la lista con mi pareja. Cada día tengo que copiar los productos a mano.",
) => ({
  id: { label: id },
  title: { label: "Problema con la lista" },
  content: { label: text },
  updated: { label: "2026-11-16T12:00:00Z" },
  "im:rating": { label: "2" },
  author: {
    name: { label: "PRIVATE" },
    uri: {
      label: "https://itunes.apple.com/es/reviews/id123",
    },
  },
});
it("detecta español conservador sin inferir idioma por tienda", () => {
  expect(
    spanishReview(
      "I cannot sync the list with my family and the app crashes every day",
    ),
  ).toBe(false);
  expect(spanishReview("Me gusta mucho")).toBe(false);
  expect(spanishReview(row().content.label)).toBe(true);
});
it("conserva identidad entre tiendas, minimiza autor y declara fecha actualizada", () => {
  const app = consumerApps[4];
  const a = parseAppReviews({ feed: { entry: [row()] } }, app, now)[0];
  const b = parseAppReviews({ feed: { entry: [row()] } }, app, now)[0];
  expect(a.id).toBe(b.id);
  expect(a.dateBasis).toBe("source_updated");
  expect(a.country).toBeUndefined();
  expect(a.authorKey).toMatch(/^app-store:[a-f0-9]+$/);
  expect(JSON.stringify(a)).not.toContain("PRIVATE");
  expect(JSON.stringify(a)).not.toContain("viewUsersUserReviews");
  expect(a.rating).toBe(2);
});
it("no conserva contactos, entradas futuras o cuerpos completos ni convierte positivos en quejas", () => {
  const entries = [
    row(
      "2",
      "La lista me sirve para organizar las compras con mi familia. Mi correo es test@example.com y mi teléfono 5512345678.",
    ),
    { ...row("3"), updated: { label: "2027-01-01T12:00:00Z" } },
    row("4", "This is a problem with my account and I cannot log in"),
  ];
  const data = parseAppReviews(
    { feed: { entry: entries } },
    consumerApps[4],
    now,
  );
  expect(data).toHaveLength(1);
  expect(data[0].kind).toBe("community");
  expect(data[0].quote).not.toContain("test@example.com");
  expect(data[0].quote).not.toContain("5512345678");
});
it("rota sólo tres consultas y enfría sin nuevos accesos", async () => {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    void input;
    return new Response(JSON.stringify({ feed: { entry: [row()] } }));
  });
  const first = await collectAppReviews(undefined, now, fetcher);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(first.records.length).toBeLessThanOrEqual(60);
  expect(
    fetcher.mock.calls.every((c) =>
      String(c[0]).startsWith("https://itunes.apple.com/"),
    ),
  ).toBe(true);
  await collectAppReviews(first.state, new Date(now.getTime() + 1000), fetcher);
  expect(fetcher).toHaveBeenCalledTimes(3);
  const next = await collectAppReviews(
    first.state,
    new Date(now.getTime() + 7 * 3600000),
    fetcher,
  );
  expect(fetcher).toHaveBeenCalledTimes(6);
  expect(next.state.cursor).not.toBe(first.state.cursor);
});
it("un fallo parcial conserva éxitos y reintento; 429 no dispara más de tres accesos", async () => {
  const fetcher = vi.fn(async (url: RequestInfo | URL) =>
    String(url).includes("570060128")
      ? new Response("", { status: 429, headers: { "retry-after": "86400" } })
      : new Response(JSON.stringify({ feed: { entry: [row()] } })),
  );
  const data = await collectAppReviews(undefined, now, fetcher);
  expect(data.records.length).toBeGreaterThan(0);
  expect(data.state.status).toBe("limited");
  await collectAppReviews(
    data.state,
    new Date(now.getTime() + 7 * 3600000),
    fetcher,
  );
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it("omite teléfonos españoles, correos Unicode y handles de contacto", () => {
  const quote =
    "La lista no se sincroniza con mi pareja y tengo que copiar todo. Mi teléfono es 612345678, otro 612.345.678, mi correo saúl@example.com, Telegram @miusuario y www.t.me/miusuario. Mi Telegram es usuarioPrivado.";
  const data = parseAppReviews(
    { feed: { entry: [row("9", quote)] } },
    consumerApps[4],
    now,
  );
  expect(data).toHaveLength(1);
  for (const value of [
    "612345678",
    "612.345.678",
    "saúl@example.com",
    "miusuario",
    "usuarioPrivado",
  ])
    expect(data[0].quote).not.toContain(value);
});
