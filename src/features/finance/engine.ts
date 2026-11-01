import {
  decimal as d,
  formatted as f,
  multiply as mul,
  divide as div,
  ratio,
  SCALE,
} from "./decimal";
import type {
  Currency,
  FinanceMark,
  FinancePolicy,
  FinanceSummary,
  Instrument,
  Movement,
} from "./types";

export function financeDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function activeMovements(movements: Movement[], date: string) {
  const all = movements.filter((m) => m.date <= date);
  const reversed = new Set(
    all.flatMap((m) => (m.reversesId ? [m.reversesId] : [])),
  );
  return all
    .filter((m) => !m.reversesId && !reversed.has(m.id))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.sequence ?? 0) - (b.sequence ?? 0) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
}
export function replay(
  instruments: Instrument[],
  movements: Movement[],
  date: string,
) {
  const cash: Record<Currency, bigint> = { MXN: 0n, USD: 0n };
  const quantities = new Map<string, bigint>();
  let contributed = 0n,
    withdrawn = 0n;
  const byId = new Map(instruments.map((i) => [i.id, i]));
  for (const m of activeMovements(movements, date)) {
    const amount = d(m.amount),
      fee = d(m.fee),
      qty = d(m.quantity ?? "0"),
      price = d(m.price ?? "0");
    const currency = m.currency;
    const instrument = m.instrumentId ? byId.get(m.instrumentId) : undefined;
    if (m.instrumentId && !instrument)
      throw new Error("El instrumento no existe.");
    if (instrument && instrument.currency !== currency)
      throw new Error("La moneda no corresponde al instrumento.");
    const external =
      currency === "MXN" ? amount : mul(amount, d(m.fxRate ?? "0"));
    switch (m.kind) {
      case "deposit":
        cash[currency] += amount;
        contributed += external;
        break;
      case "withdrawal":
        cash[currency] -= amount;
        withdrawn += external;
        break;
      case "dividend":
      case "interest":
        cash[currency] += amount;
        break;
      case "fee":
      case "tax":
        cash[currency] -= amount;
        break;
      case "buy":
      case "sell": {
        if (!instrument || qty <= 0n || price <= 0n)
          throw new Error("Compra/venta incompleta.");
        if (!instrument.fractional && qty % SCALE !== 0n)
          throw new Error("El instrumento requiere títulos completos.");
        const direction = m.kind === "buy" ? 1n : -1n;
        quantities.set(
          instrument.id,
          (quantities.get(instrument.id) ?? 0n) + direction * qty,
        );
        cash[currency] -= direction * mul(qty, price);
        if (quantities.get(instrument.id)! < 0n)
          throw new Error("No hay títulos suficientes para vender.");
        break;
      }
      case "exchange": {
        const fx = d(m.fxRate ?? "0");
        if (fx <= 0n) throw new Error("Falta el tipo de cambio ejecutado.");
        cash[currency] -= amount;
        cash[currency === "MXN" ? "USD" : "MXN"] +=
          currency === "MXN" ? div(amount, fx) : mul(amount, fx);
        break;
      }
      case "split": {
        if (!instrument || qty <= 0n)
          throw new Error("Falta el ratio del split.");
        const previous = quantities.get(instrument.id) ?? 0n;
        if (previous <= 0n)
          throw new Error("No hay posición para aplicar el split.");
        if ((previous * qty) % SCALE !== 0n)
          throw new Error(
            "El split excede la precisión soportada; registra el ajuste documentado.",
          );
        quantities.set(instrument.id, mul(previous, qty));
        break;
      }
    }
    cash[currency] -= fee;
    if (
      [cash.MXN, cash.USD, ...quantities.values()].some((v) => v > 10n ** 40n)
    )
      throw new Error(
        "El movimiento excede la magnitud soportada por esta versión.",
      );
    if (cash.MXN < 0n || cash.USD < 0n)
      throw new Error(
        "El movimiento deja efectivo negativo. Revisa orden, moneda y saldo.",
      );
  }
  return { cash, quantities, contributed, withdrawn };
}
function latestMarks(marks: FinanceMark[], date: string) {
  const filtered = marks
    .filter((m) => m.asOf <= date)
    .sort(
      (a, b) =>
        a.asOf.localeCompare(b.asOf) ||
        a.capturedAt.localeCompare(b.capturedAt) ||
        a.id.localeCompare(b.id),
    );
  const prices = new Map<string, FinanceMark>();
  let fx: FinanceMark | undefined;
  for (const m of filtered) {
    if (m.kind === "fx") fx = m;
    else if (m.instrumentId) prices.set(m.instrumentId, m);
  }
  return { prices, fx };
}
function stale(day: string, today: string) {
  // Conservative weekday-age guard; exchange-specific holiday calendars are not claimed.
  let weekdays = 0;
  for (
    let t = Date.parse(`${day}T12:00:00Z`) + 86400000;
    t <= Date.parse(`${today}T12:00:00Z`);
    t += 86400000
  ) {
    const w = new Date(t).getUTCDay();
    if (w !== 0 && w !== 6) weekdays++;
  }
  return weekdays > 2;
}
function valuation(
  instruments: Instrument[],
  movements: Movement[],
  marks: FinanceMark[],
  date: string,
  strict = false,
) {
  const state = replay(instruments, movements, date),
    { prices, fx } = latestMarks(marks, date);
  let total = state.cash.MXN,
    complete = true;
  const warnings: string[] = [];
  const fxValue = fx ? d(fx.value) : undefined;
  if (state.cash.USD !== 0n) {
    if (fxValue) total += mul(state.cash.USD, fxValue);
    else {
      complete = false;
      warnings.push("Falta una referencia USD/MXN para valorar el efectivo.");
    }
  }
  if (
    fx &&
    (state.cash.USD !== 0n ||
      instruments.some(
        (i) => i.currency === "USD" && (state.quantities.get(i.id) ?? 0n) > 0n,
      )) &&
    stale(fx.asOf, date)
  )
    warnings.push(
      `USD/MXN de ${fx.asOf}: referencia antigua; confirma una valoración reciente.`,
    );
  if (strict && state.cash.USD !== 0n && fx?.asOf !== date) complete = false;
  const splits = new Map(
    activeMovements(movements, date)
      .filter((m) => m.kind === "split")
      .map((m) => [m.instrumentId, m]),
  );
  const positions = [...state.quantities]
    .filter(([, qty]) => qty > 0n)
    .map(([id, qty]) => {
      const i = instruments.find((i) => i.id === id)!,
        mark = prices.get(id);
      let value: bigint | undefined;
      if (mark && (i.currency === "MXN" || fxValue))
        value =
          i.currency === "MXN"
            ? mul(qty, d(mark.value))
            : mul(mul(qty, d(mark.value)), fxValue!);
      else {
        complete = false;
        warnings.push(`Falta precio o USD/MXN para ${i.symbol}.`);
      }
      const latestSplit = splits.get(id);
      if (
        mark &&
        latestSplit &&
        (mark.asOf < latestSplit.date ||
          (mark.asOf === latestSplit.date &&
            mark.capturedAt <= latestSplit.createdAt))
      ) {
        value = undefined;
        complete = false;
        warnings.push(`Confirma el precio de ${i.symbol} posterior al split.`);
      }
      if (mark && stale(mark.asOf, date))
        warnings.push(
          `${i.symbol}: valoración de ${mark.asOf}; requiere revisión.`,
        );
      if (
        strict &&
        (mark?.asOf !== date || (i.currency === "USD" && fx?.asOf !== date))
      )
        complete = false;
      if (value !== undefined) total += value;
      return {
        instrumentId: id,
        quantity: f(qty),
        price: mark?.value,
        asOf: mark?.asOf,
        valueMxn: value === undefined ? undefined : f(value),
      };
    });
  return { ...state, total, complete, warnings, positions, fxValue };
}
export function calculatePortfolio(
  instruments: Instrument[],
  movements: Movement[],
  marks: FinanceMark[],
  policy?: FinancePolicy,
  now = new Date(),
): FinanceSummary {
  const today = financeDay(now),
    v = valuation(instruments, movements, marks, today);
  const positions = v.positions.map((p) => ({
    ...p,
    weight:
      v.complete && p.valueMxn ? ratio(d(p.valueMxn), v.total) : undefined,
  }));
  const allocation = [
    { label: "Efectivo MXN", valueMxn: f(v.cash.MXN) },
    ...(v.cash.USD !== 0n && v.fxValue
      ? [{ label: "Efectivo USD", valueMxn: f(mul(v.cash.USD, v.fxValue)) }]
      : []),
    ...positions
      .filter((p) => p.valueMxn !== undefined)
      .map((p) => ({
        label: instruments.find((i) => i.id === p.instrumentId)!.name,
        valueMxn: p.valueMxn!,
      })),
  ].map((a) => ({
    ...a,
    weight: v.complete ? ratio(d(a.valueMxn), v.total) : undefined,
  }));
  const amount = policy?.monthlyContributionMxn ?? "0",
    contribution = d(amount);
  const missing: string[] = [];
  if (!policy?.approved || !policy.targets.length)
    missing.push(
      "Aprueba una distribución objetivo antes de simular la aportación.",
    );
  if (!v.complete) missing.push("Faltan valoraciones o referencia de divisas.");
  if (v.warnings.length)
    missing.push("Confirma los datos antiguos o pendientes de revisión.");
  if (contribution <= 0n)
    missing.push("Configura el monto de la próxima aportación.");
  const items: FinanceSummary["proposal"]["items"] = [];
  if (!missing.length && policy) {
    const after = v.total + contribution;
    const deficits = policy.targets.map((t) => {
      const current =
        t.instrumentId === "CASH_MXN"
          ? v.cash.MXN
          : t.instrumentId === "CASH_USD"
            ? v.fxValue
              ? mul(v.cash.USD, v.fxValue)
              : 0n
            : d(
                positions.find((p) => p.instrumentId === t.instrumentId)
                  ?.valueMxn ?? "0",
              );
      const instrument = instruments.find((i) => i.id === t.instrumentId);
      const mark = latestMarks(marks, today).prices.get(t.instrumentId);
      const split = activeMovements(movements, today)
        .filter((m) => m.kind === "split" && m.instrumentId === t.instrumentId)
        .at(-1);
      if (
        mark &&
        split &&
        (mark.asOf < split.date ||
          (mark.asOf === split.date && mark.capturedAt <= split.createdAt))
      )
        missing.push(
          "Confirma una valoración posterior al split del instrumento objetivo.",
        );
      if (
        instrument &&
        (!mark ||
          (instrument.currency === "USD" && !v.fxValue) ||
          stale(mark?.asOf ?? "1970-01-01", today))
      )
        missing.push(`Falta valoración reciente de ${instrument.symbol}.`);
      if (t.instrumentId === "CASH_USD" && !v.fxValue)
        missing.push("Falta referencia USD/MXN.");
      if (
        (t.instrumentId === "CASH_USD" || instrument?.currency === "USD") &&
        latestMarks(marks, today).fx &&
        stale(latestMarks(marks, today).fx!.asOf, today)
      )
        missing.push(
          "La referencia USD/MXN para esta aportación requiere actualización.",
        );
      const target = (after * BigInt(Math.round(t.weight * 100))) / 10_000n;
      return {
        ...t,
        current,
        deficit: target > current ? target - current : 0n,
      };
    });
    if (!missing.length) {
      const sum = deficits.reduce((s, t) => s + t.deficit, 0n);
      let allocated = 0n;
      for (const t of deficits.filter((t) => t.deficit > 0n)) {
        let budget = sum ? (contribution * t.deficit) / sum : 0n;
        const i = instruments.find((i) => i.id === t.instrumentId);
        if (i && !i.fractional) {
          const mark = latestMarks(marks, today).prices.get(i.id)!;
          const unit =
            i.currency === "MXN"
              ? d(mark.value)
              : mul(d(mark.value), v.fxValue!);
          budget = unit > 0n ? (budget / unit) * unit : 0n;
        }
        allocated += budget;
        if (budget > 0n)
          items.push({
            instrumentId: t.instrumentId,
            amountMxn: f(budget),
            afterWeight: ratio(t.current + budget, after),
          });
      }
      const remainder = contribution - allocated;
      if (remainder > 0n) {
        const item = items.find((i) => i.instrumentId === "CASH_MXN");
        if (item) {
          item.amountMxn = f(d(item.amountMxn) + remainder);
          item.afterWeight = ratio(v.cash.MXN + d(item.amountMxn), after);
        } else
          items.push({
            instrumentId: "CASH_MXN",
            amountMxn: f(remainder),
            afterWeight: ratio(v.cash.MXN + remainder, after),
          });
      }
    }
  }
  const performance = calculatePerformance(
    instruments,
    movements,
    marks,
    today,
  );
  return {
    asOf: today,
    complete: v.complete,
    cash: { MXN: f(v.cash.MXN), USD: f(v.cash.USD) },
    knownValueMxn: f(v.total),
    valueMxn: v.complete ? f(v.total) : undefined,
    contributionsMxn: f(v.contributed),
    withdrawalsMxn: f(v.withdrawn),
    pnlMxn: v.complete ? f(v.total - v.contributed + v.withdrawn) : undefined,
    positions,
    warnings: [...new Set(v.warnings)],
    allocation,
    proposal: {
      status: missing.length ? "blocked" : "review",
      label: missing.length
        ? "Primero completa la información"
        : "Distribución orientativa de dinero nuevo",
      reason:
        "Simulación antes de costos, sin vender posiciones. Confirma comisiones, diferencial, fracciones y restricciones en tu intermediario; no es una orden ni garantiza rendimiento.",
      amountMxn: amount,
      items: missing.length ? [] : items,
      missing: [...new Set(missing)],
    },
    performance,
  };
}
function calculatePerformance(
  instruments: Instrument[],
  movements: Movement[],
  marks: FinanceMark[],
  today: string,
): FinanceSummary["performance"] {
  const active = activeMovements(movements, today);
  if (!active.length)
    return {
      reason:
        "El rendimiento aparecerá con movimientos y valoraciones suficientes.",
    };
  const first = active[0].date;
  const days = [
    ...new Set([
      ...active.map((m) => m.date),
      ...marks
        .filter((m) => m.asOf >= first && m.asOf <= today)
        .map((m) => m.asOf),
    ]),
  ].sort();
  if (days.length > 400)
    return {
      reason:
        "El historial extenso necesita cálculo por lotes. El valor y el resultado siguen usando el archivo completo.",
    };
  let previous = 0n,
    product = 1;
  const flows: { date: string; amount: number }[] = [];
  for (const date of days) {
    const end = valuation(instruments, movements, marks, date, true);
    if (!end.complete)
      return {
        reason:
          "Faltan precios/FX coincidentes en las fechas de movimientos. No se inventa TWR ni tasa anual.",
      };
    const external = active
      .filter(
        (m) =>
          m.date === date && (m.kind === "deposit" || m.kind === "withdrawal"),
      )
      .reduce((s, m) => {
        const val =
          m.currency === "MXN"
            ? d(m.amount)
            : mul(d(m.amount), d(m.fxRate ?? "0"));
        return s + (m.kind === "deposit" ? val : -val);
      }, 0n);
    const denominator = previous + external;
    if (denominator > 0n) product *= Number(end.total) / Number(denominator);
    else if (end.total !== 0n || previous !== 0n || external !== 0n)
      return { reason: "No hay base suficiente para medir rendimiento." };
    if (external !== 0n)
      flows.push({ date, amount: -Number(external) / Number(SCALE) });
    previous = end.total;
  }
  const last = days.at(-1)!;
  flows.push({ date: last, amount: Number(previous) / Number(SCALE) });
  const span = (Date.parse(last) - Date.parse(first)) / 86400000;
  const mwr = span >= 365 ? xirr(flows) : undefined;
  return {
    twr: (product - 1) * 100,
    mwr,
    reason:
      "TWR por fechas observadas; flujos externos al inicio del día. XIRR anual solo con un año de historia y raíz única en el intervalo evaluado. No es expectativa futura.",
  };
}
export function xirr(
  flows: { date: string; amount: number }[],
): number | undefined {
  if (flows.length < 2 || flows.some((f) => !Number.isFinite(f.amount))) return;
  const first = Math.min(...flows.map((f) => Date.parse(f.date)));
  const npv = (rate: number) =>
    flows.reduce(
      (s, f) =>
        s +
        f.amount /
          Math.pow(1 + rate, (Date.parse(f.date) - first) / 31536000000),
      0,
    );
  // Multiple sign changes can create ambiguous roots: abstain rather than choose one.
  const combined = new Map<string, number>();
  for (const f of flows)
    combined.set(f.date, (combined.get(f.date) ?? 0) + f.amount);
  const signs = [...combined]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, a]) => Math.sign(a))
    .filter(Boolean);
  if (signs.filter((s, i) => i > 0 && s !== signs[i - 1]).length !== 1) return;
  let lo = -0.999,
    hi = 10,
    a = npv(lo),
    b = npv(hi);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a * b > 0) return;
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2,
      value = npv(mid);
    if (
      Math.abs(value) <
        flows.reduce((s, f) => s + Math.abs(f.amount), 0) * 1e-12 ||
      hi - lo < 1e-12
    )
      return mid * 100;
    if (a * value <= 0) {
      hi = mid;
      b = value;
    } else {
      lo = mid;
      a = value;
    }
  }
  return ((lo + hi) / 2) * 100;
}
