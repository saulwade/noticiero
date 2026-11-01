import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IdeaCard } from "@/components/opportunity-panel";
import { OperationsView } from "@/components/operations-view";
import { demoData } from "@/lib/demo-data";
describe("investigación en segundo plano sin tareas de UI", () => {
  it("un favorito antiguo conserva su nota sin mostrar un formulario", () => {
    const idea = demoData().opportunities[0];
    const html = renderToStaticMarkup(
      createElement(IdeaCard, {
        idea,
        stories: [],
        saved: {
          id: idea.id,
          kind: "idea",
          note: "Nota histórica conservada",
          state: "validating",
          createdAt: "2026-11-01T12:00:00Z",
        },
        readOnly: true,
        onSave: vi.fn(),
        onNote: vi.fn(),
      }),
    );
    expect(html).toContain("Nota histórica conservada");
    expect(html).toContain(idea.title);
    expect(html).not.toMatch(/<textarea|<select|Guardar notas/);
  });
  it("el estado solo informa del archivo, sin pedir generación ni revisión manual", () => {
    const html = renderToStaticMarkup(
      createElement(OperationsView, { data: demoData(), onRefresh: vi.fn() }),
    );
    expect(html).toContain("Investigación automática");
    expect(html).toContain("se conservan en segundo plano");
    expect(html).not.toMatch(/Generar reporte|Importar CSV|Guardar nota/);
  });
});
