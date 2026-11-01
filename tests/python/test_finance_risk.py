import importlib.util
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location("finance_risk", Path(__file__).resolve().parents[2] / "scripts" / "finance-risk.py")
risk = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(risk)


class FinanceRiskReferenceTests(unittest.TestCase):
    def rows(self, values):
        return [{"date": (date(2026, 1, 1) + timedelta(days=i)).isoformat(), "value": str(v)} for i, v in enumerate(values)]

    def test_deposits_are_not_gains(self):
        self.assertEqual(risk.pnl("15000", ["10000", "5000"], []), Decimal("0"))
        self.assertEqual(risk.pnl("9000", ["10000"], ["1000"]), Decimal("0"))
        self.assertEqual(risk.pnl("10170", ["10000"], []), Decimal("170"))

    def test_currency_interaction_is_not_added_naively(self):
        self.assertEqual(risk.mxn_return("0.05", "-0.025"), Decimal("0.02375"))
        self.assertEqual(risk.mxn_return("-1", "0.2"), Decimal("-1"))

    def test_drawdown_uses_peak_not_previous_day(self):
        result = risk.report({"unitized_index": self.rows([100, 120, 90, 110])})
        self.assertEqual(Decimal(result["maximum_drawdown"]), Decimal("-0.25"))
        self.assertEqual(Decimal(result["total_return"]), Decimal("0.1"))
        self.assertIsNone(result["annualized_volatility"])
        self.assertEqual(result["status"], "insufficient-history")

    def test_no_false_correlations_without_history_or_variation(self):
        self.assertIsNone(risk.correlation([Decimal(0)] * 60, [Decimal(".1")] * 60))
        self.assertIsNone(risk.correlation([Decimal(".1")], [Decimal(".2")]))

    def test_aligned_correlation_and_volatility(self):
        values = [Decimal(100)]
        for i in range(60):
            values.append(values[-1] * (Decimal("1.01") if i % 2 else Decimal(".98")))
        data = self.rows(values)
        result = risk.report({"unitized_index": data, "benchmark": data})
        self.assertEqual(result["status"], "descriptive")
        self.assertEqual(Decimal(result["correlation"]), 1)
        self.assertGreater(Decimal(result["annualized_volatility"]), 0)

    def test_calendar_mismatch_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "fechas"):
            risk.report({"unitized_index": self.rows([100, 101]), "benchmark": [{"date": "2026-01-01", "value": "100"}, {"date": "2026-01-03", "value": "101"}]})

    def test_missing_nonfinite_duplicate_dates_and_floats_are_rejected(self):
        for invalid in [None, True, "NaN", "Infinity", 1.2, "not-a-number"]:
            data = self.rows([100, 101])
            data[-1]["value"] = invalid
            with self.assertRaises(ValueError):
                risk.report({"unitized_index": data})
        with self.assertRaises(ValueError):
            risk.report({"unitized_index": [{"date": "2026-02-30", "value": "100"}, {"date": "2026-03-01", "value": "102"}]})
        with self.assertRaises(ValueError):
            risk.report({"unitized_index": [{"date": "2026-01-01", "value": "100"}] * 2})

    def test_long_missing_period_not_annualized_as_daily(self):
        data = [{"date": (date(2020, 1, 1) + timedelta(days=30 * i)).isoformat(), "value": str(100 + i)} for i in range(61)]
        result = risk.report({"unitized_index": data})
        self.assertEqual(result["status"], "review-gaps")
        self.assertIsNone(result["annualized_volatility"])


if __name__ == "__main__":
    unittest.main()
