import { hash } from "@/features/news/normalize";
import type { CompanyResearch, FinancialFact, Instrument } from "./types";

const MAX_BYTES = 6 * 1024 * 1024;
const FORMS = new Set([
  "10-K",
  "10-K/A",
  "10-Q",
  "10-Q/A",
  "20-F",
  "20-F/A",
  "40-F",
  "40-F/A",
  "6-K",
  "6-K/A",
]);
type Metric = {
  label: string;
  tags: string[];
  period: "duration" | "instant";
  unit: "money" | "shares";
};
const METRICS: Metric[] = [
  {
    label: "Ingresos",
    tags: [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "RevenueFromContractWithCustomerIncludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
    ],
    period: "duration",
    unit: "money",
  },
  {
    label: "Resultado neto",
    tags: ["NetIncomeLoss", "ProfitLoss"],
    period: "duration",
    unit: "money",
  },
  {
    label: "Resultado operativo",
    tags: ["OperatingIncomeLoss"],
    period: "duration",
    unit: "money",
  },
  {
    label: "Flujo operativo",
    tags: ["NetCashProvidedByUsedInOperatingActivities"],
    period: "duration",
    unit: "money",
  },
  {
    label: "Inversión en propiedad y equipo",
    tags: ["PaymentsToAcquirePropertyPlantAndEquipment"],
    period: "duration",
    unit: "money",
  },
  {
    label: "Acciones diluidas promedio",
    tags: ["WeightedAverageNumberOfDilutedSharesOutstanding"],
    period: "duration",
    unit: "shares",
  },
  {
    label: "Efectivo y equivalentes",
    tags: ["CashAndCashEquivalentsAtCarryingValue"],
    period: "instant",
    unit: "money",
  },
  { label: "Activos", tags: ["Assets"], period: "instant", unit: "money" },
  { label: "Pasivos", tags: ["Liabilities"], period: "instant", unit: "money" },
  {
    label: "Deuda a largo plazo · porción corriente",
    tags: ["LongTermDebtCurrent"],
    period: "instant",
    unit: "money",
  },
  {
    label: "Deuda a largo plazo · porción no corriente",
    tags: ["LongTermDebtNoncurrent"],
    period: "instant",
    unit: "money",
  },
];

