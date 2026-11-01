#!/usr/bin/env python3
"""Offline, deterministic finance reference. No network, learning or trading.

Input on stdin: {"unitized_index": [{"date": "YYYY-MM-DD", "value": "1.0"}],
                "benchmark": [{"date": "YYYY-MM-DD", "value": "1.0"}]}
Use a total-return/unitized index with external contributions removed, never
the raw account balance. Daily-session annualization assumes 252 sessions and
requires at least 60 observed returns. Missing observations are not imputed.
Results are descriptive historical statistics, not forecasts or probabilities.
All numeric output is decimal text. This script is not a deployed worker.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation, localcontext
import json
import sys
from typing import Iterable

MIN_RETURNS = 60
MAX_ROWS = 5000
MAX_BYTES = 1_000_000


def decimal(value: object) -> Decimal:
    if isinstance(value, bool) or not isinstance(value, (str, int, Decimal)):
        raise ValueError("Las cifras deben ser decimales explícitos, sin valores ausentes.")
    try:
        result = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError("Cifra decimal inválida.") from exc
    if not result.is_finite() or abs(result) > Decimal("1e24"):
        raise ValueError("Cifra fuera del rango finito permitido.")
    return result


def pnl(end_value: object, deposits: Iterable[object], withdrawals: Iterable[object]) -> Decimal:
    """An account starting at zero: final value + external withdrawals - deposits."""
    end = decimal(end_value)
    ins, outs = [decimal(x) for x in deposits], [decimal(x) for x in withdrawals]
    if end < 0 or any(x < 0 for x in ins + outs):
        raise ValueError("Valor, aportaciones y retiros deben ser no negativos.")
    return end + sum(outs, Decimal(0)) - sum(ins, Decimal(0))


def mxn_return(asset_return: object, fx_return: object) -> Decimal:
    asset, fx = decimal(asset_return), decimal(fx_return)
    if asset < -1 or fx <= -1:
        raise ValueError("Retorno o tipo de cambio imposible para un activo sin apalancamiento.")
    return (1 + asset) * (1 + fx) - 1


def observations(raw: object) -> list[tuple[date, Decimal]]:
    if not isinstance(raw, list) or not 2 <= len(raw) <= MAX_ROWS:
        raise ValueError("Se requieren entre 2 y 5000 observaciones fechadas.")
    rows: list[tuple[date, Decimal]] = []
    for item in raw:
        if not isinstance(item, dict) or set(item) != {"date", "value"}:
            raise ValueError("Cada observación requiere únicamente date y value.")
        text = item["date"]
        if not isinstance(text, str) or len(text) != 10:
            raise ValueError("Fecha inválida.")
        try:
            day = date.fromisoformat(text)
        except ValueError as exc:
            raise ValueError("Fecha inválida.") from exc
        if day.isoformat() != text or (rows and day <= rows[-1][0]):
            raise ValueError("Las fechas deben ser únicas y crecientes.")
        value = decimal(item["value"])
        if value <= 0:
            raise ValueError("El índice debe ser positivo; una quiebra requiere tratamiento específico.")
        rows.append((day, value))
    return rows


def returns(values: list[Decimal]) -> list[Decimal]:
    return [b / a - 1 for a, b in zip(values, values[1:])]


def maximum_drawdown(values: list[Decimal]) -> Decimal:
    peak, worst = values[0], Decimal(0)
    for value in values:
        peak = max(peak, value)
        worst = min(worst, value / peak - 1)
    return worst


def mean(values: list[Decimal]) -> Decimal:
    return sum(values, Decimal(0)) / len(values)


def volatility(values: list[Decimal]) -> Decimal | None:
    if len(values) < MIN_RETURNS:
        return None
    avg = mean(values)
    sample_variance = sum(((v - avg) ** 2 for v in values), Decimal(0)) / (len(values) - 1)
    return (sample_variance * 252).sqrt()


def correlation(a: list[Decimal], b: list[Decimal]) -> Decimal | None:
    if len(a) != len(b):
        raise ValueError("Las series deben compartir observaciones, sin relleno con ceros.")
    if len(a) < MIN_RETURNS:
        return None
    ma, mb = mean(a), mean(b)
    aa = sum(((v - ma) ** 2 for v in a), Decimal(0))
    bb = sum(((v - mb) ** 2 for v in b), Decimal(0))
    if aa == 0 or bb == 0:
        return None
    cross = sum(((x - ma) * (y - mb) for x, y in zip(a, b)), Decimal(0))
    return max(Decimal(-1), min(Decimal(1), cross / (aa * bb).sqrt()))


def report(payload: object) -> dict[str, object]:
    if not isinstance(payload, dict) or "unitized_index" not in payload or set(payload) - {"unitized_index", "benchmark"}:
        raise ValueError("Indica unitized_index y, opcionalmente, benchmark.")
    with localcontext() as ctx:
        ctx.prec = 40
        rows = observations(payload["unitized_index"])
        values = [v for _, v in rows]
        daily = returns(values)
        # This is a conservative gap check, not a replacement for a market calendar.
        long_gaps = any((b[0] - a[0]).days > 5 for a, b in zip(rows, rows[1:]))
        vol = None if long_gaps else volatility(daily)
        corr = None
        if "benchmark" in payload:
            benchmark = observations(payload["benchmark"])
            if [d for d, _ in rows] != [d for d, _ in benchmark]:
                raise ValueError("El benchmark debe usar exactamente las mismas fechas.")
            if not long_gaps:
                corr = correlation(daily, returns([v for _, v in benchmark]))
        text = lambda x: str(x) if x is not None else None
        return {
            "method": "historical-descriptive-v1",
            "observed_returns": len(daily),
            "total_return": text(values[-1] / values[0] - 1),
            "maximum_drawdown": text(maximum_drawdown(values)),
            "annualized_volatility": text(vol),
            "correlation": text(corr),
            "status": "insufficient-history" if len(daily) < MIN_RETURNS else "review-gaps" if long_gaps else "descriptive",
            "limitation": "Índice unitizado con dividendos; no saldo bruto. Convención 252 sesiones, sin rellenar datos ni predecir recuperación.",
        }


def main() -> int:
    try:
        raw = sys.stdin.buffer.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError("La entrada supera el límite.")
        payload = json.loads(raw, parse_float=Decimal, parse_int=Decimal,
                             parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Constante no finita.")))
        print(json.dumps(report(payload), ensure_ascii=False, allow_nan=False))
        return 0
    except (ValueError, InvalidOperation, ArithmeticError):
        print(json.dumps({"error": "Datos de riesgo inválidos o insuficientes; no se sustituyen por ceros."}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
