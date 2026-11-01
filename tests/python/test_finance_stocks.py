import sys
import unittest
from pathlib import Path
from datetime import datetime, timezone, date, timedelta
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from finance_stocks import fundamental_metrics, analyze_stocks, stock_statistics
from finance_diagnostics import temporal_risk_check

NOW = datetime(2026, 11, 1, 12, tzinfo=timezone.utc)


def fact(label, value, start="2026-04-01", end="2026-06-30", accession="synthetic-q2"):
    return {"label": label, "value": value, "unit": "USD", "start": start, "end": end,
            "filed": "2026-08-01", "accession": accession, "form": "10-Q", "url": "https://example.com/report"}


def research():
    return {"id": "synthetic-facts", "instrumentId": "synthetic-issuer", "source": "Fixture", "capturedAt": NOW.isoformat(), "warnings": [],
            "facts": [fact("Ingresos · trimestre", 100), fact("Resultado operativo · trimestre", 20),
                      fact("Resultado neto · trimestre", 10), fact("Flujo operativo · trimestre", 15),
                      fact("Inversión en propiedad y equipo · trimestre", 30)],
            "comparisonFacts": [fact("Ingresos · trimestre", 80, "2025-04-01", "2025-06-30", "synthetic-prior")]}


class StocksTest(unittest.TestCase):
    def test_margins_yoy_and_cash_preserve_period_and_source_indexes(self):
        metrics, findings = fundamental_metrics(research(), NOW)
        values = {m["key"]: m for m in metrics}
        self.assertEqual(values["operating-margin · trimestre"]["value"], .2)
        self.assertEqual(values["revenue-yoy · trimestre"]["value"], .25)
        self.assertEqual(values["fcf-proxy · trimestre"]["value"], -15)
        self.assertEqual(values["revenue-yoy · trimestre"]["factIndexes"], [0, 5])
        self.assertTrue(any("negativo" in f for f in findings))

    def test_never_mixes_periods_currency_or_restated_accession_for_margin(self):
        for key, value in [("start", "2026-01-01"), ("unit", "EUR"), ("accession", "different")]:
            source = research(); source["facts"][1][key] = value
            metrics, _ = fundamental_metrics(source, NOW)
            self.assertFalse(any(m["key"].startswith("operating-margin") for m in metrics))

    def test_missing_revenue_is_not_zero_and_negative_base_has_no_growth(self):
        source = research(); source["facts"][0]["value"] = 0
        metrics, _ = fundamental_metrics(source, NOW)
        self.assertTrue(all(m["key"].startswith("fcf-proxy") for m in metrics))
        source = research(); source["comparisonFacts"][0]["value"] = -1
        metrics, _ = fundamental_metrics(source, NOW)
        self.assertFalse(any(m["key"].startswith("revenue-yoy") for m in metrics))

    def test_future_publication_and_infinity_are_rejected(self):
        for key, value in [("filed", "2026-11-02"), ("value", float("inf"))]:
            source = research(); source["facts"][0][key] = value
            with self.assertRaises(ValueError): fundamental_metrics(source, NOW)

    def test_revenue_yoy_needs_comparable_duration_not_ytd(self):
        source = research(); source["comparisonFacts"][0]["start"] = "2025-01-01"
        metrics, _ = fundamental_metrics(source, NOW)
        self.assertFalse(any(m["key"].startswith("revenue-yoy") for m in metrics))

    def test_provider_observation_without_start_can_have_margins_but_not_yoy(self):
        source = research()
        for f in source["facts"] + source["comparisonFacts"]: f.pop("start"); f["filedKind"] = "observed"
        metrics, _ = fundamental_metrics(source, NOW)
        self.assertTrue(any(m["key"].startswith("operating-margin") for m in metrics))
        self.assertFalse(any(m["key"].startswith("revenue-yoy") for m in metrics))

    def history(self, count=80):
        end = date(2026, 10, 30)
        return {"symbol": "SYNTH", "currency": "USD", "adjusted": True, "capturedAt": NOW.isoformat(),
                "points": [{"date": str(end - timedelta(weeks=count - i - 1)), "adjustedClose": str(100 + i), "fxMxn": "18"} for i in range(count)]}

    def test_individual_history_does_not_borrow_another_company_or_fill_gaps(self):
        history = self.history()
        stats = stock_statistics(history, NOW)
        self.assertEqual(stats["observations"], 79)
        self.assertAlmostEqual(stats["cumulativeReturn"], .79)
        self.assertEqual(stats["maximumDrawdown"], 0)
        self.assertIsNone(stock_statistics(self.history(52), NOW))
        del history["points"][60]
        self.assertIsNone(stock_statistics(history, NOW))

    def test_individual_fx_future_and_duplicate_dates_are_rejected(self):
        for change in ["fx", "duplicate"]:
            history = self.history()
            if change == "fx": history["points"][-1]["fxDate"] = "2026-10-31"
            else: history["points"][-1]["date"] = history["points"][-2]["date"]
            with self.assertRaises(ValueError): stock_statistics(history, NOW)

    def test_history_cannot_contain_information_after_its_capture(self):
        history = self.history(); history["capturedAt"] = "2025-01-01T00:00:00Z"
        with self.assertRaises(ValueError): stock_statistics(history, NOW)

    def test_stock_history_identity_is_verified_before_calculation(self):
        context = {"version": 1, "asOf": NOW.isoformat(), "candidates": [{"symbol": "OTHER", "history": self.history()}]}
        with self.assertRaises(ValueError): analyze_stocks(context, NOW)

    def test_output_preserves_facts_and_links_but_freezes_history_only_in_input(self):
        candidate = {"symbol": "SYNTH", "name": "Synthetic", "facts": research(), "history": self.history(), "links": [], "events": []}
        context = {"version": 1, "asOf": NOW.isoformat(), "candidates": [candidate], "warnings": []}
        result = analyze_stocks(context, NOW)
        self.assertNotIn("history", result["context"]["candidates"][0])
        self.assertIn("history", context["candidates"][0])
        self.assertEqual(result["analyses"][0]["status"], "available")
        self.assertEqual(result["context"]["candidates"][0]["facts"], research())

    def test_risk_diagnostic_only_passes_past_to_selector(self):
        count = 144; dates = [date(2026, 10, 30) - timedelta(weeks=count - i) for i in range(count + 1)]
        returns = np.array([[.01 if i % 2 else -.005, .001] for i in range(count)])
        seen = []
        def selector(profile, past_dates, past_returns, cutoff):
            seen.append(len(past_returns))
            self.assertEqual(len(past_dates), len(past_returns) + 1)
            self.assertEqual(past_dates[-1], cutoff.date())
            np.testing.assert_array_equal(past_returns, returns[:len(past_returns)])
            return np.array([.35, .4, .25]), "feasible", []
        result = temporal_risk_check({}, dates, returns, selector, [.35, .4, .25])
        self.assertEqual(seen, [104, 117, 130])
        self.assertEqual(result["folds"], 3)
        self.assertEqual(result["attemptedFolds"], 3)
        self.assertEqual(result["infeasibleFolds"], 0)
        self.assertAlmostEqual(result["realizedVolatility"], result["baselineRealizedVolatility"])
        self.assertIn("No es evaluación prospectiva", result["caveat"])

    def test_temporal_diagnostic_discloses_abstentions_even_when_all_infeasible(self):
        count = 130; dates = [date(2026, 10, 30) - timedelta(weeks=count - i) for i in range(count + 1)]
        returns = np.zeros((count, 2))
        def selector(*args): return np.array([.35, .4, .25]), "infeasible", []
        result = temporal_risk_check({}, dates, returns, selector, [.35, .4, .25])
        self.assertEqual(result["attemptedFolds"], 2)
        self.assertEqual(result["infeasibleFolds"], 2)
        self.assertEqual(result["folds"], 0)
        self.assertNotIn("realizedVolatility", result)


if __name__ == "__main__": unittest.main()