class SecDataError extends Error {}
function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
function date(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
async function boundedJson(response: Response) {
  if (Number(response.headers.get("content-length")) > MAX_BYTES) {
    await response.body?.cancel();
    throw new SecDataError("La respuesta SEC excede el tamaño permitido.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new SecDataError("La respuesta SEC no contiene datos.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BYTES) {
      await reader.cancel();
      throw new SecDataError("La respuesta SEC excede el tamaño permitido.");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
type Candidate = FinancialFact & { priority: number };
function candidate(
  raw: unknown,
  unit: string,
  cik: string,
  cutoff: string,
  priority: number,
): Candidate | undefined {
  const r = object(raw);
  if (
    !r ||
    typeof r.val !== "number" ||
    !Number.isFinite(r.val) ||
    Math.abs(r.val) > Number.MAX_SAFE_INTEGER ||
    !date(r.end) ||
    !date(r.filed) ||
    r.end > cutoff ||
    r.filed > cutoff ||
    r.filed < r.end ||
    typeof r.form !== "string" ||
    !FORMS.has(r.form) ||
    typeof r.accn !== "string" ||
    !/^\d{10}-\d{2}-\d{6}$/.test(r.accn)
  )
    return;
  if (r.start !== undefined && (!date(r.start) || r.start > r.end)) return;
  return {
    label: "",
    value: r.val,
    unit,
    ...(r.start !== undefined ? { start: r.start as string } : {}),
    end: r.end,
    filed: r.filed,
    accession: r.accn,
    form: r.form,
    url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${r.accn.replaceAll("-", "")}/${r.accn}-index.html`,
    priority,
  };
}
function order(a: Candidate, b: Candidate) {
  return (
    b.end.localeCompare(a.end) ||
    b.filed.localeCompare(a.filed) ||
    a.priority - b.priority ||
    b.accession.localeCompare(a.accession)
  );
}
function durationDays(value: Candidate) {
  return value.start
    ? (Date.parse(value.end) - Date.parse(value.start)) / 86400000 + 1
    : 0;
}

/** Read-only, one bounded public request. No forecast, recommendation or company identity inference. */
export async function collectCompanyFacts(
  instrument: Instrument,
  now = new Date(),
  fetcher: typeof fetch = fetch,
): Promise<CompanyResearch> {
  if (instrument.kind !== "stock")
    throw new SecDataError(
      "La consulta de estados SEC admite acciones; un ETF requiere su ficha de fondo.",
    );
  if (
    !instrument.cik ||
    !/^\d{10}$/.test(instrument.cik) ||
    Number(instrument.cik) === 0
  )
    throw new SecDataError(
      "Indica un CIK SEC válido de diez dígitos; no se deduce a partir del ticker.",
    );
  if (!Number.isFinite(now.getTime()))
    throw new SecDataError("La fecha de consulta no es válida.");
  try {
    const cutoff = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const response = await fetcher(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${instrument.cik}.json`,
      {
        headers: {
          "User-Agent":
            "Noticiero personal research (https://github.com/saulwade/noticiero)",
          Accept: "application/json",
        },
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!response.ok || response.redirected) {
      await response.body?.cancel();
      throw new SecDataError(
        response.status === 429
          ? "SEC detuvo la consulta por cuota. Conserva la ficha previa e intenta más tarde."
          : "SEC no permitió completar la consulta pública. Conserva la ficha previa y revisa el documento oficial.",
      );
    }
    const body = object(await boundedJson(response));
    if (
      !body ||
      typeof body.cik !== "number" ||
      body.cik !== Number(instrument.cik)
    )
      throw new SecDataError(
        "No se pudo verificar la identidad del emisor SEC.",
      );
    const taxonomy = object(object(body.facts)?.["us-gaap"]);
    const warnings = [
      "Muestra de conceptos estándar us-gaap; segmentos, vencimientos y etiquetas personalizadas requieren revisar el reporte original.",
      "La fecha filed es un día de publicación, no la hora exacta de aceptación. Estos datos no bastan para un backtest intradía ni una recomendación.",
      "Trimestres y años son períodos separados; no se suman con acumulados YTD. Deuda corriente/no corriente no garantiza deuda total completa.",
    ];
    if (/bank|banc|financier|financial/i.test(instrument.sector ?? ""))
      warnings.push(
        "Banca: no aplicar EV/EBITDA; revisar capital regulatorio, depósitos, margen financiero y calidad del crédito en los reportes.",
      );
    if (!taxonomy)
      warnings.push(
        "No hay conceptos us-gaap soportados; puede requerirse un reporte IFRS o extracción manual.",
      );
    const facts: FinancialFact[] = [];
    const missing: string[] = [];
    for (const metric of METRICS) {
      const candidates: Candidate[] = [];
      const currencies = new Set<string>();
      for (const [priority, tag] of metric.tags.entries()) {
        const units = object(object(taxonomy?.[tag])?.units);
        if (!units) continue;
        for (const [unit, raw] of Object.entries(units)) {
          if (
            metric.unit === "shares"
              ? unit !== "shares"
              : !/^[A-Z]{3}$/.test(unit)
          )
            continue;
          if (!Array.isArray(raw)) continue;
          for (const entry of raw) {
            const item = candidate(
              entry,
              unit,
              instrument.cik,
              cutoff,
              priority,
            );
            if (!item) continue;
            if (
              metric.period === "instant"
                ? item.start !== undefined
                : item.start === undefined
            )
              continue;
            candidates.push(item);
            if (metric.unit === "money") currencies.add(unit);
          }
        }
      }
      if (currencies.size > 1) {
        warnings.push(
          `${metric.label}: más de una moneda en la historia; requiere revisión antes de comparar.`,
        );
        missing.push(metric.label);
        continue;
      }
      const periods =
        metric.period === "instant"
          ? [{ suffix: "", matches: (c: Candidate) => !c.start }]
          : [
              {
                suffix: " · trimestre",
                matches: (c: Candidate) =>
                  durationDays(c) >= 60 && durationDays(c) <= 110,
              },
              {
                suffix: " · año",
                matches: (c: Candidate) =>
                  durationDays(c) >= 330 && durationDays(c) <= 385,
              },
            ];
      let found = false;
      for (const period of periods) {
        const chosen = candidates.filter(period.matches).sort(order)[0];
        if (!chosen) continue;
        const { priority: _priority, ...fact } = chosen;
        void _priority;
        facts.push({ ...fact, label: metric.label + period.suffix });
        found = true;
      }
      if (!found) missing.push(metric.label);
    }
    if (missing.length)
      warnings.push(
        `Conceptos ausentes o no comparables: ${missing.join(", ")}. No se sustituyen por ceros.`,
      );
    if (
      facts.some((f) => Date.parse(cutoff) - Date.parse(f.end) > 550 * 86400000)
    )
      warnings.push(
        "Hay hechos con antigüedad superior a 18 meses; verifica su vigencia antes de decidir.",
      );
    const bounded = facts.slice(0, 20);
    return {
      id: hash(
        `sec-v1:${instrument.id}:${instrument.cik}:${JSON.stringify({ facts: bounded, warnings })}`,
      ),
      instrumentId: instrument.id,
      capturedAt: now.toISOString(),
      source: "SEC EDGAR · XBRL us-gaap",
      facts: bounded,
      warnings,
    };
  } catch (error) {
    if (error instanceof SecDataError) throw error;
    throw new SecDataError(
      "No se pudieron validar los datos públicos SEC. Conserva la ficha anterior y consulta el reporte original.",
    );
  }
}
