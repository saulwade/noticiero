import type { FinanceData } from "../../src/features/finance/types";
import type { AutomationReport } from "../../src/features/finance/automatic-types";

// Synthetic budgets and symbols, unrelated to any private profile or real holdings.
export const report: AutomationReport = {
  version: 1,
  id: "synthetic-report",
  inputHash: "synthetic-input",
  asOf: "2026-11-01",
  engineVersion: "fixture-v1",
  status: "provisional",
  headline: "Preparar una distribución diversificada",
  conclusion: "Revisar la tolerancia a pérdidas antes de la primera operación.",
  action: "prepare",
  reasons: [
    "Diversificar la exposición con una base estable.",
    "Conservar liquidez para el horizonte acordado.",
  ],
  initial: {
    budgetMxn: "12000",
    items: [
      {
        symbol: "SAMPLE",
        name: "ETF sintético global",
        weight: 0.7,
        amountMxn: "8400",
        quantity: "4",
        price: "100",
        priceSession: "2026-10-30",
        reason: "Exposición global de largo plazo.",
        sourceUrl: "https://example.com/synthetic-etf",
      },
      {
        symbol: "CASH_MXN",
        name: "Liquidez sintética en pesos",
        weight: 0.3,
        amountMxn: "3600",
        reason: "Liquidez para evitar ventas forzadas.",
        sourceUrl: "https://example.com/synthetic-cash",
      },
    ],
    cashRemainderMxn: "0",
  },
  contribution: {
    budgetMxn: "1200",
    items: [
      {
        symbol: "SAMPLE",
        name: "ETF sintético global",
        weight: 0.7,
        amountMxn: "840",
        reason: "Mantener la distribución de referencia.",
        sourceUrl: "https://example.com/synthetic-etf",
      },
      {
        symbol: "CASH_MXN",
        name: "Liquidez sintética en pesos",
        weight: 0.3,
        amountMxn: "360",
        reason: "Mantener liquidez.",
        sourceUrl: "https://example.com/synthetic-cash",
      },
    ],
    cashRemainderMxn: "0",
    reason: "Aportar sin inferir una ventaja por las noticias.",
  },
  risk: {
    observations: 104,
    frequency: "weekly",
    from: "2024-11-01",
    to: "2026-10-30",
    annualizedVolatility: 0.12,
    maximumDrawdown: -0.18,
    historicalReturn: 0.05,
    concentration: 0.58,
    covarianceMethod: "Covarianza regularizada de prueba",
    riskContributions: [{ symbol: "SAMPLE", share: 1 }],
    correlations: [],
    caveats: [
      "Muestra sintética; no representa el rendimiento de un instrumento.",
    ],
  },
  scenarios: [
    {
      label: "Caída ilustrativa",
      returnPercent: -30,
      endValueMxn: "8400",
      assumption:
        "Si el capital inicial perdiera 30 %, sin aportaciones ni recuperación supuesta.",
    },
  ],
  projections: [
    {
      years: 5,
      lowerMxn: "60000",
      medianMxn: "84000",
      upperMxn: "100000",
      method: "Remuestreo sintético de prueba.",
      caveat: "Los supuestos pueden fallar; no es una predicción.",
    },
  ],
  alternatives: [],
  news: [
    {
      id: "synthetic-news",
      title: "Cambio sintético en costos financieros",
      url: "https://example.com/synthetic-news",
      sourceName: "Fuente de prueba",
      publishedAt: "2026-10-31T18:00:00Z",
      mechanism:
        "Si suben las tasas, los costos de financiación podrían aumentar.",
      implication: "Contrastar el mecanismo antes de cambiar la distribución.",
    },
  ],
  warnings: ["Costos del intermediario pendientes de confirmar."],
  nextReview: {
    daily: "2026-11-02",
    contribution: "2026-12-01",
    strategy: "2027-02-01",
    triggers: ["Cambio del perfil o de los movimientos reales."],
  },
  methodology: [
    "Las noticias aportan contexto; no son rendimientos esperados.",
  ],
};
export function fixture(): FinanceData {
  return {
    instruments: [],
    movements: [],
    marks: [],
    theses: [],
    decisions: [],
    research: [],
    summary: {
      asOf: "2026-11-01",
      complete: true,
      cash: { MXN: "0", USD: "0" },
      knownValueMxn: "0",
      valueMxn: "0",
      contributionsMxn: "0",
      withdrawalsMxn: "0",
      pnlMxn: "0",
      positions: [],
      warnings: [],
      allocation: [],
      proposal: {
        status: "blocked",
        label: "Sin política aprobada",
        reason: "Fixture sintética",
        amountMxn: "0",
        items: [],
        missing: [],
      },
      performance: {
        twr: 12.5,
        mwr: -3.25,
        reason: "Porcentajes calculados por el motor.",
      },
    },
    automation: {
      status: "ready",
      message: "Informe sintético preparado en segundo plano.",
      lastSuccess: "2026-11-01T12:00:00Z",
      current: report,
      history: [report],
      totalReports: 1,
    },
  };
}
