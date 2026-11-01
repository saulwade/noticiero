"""Point-in-time, source-linked company diagnostics. No network or stock ranking alpha."""
from copy import deepcopy
from datetime import date, datetime
import math
import numpy as np


def _number(value):
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise ValueError("dato financiero inválido")
    value = float(value)
    if not math.isfinite(value) or abs(value) > 1e16:
        raise ValueError("dato financiero fuera de límites")
    return value


def _same_period(a, b):
    return all(a.get(key) == b.get(key) for key in ("start", "end", "unit", "accession"))


def fundamental_metrics(research, as_of):
    facts = research.get("facts", [])[:20]
    prior = research.get("comparisonFacts", [])[:20]
    all_facts = facts + prior
    cutoff = as_of.date().isoformat()
    for fact in all_facts:
        _number(fact.get("value"))
        if date.fromisoformat(fact["end"]) > as_of.date() or date.fromisoformat(fact["filed"]) > as_of.date():
            raise ValueError("hecho financiero futuro")
    metrics, findings = [], []

    def add(key, label, value, unit, fact, indexes):
        if not math.isfinite(value) or abs(value) > 1e12:
            return
        metrics.append({"key": key, "label": label, "value": value, "unit": unit,
                        "period": (fact.get("start", fact["end"]) + " / " + fact["end"]), "factIndexes": indexes})

    for suffix in (" · trimestre", " · año"):
        def find(label):
            return next(((i, f) for i, f in enumerate(facts) if f["label"] == label + suffix and f["unit"] == "USD"), None)
        revenue = find("Ingresos")
        if revenue and revenue[1]["value"] > 0:
            ri, r = revenue
            for label, key in (("Resultado operativo", "operating-margin"), ("Resultado neto", "net-margin")):
                value = find(label)
                if value and _same_period(r, value[1]):
                    add(key + suffix, label.replace("Resultado", "Margen") + suffix,
                        value[1]["value"] / r["value"], "ratio", r, [ri, value[0]])
            previous = next(((len(facts) + i, p) for i, p in enumerate(prior)
                             if p["label"] == r["label"] and p["unit"] == r["unit"] and p["value"] > 0
                             and 350 <= (date.fromisoformat(r["end"]) - date.fromisoformat(p["end"])).days <= 380
                             and r.get("start") and p.get("start")
                             and abs((date.fromisoformat(r["end"]) - date.fromisoformat(r["start"])).days
                                     - (date.fromisoformat(p["end"]) - date.fromisoformat(p["start"])).days) <= 7), None)
            if previous:
                add("revenue-yoy" + suffix, "Cambio interanual de ingresos" + suffix,
                    r["value"] / previous[1]["value"] - 1, "ratio", r, [ri, previous[0]])
        cfo, capex = find("Flujo operativo"), find("Inversión en propiedad y equipo")
        if cfo and capex and capex[1]["value"] >= 0 and _same_period(cfo[1], capex[1]):
            free = cfo[1]["value"] - capex[1]["value"]
            add("fcf-proxy" + suffix, "Flujo operativo menos inversión" + suffix, free, "USD", cfo[1], [cfo[0], capex[0]])
            if free < 0:
                findings.append("El flujo operativo menos inversión es negativo en un período observado; investigar financiación y compromisos antes de interpretar crecimiento como caja disponible.")
    if any((date.fromisoformat(cutoff) - date.fromisoformat(f["end"])).days > 550 for f in facts):
        findings.append("Hay hechos de más de 18 meses; la ficha requiere confirmar vigencia.")
    if not metrics:
        findings.append("No hay conceptos USD y períodos compatibles suficientes; no se sustituyen por ceros ni se mezclan trimestre y acumulados.")
    findings.append("Estas métricas no determinan valor razonable: faltan valoración de mercado, segmentos, dilución, deuda completa y expectativas ya descontadas.")
    return metrics, list(dict.fromkeys(findings))


