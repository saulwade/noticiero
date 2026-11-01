#!/usr/bin/env python3
"""Bounded, deterministic offline portfolio proposals. stdin JSON -> stdout JSON.

No network, credentials, persistence or order execution. Money strings are MXN.
See docs/automatic-finance-method.md for assumptions and interpretation.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_CEILING, ROUND_DOWN, ROUND_HALF_UP
import hashlib
import json
import math
from pathlib import Path
import sys
from urllib.parse import urlparse

import numpy as np
from finance_stocks import analyze_stocks
from finance_diagnostics import temporal_risk_check
from scipy.stats import scoreatpercentile
from sklearn.covariance import LedoitWolf

ENGINE_VERSION = json.loads((Path(__file__).resolve().parents[1] / "src/features/finance/automatic-engine-version.json").read_text(encoding="utf-8"))["version"]
CENT = Decimal("0.01")
MAX_MONEY = Decimal("1000000000000")
CATALOG = [
    {"symbol": "VT", "name": "Acciones globales · Vanguard Total World", "currency": "USD",
     "sourceUrl": "https://investor.vanguard.com/investment-products/etfs/profile/vt",
     "reason": "Acciones amplias de varios países; pueden sufrir pérdidas grandes y prolongadas."},
    {"symbol": "SGOV", "name": "Tesoro de EE. UU. 0–3 meses · iShares", "currency": "USD",
     "sourceUrl": "https://www.ishares.com/us/products/314116/sgov",
     "reason": "Deuda soberana USD de muy corto plazo; su valor en MXN también cambia con el dólar. No equivale a CETES."},
    {"symbol": "MXN-CASH", "name": "Efectivo disponible en MXN", "currency": "MXN",
     "sourceUrl": "https://www.banxico.org.mx/",
     "reason": "Dinero sin invertir en MXN; se supone rendimiento nominal cero, sin protección frente a inflación."},
]
SYMBOLS = [x["symbol"] for x in CATALOG]
BASELINES = {
    "unconfirmed": [0.35, 0.40, 0.25],
    "cautious": [0.20, 0.40, 0.40],
    "balanced": [0.55, 0.35, 0.10],
    "growth": [0.75, 0.20, 0.05],
}
LIMITS = {
    "unconfirmed": {"equityMin": .10, "equityMax": .35, "cashMin": .25, "usdMax": .75, "volMax": .12, "stressMax": .25},
    "cautious": {"equityMin": .10, "equityMax": .25, "cashMin": .40, "usdMax": .60, "volMax": .10, "stressMax": .20},
    "balanced": {"equityMin": .25, "equityMax": .60, "cashMin": .10, "usdMax": .90, "volMax": .18, "stressMax": .33},
    "growth": {"equityMin": .45, "equityMax": .80, "cashMin": .05, "usdMax": .95, "volMax": .24, "stressMax": .40},
}
STRESS_SHOCKS = [("Caída bursátil y apreciación del peso", -.35, -.005, -.15),
                 ("Apreciación del peso frente al dólar", 0.0, 0.0, -.20),
                 ("Caída bursátil y dólar más caro", -.35, -.005, .20)]


def decimal_value(value, label, *, maximum=MAX_MONEY, positive=False, cents=False):
    if cents and not isinstance(value, str):
        raise ValueError(f"{label}: importe monetario como cadena requerido")
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise ValueError(f"{label}: número requerido")
    if len(str(value)) > 100:
        raise ValueError(f"{label}: número demasiado largo")
    try:
        number = Decimal(str(value))
    except InvalidOperation as error:
        raise ValueError(f"{label}: número inválido") from error
    if not number.is_finite() or number < 0 or number > maximum or (positive and number < Decimal("0.000000001")):
        raise ValueError(f"{label}: fuera de límites finitos")
    if cents and number != number.quantize(CENT):
        raise ValueError(f"{label}: como máximo dos decimales")
    return number


def instant(value, label):
    if not isinstance(value, str) or len(value) > 40:
        raise ValueError(f"{label}: fecha inválida")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"{label}: fecha inválida") from error
    if parsed.tzinfo is None:
        if len(value) != 10:
            raise ValueError(f"{label}: zona horaria requerida")
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def session_date(value):
    if not isinstance(value, str) or len(value) != 10:
        raise ValueError("sesión: fecha YYYY-MM-DD requerida")
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise ValueError("sesión: fecha inválida") from error


def url(value):
    if not isinstance(value, str) or len(value) > 2000:
        return ""
    parsed = urlparse(value)
    return value if parsed.scheme == "https" and parsed.netloc and not parsed.username else ""


def text(value, limit=600):
    return str(value or "")[:limit]


def money(value):
    number = Decimal(str(value))
    if not number.is_finite():
        raise ValueError("resultado monetario no finito")
    return format(number.quantize(CENT, rounding=ROUND_HALF_UP), ".2f")


def validate(data):
    if not isinstance(data, dict) or data.get("version") != 1 or isinstance(data.get("version"), bool):
        raise ValueError("versión de entrada no compatible")
    if "engineVersion" in data and data["engineVersion"] != ENGINE_VERSION:
        raise ValueError("versión del motor no corresponde a la entrada")
    if not isinstance(data.get("inputHash"), str) or not 1 <= len(data["inputHash"]) <= 200:
        raise ValueError("huella de entrada requerida")
    as_of = instant(data.get("asOf"), "asOf")
    if not 2000 <= as_of.year <= 2100:
        raise ValueError("asOf fuera de límites")
    profile = data.get("profile", {})
    if not isinstance(profile, dict):
        raise ValueError("perfil: objeto requerido")
    if profile.get("riskPreference") not in BASELINES or profile.get("reserveExcluded") is not True:
        raise ValueError("perfil: riesgo y reserva excluida requeridos")
    if not isinstance(profile.get("horizonYears"), int) or isinstance(profile["horizonYears"], bool) or not 1 <= profile["horizonYears"] <= 30:
        raise ValueError("horizonte: entre 1 y 30 años")
    for key in ["initialCapitalMxn", "monthlyContributionMxn"]:
        decimal_value(profile.get(key), key, cents=True)
    if instant(profile.get("updatedAt"), "perfil.updatedAt") > as_of:
        raise ValueError("perfil fechado en el futuro")
    broker = profile.get("broker", {})
    if not isinstance(broker, dict) or not isinstance(broker.get("verified"), bool):
        raise ValueError("intermediario: verificación requerida")
    if "fractional" in broker and not isinstance(broker["fractional"], bool):
        raise ValueError("fracciones: booleano requerido")
    for key in ["feePercent", "fxSpreadPercent"]:
        if key in broker:
            decimal_value(broker[key], key, maximum=Decimal("10"))
    portfolio = data.get("portfolio", {})
    if not isinstance(portfolio, dict):
        raise ValueError("cartera: objeto requerido")
    if not isinstance(portfolio.get("hasMovements"), bool) or not isinstance(portfolio.get("complete"), bool):
        raise ValueError("cartera: estado requerido")
    decimal_value(portfolio.get("cashMxn"), "efectivo", cents=True)
    if "valueMxn" in portfolio:
        decimal_value(portfolio["valueMxn"], "valor real", cents=True)
    for key, maximum in [("histories", 3), ("references", 3), ("news", 200), ("assets", 3)]:
        if not isinstance(data.get(key), list) or len(data[key]) > maximum:
            raise ValueError(f"{key}: lista fuera de límites")
        if not all(isinstance(item, dict) for item in data[key]):
            raise ValueError(f"{key}: objetos requeridos")
    if not isinstance(data.get("dataWarnings"), list) or len(data["dataWarnings"]) > 100 or not all(isinstance(warning, str) for warning in data["dataWarnings"]):
        raise ValueError("advertencias: lista fuera de límites")
    expected_roles = dict(zip(SYMBOLS, ["global-equity", "short-usd-treasury", "mxn-cash"]))
    asset_symbols = set()
    for asset in data["assets"]:
        symbol = asset.get("symbol")
        expected_currency = "MXN" if symbol == "MXN-CASH" else "USD"
        if symbol not in SYMBOLS or symbol in asset_symbols or asset.get("role") != expected_roles[symbol] or asset.get("currency") != expected_currency:
            raise ValueError("catálogo: símbolo, función o divisa inválidos")
        if not isinstance(asset.get("name"), str) or not 1 <= len(asset["name"]) <= 300 or not url(asset.get("sourceUrl")):
            raise ValueError("catálogo: nombre o fuente inválidos")
        asset_symbols.add(symbol)
    if not isinstance(portfolio.get("positions"), list) or len(portfolio["positions"]) > 100:
        raise ValueError("posiciones: lista fuera de límites")
    seen = set()
    for item in portfolio["positions"]:
        if not isinstance(item, dict):
            raise ValueError("posición: objeto requerido")
        symbol = item.get("symbol")
        if not isinstance(symbol, str) or not symbol or symbol in seen:
            raise ValueError("posición duplicada o sin símbolo")
        seen.add(symbol)
        decimal_value(item.get("quantity"), "cantidad")
        if "valueMxn" in item:
            decimal_value(item["valueMxn"], "valor posición", cents=True)
    return as_of


def histories_matrix(data, as_of, warnings):
    """Use the latest contiguous exact-date intersection; never carry/zero-fill."""
    series = {}
    for history in data["histories"]:
        symbol = history.get("symbol")
        if symbol not in SYMBOLS[:2] or symbol in series:
            raise ValueError("histórico desconocido o duplicado")
        if history.get("currency") != "USD":
            raise ValueError("divisa histórica incompatible con catálogo")
        captured = instant(history.get("capturedAt"), "histórico.capturedAt")
        if captured > as_of:
            raise ValueError("histórico capturado en el futuro")
        if "fxSourceUrl" in history and not url(history["fxSourceUrl"]):
            raise ValueError("fuente FX histórica inválida")
        points = history.get("points", [])
        if not isinstance(points, list) or len(points) > 1600:
            raise ValueError("histórico fuera de límites")
        if not isinstance(history.get("warnings"), list) or len(history["warnings"]) > 100 or not all(isinstance(warning, str) for warning in history["warnings"]):
            raise ValueError("advertencias históricas fuera de límites")
        observations = {}
        max_fx_lag = 0
        for point in points:
            if not isinstance(point, dict):
                raise ValueError("observación: objeto requerido")
            day = session_date(point.get("date"))
            if day > as_of.date() or day > captured.date() or day in observations:
                raise ValueError("histórico futuro o sesión duplicada")
            if "fxDate" in point:
                fx_day = session_date(point["fxDate"])
                fx_lag = (day - fx_day).days
                if not 0 <= fx_lag <= 7:
                    raise ValueError("FX histórico futuro o más de siete días anterior al cierre")
                max_fx_lag = max(max_fx_lag, fx_lag)
            decimal_value(point.get("close"), "cierre", positive=True, maximum=Decimal("1000000000"))
            adjusted = decimal_value(point.get("adjustedClose"), "ajustado", positive=True, maximum=Decimal("1000000000"))
            fx = decimal_value(point.get("fxMxn"), "FX", positive=True, maximum=Decimal("1000000"))
            observations[day] = float(adjusted * fx)
        if history.get("adjusted") is not True:
            warnings.append(f"{symbol}: histórico sin ajuste confirmado; no se usa para rendimiento.")
            observations = {}
        series[symbol] = observations
        warnings.extend(text(x) for x in history.get("warnings", [])[:20])
        if max_fx_lag:
            warnings.append(f"{symbol}: FX de referencia anterior al cierre hasta {max_fx_lag} días, sin usar cambios futuros; comprobar sesiones en el histórico.")
    common = sorted(set(series.get("VT", {})) & set(series.get("SGOV", {})))
    if not common:
        return [], np.empty((0, 2))
    start = 0
    for i in range(1, len(common)):
        if not 4 <= (common[i] - common[i - 1]).days <= 10:
            start = i
    if start:
        warnings.append("Hay huecos o frecuencia incompatible; se usa solo el último tramo semanal continuo y alineado, sin rellenar retornos.")
    common = common[start:]
    values = np.array([[series[s][day] for s in SYMBOLS[:2]] for day in common])
    returns = values[1:] / values[:-1] - 1
    if not np.all(np.isfinite(returns)) or np.any(returns <= -1) or np.any(returns > 5):
        warnings.append("Histórico con saltos extremos o no finitos; métricas retenidas hasta verificar ajustes.")
        return [], np.empty((0, 2))
    if (as_of.date() - common[-1]).days > 14:
        warnings.append(f"Último histórico {common[-1]}: datos antiguos; no se proyecta desde una muestra obsoleta.")
    return common, returns


def valid_references(data, as_of, warnings):
    valid = {}
    seen = set()
    for reference in data["references"]:
        symbol = reference.get("symbol")
        if symbol not in SYMBOLS[:2] or symbol in seen or reference.get("currency") != "USD":
            raise ValueError("referencia desconocida, duplicada o divisa incompatible")
        seen.add(symbol)
        day = session_date(reference.get("session"))
        captured = instant(reference.get("capturedAt"), "referencia.capturedAt")
        price = decimal_value(reference.get("price"), "precio", positive=True, maximum=Decimal("1000000000"))
        fx = decimal_value(reference.get("fxMxn"), "FX referencia", positive=True, maximum=Decimal("1000000"))
        if day > as_of.date() or captured > as_of or day > captured.date():
            raise ValueError("referencia futura o sesión posterior a captura")
        fx_day = session_date(reference["fxSession"]) if "fxSession" in reference else day
        # A current valuation can combine the last exchange close with newer FX
        # already known at this report cutoff. Historical indices remain stricter.
        if fx_day > as_of.date() or fx_day > captured.date():
            raise ValueError("FX de referencia futuro o posterior a captura conjunta")
        if "fxSourceUrl" in reference and not url(reference["fxSourceUrl"]):
            raise ValueError("fuente FX de referencia inválida")
        if fx_day != day:
            warnings.append(f"{symbol}: precio del {day} y FX del {fx_day} tienen fechas distintas, ambos conocidos al corte; valoración de referencia, no precio ejecutable.")
        if (as_of.date() - day).days > 7 or (as_of.date() - fx_day).days > 7 or (as_of - captured).total_seconds() > 7 * 86400:
            warnings.append(f"{symbol}: referencia antigua ({day}); cantidades no disponibles.")
        elif not url(reference.get("sourceUrl")):
            warnings.append(f"{symbol}: fuente de referencia no verificable; cantidades no disponibles.")
        else:
            valid[symbol] = (reference, price * fx)
    return valid


def split_cents(budget, weights):
    total = int(budget * 100)
    raw = [Decimal(str(x)) * total for x in weights]
    units = [int(x.to_integral_value(rounding=ROUND_DOWN)) for x in raw]
    remaining = total - sum(units)
    rank = sorted(range(len(units)), key=lambda i: (-(raw[i] - units[i]), i))
    for i in rank[:remaining]:
        units[i] += 1
    return [Decimal(x) / 100 for x in units]


def allocation(budget, weights, broker, references, catalog):
    items = []
    remainder = Decimal(0)
    envelopes = split_cents(budget, weights)
    known_costs = broker.get("verified") is True and "feePercent" in broker and "fxSpreadPercent" in broker
    for asset, weight, envelope in zip(catalog, weights, envelopes):
        reason = asset["reason"]
        item = {"symbol": asset["symbol"], "name": asset["name"], "weight": round(float(weight), 10),
                "amountMxn": money(envelope), "reason": reason, "sourceUrl": asset["sourceUrl"]}
        if asset["symbol"] != "MXN-CASH":
            if known_costs:
                rate = (Decimal(str(broker["feePercent"])) + Decimal(str(broker["fxSpreadPercent"]))) / 100
            else:
                rate = None
                item["reason"] += " Costes de comisión/cambio pendientes; importe de planificación sin descontar costes desconocidos."
            ref = references.get(asset["symbol"])
            # Unknown fees, fractional capability or stale prices cannot become an order size.
            if ref and known_costs and isinstance(broker.get("fractional"), bool):
                reference, unit_price = ref
                increment = Decimal("0.000001") if broker["fractional"] else Decimal(1)
                quantity = (envelope / (unit_price * (1 + rate))).quantize(increment, rounding=ROUND_DOWN)
                gross = (quantity * unit_price * (1 + rate)).quantize(CENT, rounding=ROUND_CEILING)
                if gross > envelope:
                    quantity = max(Decimal(0), quantity - increment)
                    gross = (quantity * unit_price * (1 + rate)).quantize(CENT, rounding=ROUND_CEILING)
                remainder += envelope - gross
                item.update(amountMxn=money(gross), quantity=format(quantity, "f"),
                            price=reference["price"], priceSession=reference["session"])
                principal = (quantity * unit_price).quantize(CENT, rounding=ROUND_DOWN)
                cost = gross - principal
                item["reason"] += f" Con las unidades redondeadas, desembolso bruto orientativo de {money(gross)} MXN, principal de {money(principal)} MXN y coste verificado estimado de {money(cost)} MXN (comisión, cambio y redondeo a centavos)."
                item["reason"] += " Cantidad orientativa con cierre de referencia; confirmar precio, condiciones y ejecución real."
                if "fxSession" in reference:
                    item["reason"] += f" FX de referencia del {reference['fxSession']}."
            elif known_costs:
                principal = (envelope / (1 + rate)).quantize(CENT, rounding=ROUND_DOWN)
                cost = envelope - principal
                item["reason"] += f" Si se utiliza todo el presupuesto bruto, coste verificado estimado de {money(cost)} MXN y capital comprable hasta {money(principal)} MXN; cantidades pendientes de referencia y condiciones."
        items.append(item)
    return {"budgetMxn": money(budget), "items": items, "cashRemainderMxn": money(remainder)}


def actual_state(data, warnings):
    portfolio = data["portfolio"]
    if not portfolio["hasMovements"]:
        return "new", None, None
    if not portfolio["complete"]:
        warnings.append("Faltan valoraciones reales de la cartera; no se infieren posiciones a partir de propuestas.")
        return "unknown", None, None
    values = {s: Decimal(0) for s in SYMBOLS}
    values["MXN-CASH"] = decimal_value(portfolio["cashMxn"], "efectivo")
    for position in portfolio["positions"]:
        if position["symbol"] not in SYMBOLS or "valueMxn" not in position:
            warnings.append("Hay posiciones sin cobertura o valoración; revisar antes de distribuir nuevas compras.")
            return "unknown", None, None
        # cashMxn already includes ledger cash; a synthetic MXN-CASH position would duplicate it.
        if position["symbol"] == "MXN-CASH":
            warnings.append("Efectivo duplicado como posición: se requiere conciliación de la cartera real.")
            return "unknown", None, None
        values[position["symbol"]] += decimal_value(position["valueMxn"], "valor posición")
    total = sum(values.values())
    if "valueMxn" not in portfolio or abs(total - Decimal(portfolio["valueMxn"])) > CENT:
        warnings.append("Valor total y componentes reales no concilian; propuesta de aportación pendiente.")
        return "unknown", None, None
    if total == 0:
        return "known", np.zeros(len(SYMBOLS)), total
    return "known", np.array([float(values[s] / total) for s in SYMBOLS]), total


def risk_metrics(dates, returns, weights):
    caveats = ["Riesgo histórico hipotético de la distribución propuesta en MXN, no rendimiento de tu cartera real.",
               "Cierres ajustados por el proveedor multiplicados por FX de sesión declarada (hasta siete días anterior si no hubo referencia); no son precios ejecutables.",
               "Efectivo MXN sin invertir: rendimiento nominal supuesto cero; impuestos e inflación no incluidos."]
    result = {"observations": len(returns), "frequency": "weekly", "concentration": float(np.sum(weights ** 2)),
              "covarianceMethod": "Ledoit–Wolf (scikit-learn), anualización semanal ×52",
              "riskContributions": [], "correlations": [], "caveats": caveats}
    if dates:
        result.update({"from": str(dates[0]), "to": str(dates[-1])})
    if len(returns) < 52:
        caveats.append("Se requieren al menos 52 retornos semanales comunes consecutivos; métricas y bootstrap no disponibles.")
        return result
    # Fit stochastic assets only: adding a constant cash column would invent cash variance via shrinkage.
    covariance = LedoitWolf().fit(returns).covariance_ * 52
    risky_weights = weights[:2]
    variance = max(0.0, float(risky_weights @ covariance @ risky_weights))
    result["annualizedVolatility"] = math.sqrt(variance)
    weighted = returns @ risky_weights
    wealth = np.concatenate(([1.0], np.cumprod(1 + weighted)))
    result["historicalReturn"] = float(wealth[-1] - 1)
    result["maximumDrawdown"] = float(np.min(wealth / np.maximum.accumulate(wealth) - 1))
    if variance > 1e-20:
        contributions = risky_weights * (covariance @ risky_weights) / variance
        result["riskContributions"] = [{"symbol": s, "share": float(c)} for s, c in zip(SYMBOLS, [*contributions, 0.0])]
    else:
        caveats.append("Varianza nula en esta muestra; contribuciones y correlación sin definición fiable.")
    if np.all(np.std(returns, axis=0) > 1e-12):
        result["correlations"] = [{"a": "VT", "b": "SGOV", "value": float(np.clip(np.corrcoef(returns.T)[0, 1], -1, 1))}]
    caveats.append("La regularización estabiliza la covarianza; no demuestra capacidad de predecir precios o rentabilidades.")
    caveats.append("Contribuciones Euler firmadas: un valor negativo indica cobertura en la muestra; efectivo conserva contribución cero.")
    return result


def stress_returns(weights):
    return [float(weights[0] * ((1 + equity) * (1 + fx) - 1) + weights[1] * ((1 + treasury) * (1 + fx) - 1))
            for _, equity, treasury, fx in STRESS_SHOCKS]


def allocation_limits(profile):
    limits = LIMITS[profile["riskPreference"]].copy()
    if profile["horizonYears"] < 5:
        limits.update(equityMin=min(limits["equityMin"], .10), equityMax=min(limits["equityMax"], .20),
                      cashMin=max(limits["cashMin"], .50), usdMax=min(limits["usdMax"], .50),
                      volMax=min(limits["volMax"], .10), stressMax=min(limits["stressMax"], .17))
    return limits


def constrained_allocation(profile, dates, returns, as_of):
    """Closest feasible 5%-grid point to anchor, using joint covariance, no alpha."""
    anchor = np.array(BASELINES[profile["riskPreference"]], dtype=float)
    limits = allocation_limits(profile)
    summary = (f"Límites exploratorios: acciones {limits['equityMin']:.0%}–{limits['equityMax']:.0%}, "
               f"efectivo mínimo {limits['cashMin']:.0%}, exposición de cotización USD máxima {limits['usdMax']:.0%}, "
               f"volatilidad histórica anualizada máxima {limits['volMax']:.0%} y pérdida de choque máxima {limits['stressMax']:.0%}.")
    if profile["horizonYears"] < 5:
        summary += " El horizonte menor de cinco años endurece estos límites; no asegura recuperar pérdidas."
    available = len(returns) >= 52 and bool(dates) and (as_of.date() - dates[-1]).days <= 14
    # Structural and stress constraints do not require historical observations.
    # Zero is only an internal sentinel; it is never reported as estimated risk.
    covariance = LedoitWolf().fit(returns).covariance_ * 52 if available else np.zeros((2, 2))
    pending = [] if available else ["Verificación de volatilidad pendiente: se aplican límites de horizonte, acciones, efectivo, USD y choques; la distribución es provisional sin cantidades ni compras hasta tener 52 retornos comunes recientes."]

    def diagnostics(candidate):
        vol = math.sqrt(max(0.0, float(candidate[:2] @ covariance @ candidate[:2])))
        loss = max(0.0, -min(stress_returns(candidate)))
        failures = []
        if candidate[0] < limits["equityMin"] - 1e-12 or candidate[0] > limits["equityMax"] + 1e-12:
            failures.append("rango de acciones")
        if candidate[2] < limits["cashMin"] - 1e-12:
            failures.append("efectivo mínimo")
        if candidate[:2].sum() > limits["usdMax"] + 1e-12:
            failures.append("exposición USD")
        if vol > limits["volMax"] + 1e-12:
            failures.append("volatilidad")
        if loss > limits["stressMax"] + 1e-12:
            failures.append("pérdida de choque")
        return vol, loss, failures

    anchor_vol, anchor_loss, anchor_failures = diagnostics(anchor)
    if not anchor_failures:
        return anchor, "feasible" if available else "pending", [summary, *pending,
            f"El ancla cumple los límites {'con esta muestra: volatilidad ' + format(anchor_vol, '.1%') if available else 'deterministas; volatilidad no disponible'} y pérdida de choque {anchor_loss:.1%}; se conservan sus pesos sin buscar mayor rentabilidad histórica."]
    feasible = []
    for equity_units in range(21):
        for treasury_units in range(21 - equity_units):
            candidate = np.array([equity_units, treasury_units, 20 - equity_units - treasury_units], dtype=float) / 20
            vol, loss, failures = diagnostics(candidate)
            if not failures:
                distance = float(np.sum((candidate - anchor) ** 2))
                feasible.append((round(distance, 12), vol, float(candidate[0]), float(candidate[1]), candidate, loss))
    breach = ", ".join(anchor_failures)
    if not feasible:
        return anchor, "infeasible", [summary,
            f"Ninguna combinación de la rejilla de 5 puntos cumple los límites; el ancla incumple {breach} (volatilidad {anchor_vol:.1%}, choque {anchor_loss:.1%}). Se conserva solo como comparación no viable: esperar y revisar límites, datos y tolerancia, sin proponer compras."]
    selected = min(feasible, key=lambda x: x[:4])
    _, vol, _, _, weights, loss = selected
    anchor_label = "/".join(f"{w:.0%}" for w in anchor)
    selected_label = "/".join(f"{w:.0%}" for w in weights)
    return weights, "feasible" if available else "pending", [summary, *pending,
        f"El ancla VT/SGOV/MXN {anchor_label} incumple {breach}; se elige el punto más cercano {selected_label} bajo los límites {'con covarianza Ledoit–Wolf: volatilidad ' + format(anchor_vol, '.1%') + ' → ' + format(vol, '.1%') if available else 'deterministas; volatilidad pendiente'}; pérdida de choque {anchor_loss:.1%} → {loss:.1%}. No se optimizan retornos esperados ni noticias."]


def stress_scenarios(weights, capital):
    result = []
    for (label, equity, treasury, fx), ret in zip(STRESS_SHOCKS, stress_returns(weights)):
        result.append({"label": label, "returnPercent": round(ret * 100, 6),
                       "endValueMxn": money(capital * Decimal(str(1 + ret))),
                       "assumption": f"Choque ilustrativo instantáneo sobre pesos objetivo, sin probabilidad asignada: VT {equity:+.1%} USD, SGOV {treasury:+.1%} USD, USD/MXN {fx:+.1%}; efectivo MXN 0%. Sin aportaciones ni costes; no es pérdida máxima posible."})
    return result


def bootstrap_seed(dates, returns, weights, capital, monthly, horizon):
    economic_inputs = {
        "method": "mbb8-weekly-1000-v1",
        "dates": [str(day) for day in dates],
        "returns": returns.tolist(),
        "weights": weights.tolist(),
        "capitalMxn": money(capital),
        "monthlyMxn": money(monthly),
        "horizonYears": horizon,
    }
    canonical = json.dumps(economic_inputs, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return int(hashlib.sha256(canonical.encode()).hexdigest()[:16], 16)


def bootstrap(returns, weights, capital, monthly, horizon, seed):
    """Joint moving blocks, no wrap across gaps; 1000 paths; month-end flows."""
    series = returns @ weights[:2]
    block = 8
    n = len(series)
    rng = np.random.default_rng(seed)
    paths = 1000
    years_list = sorted(set([1, min(3, horizon), horizon]))
    max_weeks = max(years_list) * 52
    starts = rng.integers(0, n - block + 1, size=(paths, math.ceil(max_weeks / block)))
    indexes = (starts[..., None] + np.arange(block)).reshape(paths, -1)[:, :max_weeks]
    samples = series[indexes]
    wealth = np.full(paths, float(capital), dtype=float)
    projections = []
    for week in range(1, max_weeks + 1):
        wealth *= 1 + samples[:, week - 1]
        # Exactly 12 monthly flows per 52-week year, added after that week's return.
        if (week * 12 // 52) > ((week - 1) * 12 // 52):
            wealth += float(monthly)
        if week % 52 == 0 and week // 52 in years_list:
            lower, median, upper = scoreatpercentile(wealth, [10, 50, 90])
            projections.append({"years": week // 52, "lowerMxn": money(lower), "medianMxn": money(median), "upperMxn": money(upper),
                                "method": "Bootstrap conjunto de bloques móviles de 8 semanas; 1.000 trayectorias, percentiles 10/50/90, semilla estable; aportaciones al cierre mensual.",
                                "caveat": f"Parte de {money(capital)} MXN y pesos objetivo; distribución condicional a repetir esta muestra y rebalancear semanalmente sin fricción, no probabilidad futura calibrada ni garantía. Incluye {money(monthly * 12 * (week // 52))} MXN de nuevas aportaciones, que no son ganancia; sin impuestos, inflación ni costes futuros."})
    return projections


def curated_news(data, as_of):
    candidates = []
    financial_system_terms = {"bank", "banks", "banking", "banco", "bancos", "bancario", "payments", "payment", "pagos", "financiero", "financieras", "financiera", "financial", "bolsa", "treasury"}
    for event in data["news"]:
        published = instant(event.get("publishedAt"), "noticia.publishedAt")
        if published > as_of or (event.get("capturedAt") and instant(event["capturedAt"], "noticia.capturedAt") > as_of):
            raise ValueError("noticia fechada en el futuro")
        title = event.get("title")
        source = event.get("sourceName")
        if not url(event.get("url")) or not isinstance(title, str) or not 1 <= len(title) <= 400 or not isinstance(source, str) or not 1 <= len(source) <= 200:
            continue
        if (as_of - published).days > 30:
            continue
        kind = event.get("eventKind", "business")
        context = " ".join(text(event.get(key), 1200) for key in ["title", "summary", "excerpt", "topic"]).lower()
        tokens = set("".join(character if character.isalnum() else " " for character in context).split())
        companies = [company for company in event.get("companies", [])[:30] if isinstance(company, dict)]
        public = sorted({text(company.get("name"), 60) for company in companies if company.get("private") is False and company.get("name")})[:3]
        private = sorted({text(company.get("name"), 60) for company in companies if company.get("private") is True and company.get("name")})[:3]
        system_link = bool(tokens & financial_system_terms) or "financial loss" in context or "pérdidas financieras" in context
        driver = ""
        if tokens & {"fx", "usd", "mxn", "peso", "pesos", "dollar", "dólar", "divisas", "currency"}:
            driver = "fx"
        elif tokens & {"fed", "rates", "rate", "tasas", "tasa", "banxico", "interest"} or "federal reserve" in context:
            driver = "rates"
        elif tokens & {"inflation", "inflación", "cpi", "ipc"}:
            driver = "inflation"
        elif tokens & {"gdp", "pib", "recession", "recesión", "employment", "empleo", "economy", "economía"}:
            driver = "activity"
        if kind == "security" and not (public or system_link):
            continue
        if kind == "macro":
            rank = 100 if driver else 85
        elif kind == "earnings":
            rank = 95 if public else 70
        elif kind == "regulation":
            rank = 90 if public or system_link else 65
        elif kind == "infrastructure":
            rank = 85 if public else 60
        elif kind == "security":
            rank = 80 if system_link else 75
        elif kind == "acquisition":
            rank = 80 if public else 60
        elif kind == "funding":
            rank = 70 if public else 60
        elif kind == "products":
            rank = 70 if public else 50
        elif public or system_link or driver:
            rank = 65
        else:
            continue
        identity = text(event.get("id"), 200)
        if not identity:
            continue
        # At most one item for the same conditional mechanism and named firms.
        mechanism_key = (kind, driver if kind == "macro" else "", tuple(public or private))
        candidates.append((rank, published, identity, event, public, private, driver, mechanism_key))
    candidates.sort(key=lambda x: (x[0], x[1], x[2]), reverse=True)
    mechanisms = {
        "macro": ("Si cambian las condiciones macroeconómicas descritas, podrían cambiar valoraciones, ingresos y USD/MXN.", "El sistema vigila las condiciones macroeconómicas; no hay evidencia suficiente en este contexto para cambiar los pesos."),
        "rates": ("Si las tasas descritas cambian de forma persistente, podrían afectar la renta de letras USD, el coste de financiación y las valoraciones de acciones.", "El sistema vigila tasas y su relación con deuda USD y acciones; el titular no activa un cambio de pesos."),
        "fx": ("Si persiste la variación del dólar frente al peso descrita, podría cambiar el valor en MXN de los activos cotizados en USD, incluido SGOV.", "El sistema revisa la exposición de cotización USD y sus choques; no extrapola el cambio observado ni cambia pesos por este titular."),
        "inflation": ("Si la inflación descrita modifica tasas o costes de forma persistente, podría afectar poder adquisitivo, márgenes y valoraciones.", "El sistema vigila inflación y tasas; las proyecciones nominales no garantizan preservar poder adquisitivo."),
        "activity": ("Si la actividad económica descrita cambia de forma persistente, podría afectar demanda, beneficios y condiciones de financiación.", "El sistema vigila actividad y resultados; este contexto no basta para cambiar la distribución."),
        "earnings": ("Si los resultados descritos reflejan un cambio duradero de ingresos o márgenes, podrían modificar los flujos de caja y la valoración de las empresas mencionadas.", "El sistema vigila resultados y persistencia de márgenes; una publicación aislada no aporta evidencia suficiente para cambiar pesos."),
        "regulation": ("Si la medida descrita entra en vigor y modifica costes o acceso a mercados, podría afectar flujos de caja de las empresas o del sistema financiero implicados.", "El sistema vigila alcance y entrada en vigor; este contexto no confirma un impacto cuantificable ni activa operaciones."),
        "security": ("Si el incidente descrito causa pérdidas financieras o interrupciones duraderas, podría afectar costes, continuidad o confianza en las empresas y servicios financieros implicados.", "El sistema vigila continuidad y pérdidas documentadas; no convierte un incidente ni su tono periodístico en rentabilidad esperada."),
        "infrastructure": ("Si el gasto de infraestructura descrito se ejecuta y produce ingresos suficientes para sus costes, podría cambiar capacidad, demanda a proveedores y flujos de caja.", "El sistema vigila ejecución del gasto y resultados posteriores; el anuncio por sí solo no demuestra rentabilidad ni justifica cambiar pesos."),
        "funding": ("Si la financiación descrita se completa y se transforma en inversión operativa, podría modificar capacidad o competencia; para empresas privadas el vínculo con esta cartera es indirecto y no se presume exposición directa a VT.", "El sistema vigila si la financiación se convierte en actividad verificable; un importe anunciado no se trata como ingreso ni como señal de compra."),
        "acquisition": ("Si la adquisición descrita se cierra y su integración cambia costes, deuda o ingresos, podría modificar los flujos de caja de las empresas implicadas.", "El sistema vigila cierre, financiación e integración; las sinergias anunciadas no se incorporan como ganancias futuras."),
        "products": ("Si el producto descrito logra adopción comercial y márgenes sostenibles, podría modificar ingresos, costes o competencia de las empresas implicadas.", "El sistema vigila adopción y resultados verificables; el lanzamiento no se convierte en una previsión de ventas ni en cambio de pesos."),
    }
    result = []
    seen_ids, seen_urls, seen_titles, seen_mechanisms = set(), set(), set(), set()
    for _, _, identity, event, public, private, driver, mechanism_key in candidates:
        normalized_title = " ".join("".join(character if character.isalnum() else " " for character in event["title"].lower()).split())
        source_url = event["url"].split("#", 1)[0]
        if identity in seen_ids or source_url in seen_urls or normalized_title in seen_titles or mechanism_key in seen_mechanisms:
            continue
        seen_ids.add(identity); seen_urls.add(source_url); seen_titles.add(normalized_title); seen_mechanisms.add(mechanism_key)
        key = driver if event.get("eventKind") == "macro" and driver else event.get("eventKind")
        mechanism, implication = mechanisms.get(key,
            ("Si el cambio empresarial descrito modifica flujos de caja de forma persistente, podría afectar costes o resultados de las empresas implicadas.",
             "El sistema vigila resultados verificables; este contexto no aporta evidencia suficiente para cambiar pesos."))
        if public:
            mechanism += " Cotizadas mencionadas: " + ", ".join(public) + "."
            implication += " Una mención no verifica exposición ni peso dentro de VT."
        elif private:
            mechanism += " Empresas privadas mencionadas: " + ", ".join(private) + "."
        if not event.get("summary") and not event.get("excerpt"):
            mechanism += " Cobertura limitada al titular: no hay cifras financieras verificadas."
        else:
            mechanism += " Este contexto no verifica cifras financieras ni causalidad."
        result.append({"id": identity, "title": event["title"], "url": event["url"],
                       "sourceName": event["sourceName"], "publishedAt": event["publishedAt"],
                       "mechanism": mechanism, "implication": implication})
        if len(result) == 3:
            break
    return result


def generate_report(data):
    as_of = validate(data)
    profile = data["profile"]
    warnings = [text(x) for x in data.get("dataWarnings", [])[:50]]
    capital = Decimal(profile["initialCapitalMxn"])
    monthly = Decimal(profile["monthlyContributionMxn"])
    dates, returns = histories_matrix(data, as_of, warnings)
    weights, selection_state, selection_reasons = constrained_allocation(profile, dates, returns, as_of)
    references = valid_references(data, as_of, warnings)
    state, actual_weights, actual_value = actual_state(data, warnings)
    metadata = {asset["symbol"]: asset for asset in data["assets"]}
    catalog = [{**asset, **({"name": metadata[asset["symbol"]]["name"], "sourceUrl": metadata[asset["symbol"]]["sourceUrl"]} if asset["symbol"] in metadata else {})} for asset in CATALOG]
    initial = allocation(capital, weights, profile["broker"], references if selection_state == "feasible" else {}, catalog)
    if selection_state == "infeasible":
        for item in initial["items"]:
            item["reason"] += " Solo comparación del ancla no viable: estos importes no proponen compras."
    contribution_weights = weights.copy()
    contribution_reason = "Aportación mensual orientativa a la distribución propuesta; todavía no hay posiciones reales."
    if selection_state in ("infeasible", "pending"):
        contribution_weights = np.array([0., 0., 1.])
        contribution_reason = "Distribución no validada bajo todos los límites exploratorios; mantener la aportación prevista en efectivo MXN mientras se revisan datos y riesgo."
    elif state == "known":
        # Direct new cash to underweight assets; never imply selling or a trade instruction.
        deficits = np.maximum(weights * (float(actual_value) + float(monthly)) - actual_weights * float(actual_value), 0)
        if deficits.sum() > 0:
            contribution_weights = deficits / deficits.sum()
        contribution_reason = "Usar la aportación para reducir diferencias frente al objetivo según la cartera real valorada; confirmar costes antes de ejecutar. No se proponen ventas automáticas."
    elif state == "unknown":
        contribution_weights = np.array([0., 0., 1.])
        contribution_reason = "Mantener la aportación en efectivo MXN hasta conciliar las posiciones reales y sus valoraciones."
    contribution = allocation(monthly, contribution_weights, profile["broker"], references if selection_state == "feasible" else {}, catalog)
    contribution["reason"] = contribution_reason
    contribution["reason"] += " Solo si entra ese dinero nuevo; no se confunde con efectivo existente ni con ganancia."
    risk = risk_metrics(dates, returns, weights)
    if selection_state == "infeasible":
        risk["caveats"].append("La distribución mostrada es solo el ancla de comparación no viable; no cumple los límites exploratorios y no produce cantidades ni proyecciones.")
    enough = len(returns) >= 52
    fresh_history = bool(dates) and (as_of.date() - dates[-1]).days <= 14
    unknown_risk = profile["riskPreference"] == "unconfirmed"
    reasons = ["La propuesta usa acciones globales, deuda USD de corto plazo y efectivo MXN; no crea posiciones ni registra una decisión."]
    if unknown_risk:
        reasons.append("Distribución exploratoria provisional con ancla 35/40/25: tolerancia a pérdidas sin confirmar; los pesos pueden reducir riesgo dentro de límites explícitos, pero no son una política aprobada ni una recomendación personalizada validada.")
    else:
        preference_name = {"cautious": "cauta", "balanced": "equilibrada", "growth": "crecimiento"}[profile["riskPreference"]]
        reasons.append(f"Distribución anclada a la preferencia {preference_name}; confirmar su compatibilidad con horizonte, liquidez y pérdidas tolerables antes de operar.")
    reasons.extend(selection_reasons)
    warnings.append(f"{weights[:2].sum():.0%} de la propuesta cotiza en USD; SGOV también incorpora exposición USD/MXN y no sustituye liquidez MXN garantizada.")
    if profile["horizonYears"] < 5:
        warnings.append("Horizonte menor de cinco años: las acciones pueden no recuperar pérdidas a tiempo; revisar la proporción de efectivo antes de invertir.")
    if not profile["broker"]["verified"]:
        warnings.append("Acceso, fracciones, comisión y diferencial cambiario del intermediario sin verificar; cantidades no disponibles.")
    elif "feePercent" not in profile["broker"] or "fxSpreadPercent" not in profile["broker"]:
        warnings.append("Costes incompletos: no se asume comisión ni diferencial cero y no se calculan cantidades.")
    drift = float(np.max(np.abs(actual_weights - weights))) if state == "known" and actual_value > 0 else 0.0
    if selection_state in ("infeasible", "pending"):
        action = "wait"
        reasons.append("Esperar: no se ha validado una combinación bajo todas las restricciones; no se presenta la comparación como una distribución aprobada ni se calculan cantidades de compra.")
    elif state == "unknown":
        action = "wait"
        reasons.append("Completar o conciliar datos de la cartera real antes de decidir compras o rebalanceos.")
    elif unknown_risk:
        action = "review-risk"
        reasons.append("Primero confirmar qué pérdida ilustrativa puedes sostener sin vender; después decidir si preparar inversión o aportar.")
    elif state == "new":
        action = "prepare"
        reasons.append("Sin cartera real financiada: revisar la propuesta inicial y condiciones del intermediario; no se simula una compra ejecutada.")
    elif actual_value == 0 and monthly > 0:
        action = "contribute"
        reasons.append("La cuenta registrada tiene saldo cero: la propuesta depende solo del dinero nuevo previsto, sin restaurar el capital inicial ni inferir concentración.")
    elif drift > .05 + 1e-12:
        action = "contribute" if monthly > 0 else "review-risk"
        reasons.append("Hay desvíos de más de cinco puntos porcentuales en la cartera real; revisar concentración y riesgo. Una aportación puede reducirlos, pero sin dinero nuevo también requieren revisión, sin ventas automáticas.")
    else:
        action = "maintain"
        reasons.append("Mantener la cartera real y revisar en la fecha prevista; un titular o movimiento diario no activa ventas automáticas.")
    if not enough:
        reasons.append("Falta una muestra común de 52 retornos semanales consecutivos: se muestran presupuestos y choques ilustrativos, sin inventar rentabilidad histórica.")
    projection_capital = actual_value if actual_value is not None else capital
    seed = bootstrap_seed(dates, returns, weights, projection_capital, monthly, profile["horizonYears"])
    projections = bootstrap(returns, weights, projection_capital, monthly, profile["horizonYears"], seed) if enough and fresh_history and state != "unknown" and selection_state != "infeasible" else []
    alternatives = []
    for key, label in [("cautious", "Cauta"), ("balanced", "Equilibrada"), ("growth", "Mayor exposición a acciones")]:
        candidate = np.array(BASELINES[key])
        rationale = "Ancla estable de comparación, que puede incumplir los límites del perfil y horizonte actuales; no es una propuesta adicional de compra ni se elige por maximizar rentabilidad pasada."
        if enough:
            metrics = risk_metrics(dates, returns, candidate)
            rationale += f" Volatilidad histórica anualizada {metrics['annualizedVolatility']:.1%}; caída histórica {metrics['maximumDrawdown']:.1%} en la muestra común."
        else:
            rationale += " Métricas comparables pendientes de una muestra suficiente."
        alternatives.append({"label": label, "weights": [{"symbol": s, "weight": w} for s, w in zip(SYMBOLS, BASELINES[key])], "rationale": rationale})
    daily = as_of + timedelta(days=1)
    month = as_of.replace(day=1) + timedelta(days=32)
    next_month = month.replace(day=1)
    report = {
        "version": 1, "id": "auto-" + hashlib.sha256((ENGINE_VERSION + ":" + data["inputHash"]).encode()).hexdigest()[:24],
        "inputHash": data["inputHash"], "asOf": data["asOf"], "engineVersion": ENGINE_VERSION,
        "status": "insufficient-data" if not enough or not fresh_history or state == "unknown" else ("provisional" if unknown_risk else "review"),
        "headline": "Sin combinación factible: revisar el riesgo" if selection_state == "infeasible" else ("Propuesta provisional: confirma el riesgo" if unknown_risk else "Cartera y próxima aportación para revisar"),
        "conclusion": "Esperar y revisar datos y límites antes de proponer compras." if selection_state in ("infeasible", "pending") else ("Revisar tolerancia a pérdidas antes de aprobar una distribución." if unknown_risk else ("Conciliar datos reales antes de operar." if state == "unknown" else ("Revisar el desvío y la concentración de la cartera real antes de decidir cómo acercarse al objetivo." if drift > .05 + 1e-12 else "Conservar el plan y usar aportaciones para acercarse al objetivo, con revisión humana antes de ejecutar."))),
        "action": action, "reasons": reasons, "initial": initial, "contribution": contribution,
        "risk": risk, "scenarios": stress_scenarios(weights, actual_value if actual_value is not None else capital),
        "projections": projections, "alternatives": alternatives, "news": curated_news(data, as_of),
        "warnings": list(dict.fromkeys(warnings)),
        "nextReview": {"daily": daily.isoformat().replace("+00:00", "Z"), "contribution": next_month.isoformat().replace("+00:00", "Z"),
                       "strategy": (as_of + timedelta(days=90)).isoformat().replace("+00:00", "Z"),
                       "triggers": ["Cambio de ingresos, liquidez necesaria u horizonte", "Pérdida ilustrativa incompatible con tu tolerancia", "Desvío real mayor de cinco puntos porcentuales", "Datos de precio, FX o cartera incompletos o antiguos"]},
        "methodology": ["Índices semanales de cierre ajustado × FX MXN de sesión declarada, nunca posterior y hasta siete días anterior; intersección de fechas de cierre y último tramo continuo, sin rellenar retornos.",
                        "Covarianza pública Ledoit–Wolf; riesgo y correlación históricos de la propuesta, nunca señal propietaria de compra.",
                        "Asignación anclada: rejilla determinista de 5 puntos porcentuales, distancia cuadrática mínima al ancla bajo límites de volatilidad Ledoit–Wolf, acciones, efectivo, USD y choques; sin maximizar retorno esperado. Límites exploratorios y más cautos con horizonte menor de cinco años.",
                        "Noticias curadas como contexto condicional; no alteran pesos, covarianzas ni retornos esperados.",
                        "Importes brutos en MXN; costes solo si están verificados. Propuesta, valor real y aportaciones son conceptos distintos.",
                        "Bootstrap condicional por bloques, no probabilidad futura calibrada; choques de acciones/FX ilustrativos sin probabilidad."]}
    if data.get("stockResearch") is not None:
        report["stockResearch"] = analyze_stocks(data["stockResearch"], as_of)
    evaluation = temporal_risk_check(profile, dates, returns, constrained_allocation, BASELINES[profile["riskPreference"]]) if enough and fresh_history else None
    if evaluation:
        report["evaluation"] = evaluation
    if state == "known":
        actual_risk = risk_metrics(dates, returns, actual_weights)
        actual_risk["caveats"][0] = "Riesgo hipotético con los pesos actuales registrados, mantenidos constantes en la muestra; no es rendimiento realizado de tus operaciones."
        actual_scenarios = stress_scenarios(actual_weights, actual_value)
        for scenario in actual_scenarios:
            scenario["assumption"] = scenario["assumption"].replace("pesos objetivo", "pesos actuales registrados")
        report["actualRisk"] = {"weights": [{"symbol": s, "weight": float(w)} for s, w in zip(SYMBOLS, actual_weights)],
                                "maximumWeightDrift": drift, "risk": actual_risk, "scenarios": actual_scenarios}
    # Fail closed if any numerical path overflows rather than output JSON NaN/Infinity.
    json.dumps(report, allow_nan=False)
    return report


def main():
    try:
        raw = sys.stdin.read(4_000_001)
        if len(raw) > 4_000_000:
            raise ValueError("entrada demasiado grande")
        def reject_constant(_):
            raise ValueError("constante JSON no finita")
        data = json.loads(raw, parse_constant=reject_constant)
        report = generate_report(data)
        sys.stdout.write(json.dumps(report, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n")
    except (ValueError, TypeError, KeyError, ArithmeticError) as error:
        # Never echo inputs (which can contain personal budgets) to runner logs.
        sys.stderr.write("No se pudo calcular el informe: entrada o resultado inválido (" + type(error).__name__ + ").\n")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
