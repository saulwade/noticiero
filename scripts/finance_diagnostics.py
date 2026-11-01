"""Expanding, strictly chronological risk diagnostic. Not a trading backtest."""
import math
import numpy as np
from sklearn.covariance import LedoitWolf


def temporal_risk_check(profile, dates, returns, selector, baseline):
    train, test = 104, 13
    if len(returns) < train + test:
        return None
    predicted, realized, reference, breaches, attempted, infeasible = [], [], [], 0, 0, 0
    for end in range(train, len(returns) - test + 1, test):
        past, future = returns[:end], returns[end:end + test]
        # Pass only dates and returns observed at the training boundary.
        from datetime import datetime, timezone
        cutoff = datetime.combine(dates[end], datetime.min.time(), tzinfo=timezone.utc)
        attempted += 1
        weights, state, _ = selector(profile, dates[:end + 1], past, cutoff)
        if state != "feasible":
            infeasible += 1
            continue
        covariance = LedoitWolf().fit(past).covariance_ * 52
        estimate = math.sqrt(max(0., float(weights[:2] @ covariance @ weights[:2])))
        actual = float(np.std(future @ weights[:2], ddof=1) * math.sqrt(52))
        base = float(np.std(future @ np.array(baseline[:2]), ddof=1) * math.sqrt(52))
        predicted.append(estimate); realized.append(actual); reference.append(base)
        breaches += int(actual > estimate)
    result = {"method": "Ventana creciente: 104 semanas iniciales, bloques siguientes de 13 semanas sin solapamiento",
            "folds": len(predicted), "attemptedFolds": attempted, "infeasibleFolds": infeasible, "trainingWeeks": train, "testWeeks": test,
            "breaches": breaches,
            "caveat": "Diagnóstico retrospectivo de riesgo frente al ancla fija del perfil; las métricas excluyen ventanas donde el modelo se abstuvo por falta de combinación factible. Parámetros elegidos después de existir la historia, con sesgo de selección del universo. No es evaluación prospectiva independiente ni prueba de rentabilidad, calibración o ventaja predictiva. No incluye rotación, costes, impuestos ni compara retorno neto; los bloques de 13 semanas son muestras pequeñas."}
    if predicted:
        result.update(estimatedVolatility=float(np.mean(predicted)), realizedVolatility=float(np.mean(realized)), baselineRealizedVolatility=float(np.mean(reference)))
    return result
