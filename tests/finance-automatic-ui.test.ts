import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  FinanceAutomaticAnalysis,
  FinanceAutomaticPortfolio,
  FinanceAutomationStatus,
} from "@/components/finance-automatic-report";
import { fixture } from "./fixtures/finance-automatic";

describe("automatic portfolio presentation", () => {
  it("shows hypothetical amounts and percentage fractions before real movements", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceAutomaticPortfolio, { data: fixture() }),
    );
    expect(html).toContain("$12,000.00");
    expect(html).toContain("$8,400.00");
    expect(html).toContain("70 %");
    expect(html).not.toContain("7000 %");
    expect(html).not.toContain("Valor real registrado");
    expect(html).toContain("Esta distribución no está aprobada.");
  });
  it("shows recorded value and target weights after movements without treating initial capital as reinvestment", () => {
    const data = fixture();
    data.movements = [
      {
        id: "synthetic",
        kind: "deposit",
        date: "2026-10-30",
        currency: "MXN",
        amount: "1000",
        fee: "0",
        note: "Synthetic",
        createdAt: "2026-10-30T18:00:00Z",
      },
    ];
    data.summary.valueMxn = "1030";
    data.summary.contributionsMxn = "1000";
    data.summary.pnlMxn = "30";
    const html = renderToStaticMarkup(
      createElement(FinanceAutomaticPortfolio, { data }),
    );
    expect(html).toContain("$1,030.00");
    expect(html).toContain("$1,000.00");
    expect(html).toContain("$30.00");
    expect(html).toContain("70 %");
    expect(html).not.toContain("$12,000.00");
    expect(html).not.toContain("$8,400.00");
    expect(html).not.toContain("4 títulos");
    expect(html).toContain("no implican vender ni reinvertir tu cartera");
  });
  it("distinguishes risk fractions, percentage-point stress, sample returns and conditional projections", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceAutomaticAnalysis, {
        automation: fixture().automation,
      }),
    );
    expect(html).toContain("12 %");
    expect(html).toContain("-18 %");
    expect(html).toContain("-30.0 %");
    expect(html).toContain("Rendimiento acumulado de la muestra");
    expect(html).not.toContain("Rendimiento histórico anualizado");
    expect(html).toContain("Escenarios condicionales, no pronósticos");
    expect(html).toContain("no son el rendimiento de tus movimientos reales");
    expect(html).toContain(
      "no reutiliza automáticamente el efectivo registrado",
    );
    expect(html).not.toContain("<form");
  });
  it("marks an outdated report as an earlier reference", () => {
    const automation = fixture().automation!;
    automation.status = "stale";
    automation.staleReason = "La huella de los movimientos cambió.";
    const html = renderToStaticMarkup(
      createElement(FinanceAutomationStatus, { automation, demo: false }),
    );
    expect(html).toContain("Informe anterior · pendiente de actualizar");
    expect(html).toContain("referencia anterior, pendiente de validación");
    expect(html).toContain(automation.staleReason);
  });
});