def stock_statistics(history, as_of):
    if not history or not history.get("adjusted") or history.get("currency") != "USD":
        return None
    if datetime.fromisoformat(history["capturedAt"].replace("Z", "+00:00")) > as_of:
        raise ValueError("historia futura")
    points = history.get("points", [])[-156:]
    dates, prices = [], []
    for point in points:
        day = date.fromisoformat(point["date"])
        fx_day = date.fromisoformat(point.get("fxDate", point["date"]))
        captured_day = datetime.fromisoformat(history["capturedAt"].replace("Z", "+00:00")).date()
        if day > as_of.date() or day > captured_day or fx_day > day or (day - fx_day).days > 7:
            raise ValueError("sesión histórica inválida")
        if dates and day <= dates[-1]:
            raise ValueError("histórico duplicado o desordenado")
        price = _number(point["adjustedClose"]) * _number(point["fxMxn"])
        if price <= 0:
            raise ValueError("precio inválido")
        if dates and not 4 <= (day - dates[-1]).days <= 10:
            dates, prices = [], []
        dates.append(day); prices.append(price)
    if len(prices) < 53 or (as_of.date() - dates[-1]).days > 14:
        return None
    returns = np.diff(prices) / np.array(prices[:-1])
    if np.any(np.abs(returns) > 5):
        return None
    wealth = np.array(prices) / prices[0]
    return {"observations": len(returns), "from": str(dates[0]), "to": str(dates[-1]),
            "annualizedVolatility": float(np.std(returns, ddof=1) * math.sqrt(52)),
            "maximumDrawdown": float(np.min(wealth / np.maximum.accumulate(wealth) - 1)),
            "cumulativeReturn": float(wealth[-1] - 1), "currency": "MXN"}


def analyze_stocks(context, as_of):
    if not isinstance(context, dict) or context.get("version") != 1 or len(context.get("candidates", [])) > 6:
        raise ValueError("contexto de acciones inválido")
    if datetime.fromisoformat(context["asOf"].replace("Z", "+00:00")) > as_of:
        raise ValueError("contexto futuro")
    result = {"context": deepcopy(context), "analyses": [], "caveat":
        "Investigación automática de exposición y calidad de datos; no es ranking de compra, pronóstico ni incorporación a tu cartera. La relación documentada no demuestra un contrato actual ni cuánto del cambio ya está descontado en el precio."}
    seen = set()
    for candidate in context["candidates"]:
        if candidate["symbol"] in seen:
            raise ValueError("emisor duplicado")
        seen.add(candidate["symbol"])
        research = candidate.get("facts")
        metrics, findings = fundamental_metrics(research, as_of) if research else ([], ["Fundamentales SEC pendientes; se conserva la hipótesis sin inventar cifras."])
        if candidate.get("history") and candidate["history"].get("symbol") != candidate["symbol"]:
            raise ValueError("histórico de otro emisor")
        statistics = stock_statistics(candidate.get("history"), as_of)
        analysis = {"symbol": candidate["symbol"], "status": "available" if metrics and statistics else ("partial" if research or statistics else "pending"),
                    "metrics": metrics, "findings": findings,
                    "questions": ["¿Qué pedido, segmento o exposición cuantificada conecta este evento con el emisor?",
                                  "¿La mejora potencial compensa costes, deuda, dilución y expectativas ya reflejadas en el precio?",
                                  "¿Qué dato próximo invalidaría la hipótesis y en qué documento se comprobará?"]}
        if research:
            if datetime.fromisoformat(research["capturedAt"].replace("Z", "+00:00")) > as_of:
                raise ValueError("fundamentales futuros")
            analysis["factId"] = research["id"]
        if statistics:
            analysis["statistics"] = statistics
        else:
            analysis["findings"].append("Estadística individual pendiente de 52 retornos semanales ajustados y recientes en MXN; no se infiere desde otra empresa.")
        analysis["findings"].extend(candidate.get("history", {}).get("warnings", [])[:5])
        analysis["findings"] = list(dict.fromkeys(analysis["findings"]))[:12]
        result["analyses"].append(analysis)
    # Full point-in-time price samples remain in the immutable input/export.
    for candidate in result["context"]["candidates"]:
        candidate.pop("history", None)
    return result
