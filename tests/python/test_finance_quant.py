"""Synthetic public fixtures: no personal profile or market data."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest
from datetime import date, timedelta
from decimal import Decimal

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "finance_quant.py"


def fixture(n=80):
    end = date(2026, 10, 30)
    histories = []
    for symbol, growth in [("VT", 0.002), ("SGOV", 0.0007)]:
        points = []
        price = 100
        for i in range(n):
            # Both signs and shared FX variation make covariance nondegenerate.
            price *= 1 + growth + (0.014 if i % 4 == 0 else -0.004)
            points.append({"date": str(end - timedelta(weeks=n - i - 1)), "close": str(price),
                           "adjustedClose": str(price), "fxMxn": str(18 + (i % 5) * .05)})
        histories.append({"id": symbol, "symbol": symbol, "provider": "synthetic",
                          "currency": "USD", "adjusted": True, "capturedAt": "2026-10-31T00:00:00Z",
                          "sourceUrl": "https://example.test/history", "points": points, "warnings": []})
    return {"version": 1, "inputHash": "synthetic-hash", "asOf": "2026-11-01T12:00:00Z",
            "profile": {"id": "synthetic", "version": 1, "initialCapitalMxn": "12345.67",
                        "monthlyContributionMxn": "234.56", "horizonYears": 5,
                        "riskPreference": "unconfirmed", "reserveExcluded": True,
                        "broker": {"name": "unknown", "verified": False}, "updatedAt": "2026-10-31T00:00:00Z"},
            "assets": [], "histories": histories, "references": [],
            "portfolio": {"hasMovements": False, "complete": True, "cashMxn": "0", "positions": [],
                          "movementHash": "none"}, "news": [], "dataWarnings": []}


def volatile_fixture(equity=.08, treasury=.0005):
    value = fixture()
    for history, amplitude in zip(value["histories"], [equity, treasury]):
        price = 100.0
        for i, point in enumerate(history["points"]):
            price *= 1 + (amplitude if i % 2 == 0 else -amplitude)
            point.update(close=str(price), adjustedClose=str(price), fxMxn="18")
    return value


class QuantTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("finance_quant", SCRIPT)
        cls.engine = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.engine)

    def report(self, value=None):
        return self.engine.generate_report(value or fixture())

    def test_no_history_keeps_visible_provisional_budget_and_no_fake_metrics(self):
        value = fixture(); value["histories"] = []
        result = self.report(value)
        self.assertEqual(result["status"], "insufficient-data")
        self.assertEqual(len(result["initial"]["items"]), 3)
        self.assertAlmostEqual(sum(i["weight"] for i in result["initial"]["items"]), 1)
        self.assertNotIn("annualizedVolatility", result["risk"])
        self.assertEqual(result["projections"], [])
        self.assertTrue(all("quantity" not in x for x in result["initial"]["items"]))
        self.assertIn("provisional", " ".join(result["reasons"]).lower())

    def test_enough_history_uses_ledoit_wolf_and_is_deterministic(self):
        result = self.report()
        self.assertEqual(result, self.report())
        self.assertEqual(result["risk"]["observations"], 79)
        self.assertGreater(result["risk"]["annualizedVolatility"], 0)
        self.assertAlmostEqual(sum(x["share"] for x in result["risk"]["riskContributions"]), 1)
        self.assertEqual(len(result["risk"]["correlations"]), 1)
        self.assertIn("Ledoit", result["risk"]["covarianceMethod"])
        self.assertLessEqual(result["risk"]["maximumDrawdown"], 0)
        self.assertEqual(result["status"], "provisional")
        self.assertEqual(result["action"], "review-risk")
        self.assertEqual(len(result["projections"]), 3)

    def test_allocation_uses_covariance_when_anchor_exceeds_risk_limit(self):
        value = volatile_fixture(); value["profile"]["riskPreference"] = "balanced"
        result = self.report(value)
        self.assertLess(result["initial"]["items"][0]["weight"], .55)
        self.assertLessEqual(result["risk"]["annualizedVolatility"], .18 + 1e-12)
        self.assertAlmostEqual(sum(x["weight"] for x in result["initial"]["items"]), 1)
        self.assertTrue(any("volatilidad" in x.lower() and "ancla" in x.lower() for x in result["reasons"]))
        self.assertEqual(result, self.report(value))

    def test_low_risk_anchor_passes_and_selection_explains_limits(self):
        result = self.report()
        self.assertEqual([x["weight"] for x in result["initial"]["items"]], [.35, .4, .25])
        self.assertTrue(any("ancla cumple" in x.lower() for x in result["reasons"]))
        self.assertTrue(any("12%" in x and "75%" in x for x in result["reasons"]))

    def test_joint_correlation_changes_selection_with_same_marginal_risk(self):
        positive = volatile_fixture(.04, .04); positive["profile"]["riskPreference"] = "growth"
        negative = volatile_fixture(.04, -.04); negative["profile"]["riskPreference"] = "growth"
        high = self.report(positive); hedged = self.report(negative)
        self.assertEqual([x["weight"] for x in hedged["initial"]["items"]], [.75, .2, .05])
        self.assertNotEqual([x["weight"] for x in high["initial"]["items"]], [.75, .2, .05])
        self.assertLessEqual(high["risk"]["annualizedVolatility"], .24 + 1e-12)
        self.assertGreater(high["risk"]["correlations"][0]["value"], .99)
        self.assertLess(hedged["risk"]["correlations"][0]["value"], -.99)

    def test_short_horizon_limits_and_unconfirmed_are_exploratory(self):
        value = fixture(); value["profile"]["horizonYears"] = 2
        result = self.report(value)
        items = result["initial"]["items"]
        self.assertLessEqual(items[0]["weight"], .2)
        self.assertGreaterEqual(items[2]["weight"], .5)
        self.assertLessEqual(sum(x["weight"] for x in items[:2]), .5)
        self.assertEqual(result["status"], "provisional")
        self.assertEqual(result["action"], "review-risk")
        self.assertTrue(any("provisional" in x for x in result["reasons"]))
        self.assertTrue(any("horizonte" in x.lower() for x in result["reasons"]))
        value["histories"] = []
        no_data = self.report(value)
        self.assertEqual([x["weight"] for x in no_data["initial"]["items"]], [.35, .4, .25])
        self.assertTrue(any("pendiente" in x.lower() and "límites" in x.lower() for x in no_data["reasons"]))

    def test_no_feasible_allocation_waits_without_quantities_or_projection(self):
        value = volatile_fixture(.5, .5); value["profile"]["riskPreference"] = "balanced"
        value["profile"]["broker"] = {"name": "x", "verified": True, "fractional": True,
                                         "feePercent": 0, "fxSpreadPercent": 0}
        value["references"] = [{"symbol": s, "price": "100", "currency": "USD", "fxMxn": "18",
                                 "session": "2026-10-30", "capturedAt": "2026-10-31T00:00:00Z",
                                 "sourceUrl": "https://example.test/ref"} for s in ["VT", "SGOV"]]
        result = self.report(value)
        self.assertEqual(result["action"], "wait")
        self.assertEqual(result["status"], "review")
        self.assertTrue(all("quantity" not in x for x in result["initial"]["items"]))
        self.assertTrue(all("quantity" not in x and "price" not in x and "priceSession" not in x
                            for part in ["initial", "contribution"] for x in result[part]["items"]))
        self.assertEqual(result["projections"], [])
        self.assertEqual(result["contribution"]["items"][-1]["weight"], 1)
        self.assertTrue(any("ninguna combinación" in x.lower() for x in result["reasons"]))

    def test_minimum_returns_and_gap_never_zero_filled(self):
        self.assertNotIn("annualizedVolatility", self.report(fixture(52))["risk"])
        self.assertIn("annualizedVolatility", self.report(fixture(53))["risk"])
        value = fixture(); value["histories"][0]["points"].pop(-20)
        result = self.report(value)
        self.assertEqual(result["risk"]["observations"], 18)
        self.assertNotIn("annualizedVolatility", result["risk"])

    def test_adjusted_price_and_fx_both_drive_returns(self):
        value = fixture(54)
        for history in value["histories"]:
            for i, point in enumerate(history["points"]):
                point.update(close="500", adjustedClose="100", fxMxn=str(10 * 1.001 ** i))
        result = self.report(value)
        expected = (1 + .75 * .001) ** 53 - 1
        self.assertAlmostEqual(result["risk"]["historicalReturn"], expected, places=9)

    def test_future_nonfinite_and_invalid_amount_rejected(self):
        mutations = [lambda x: x["profile"].update(initialCapitalMxn="NaN"),
                     lambda x: x["profile"].update(monthlyContributionMxn="-1"),
                     lambda x: x["profile"].update(horizonYears=100),
                     lambda x: x["histories"][0]["points"][0].update(date="2027-01-01"),
                     lambda x: x["histories"][0]["points"][0].update(fxMxn="Infinity"),
                     lambda x: x["profile"]["broker"].update(feePercent=float("nan")),
                     lambda x: x["profile"].update(initialCapitalMxn="0.001"),
                     lambda x: x["histories"][0]["points"][0].update(fxMxn="1e-999"),
                     lambda x: x.update(profile=[]),
                     lambda x: x.update(portfolio=[]),
                     lambda x: x.update(histories=[None]),
                     lambda x: x.update(dataWarnings="not-a-list")]
        for mutate in mutations:
            value = fixture(); mutate(value)
            with self.subTest(value=value["profile"]):
                with self.assertRaises(ValueError): self.report(value)

    def test_budget_conservation_and_verified_cost_quantity(self):
        value = fixture()
        value["profile"]["broker"] = {"name": "synthetic", "verified": True, "fractional": True,
                                         "feePercent": 1, "fxSpreadPercent": 2}
        value["references"] = [{"symbol": s, "price": "100", "currency": "USD", "fxMxn": "18",
                                 "session": "2026-10-30", "capturedAt": "2026-10-31T00:00:00Z",
                                 "sourceUrl": "https://example.test/ref"} for s in ["VT", "SGOV"]]
        result = self.report(value)
        for part in ["initial", "contribution"]:
            data = result[part]
            total = sum(Decimal(x["amountMxn"]) for x in data["items"]) + Decimal(data["cashRemainderMxn"])
            self.assertEqual(total, Decimal(data["budgetMxn"]))
            item = data["items"][0]
            self.assertLessEqual(Decimal(item["quantity"]) * 1800 * Decimal("1.03"), Decimal(item["amountMxn"]))
            self.assertIn("coste", item["reason"])

    def test_money_contract_rejects_json_numbers_instead_of_losing_cents(self):
        for section, key in [("profile", "initialCapitalMxn"), ("profile", "monthlyContributionMxn"),
                             ("portfolio", "cashMxn"), ("portfolio", "valueMxn")]:
            value = fixture(); value[section][key] = 0.29
            with self.subTest(section=section, key=key):
                with self.assertRaises(ValueError): self.report(value)
        value = fixture(); value["profile"]["initialCapitalMxn"] = "0.29"
        report = self.report(value)
        total = sum(Decimal(x["amountMxn"]) for x in report["initial"]["items"]) + Decimal(report["initial"]["cashRemainderMxn"])
        self.assertEqual(total, Decimal("0.29"))

    def test_sized_cost_reason_uses_actual_gross_principal_and_cost(self):
        value = fixture(); value["profile"].update(initialCapitalMxn="1000.00", monthlyContributionMxn="1000.00")
        value["profile"]["broker"] = {"name": "synthetic", "verified": True, "fractional": False,
                                         "feePercent": 1, "fxSpreadPercent": 2}
        value["references"] = [{"symbol": s, "price": "100", "currency": "USD", "fxMxn": "18",
                                 "session": "2026-10-30", "capturedAt": "2026-10-31T00:00:00Z",
                                 "sourceUrl": "https://example.test/ref"} for s in ["VT", "SGOV"]]
        for capital, expected in [("1000.00", ("0", "0.00", "0.00", "0.00")),
                                  ("10000.00", ("1", "1854.00", "1800.00", "54.00"))]:
            value["profile"].update(initialCapitalMxn=capital, monthlyContributionMxn=capital)
            result = self.report(value)
            for part in ["initial", "contribution"]:
                item = result[part]["items"][0]
                quantity, gross, principal, cost = expected
                self.assertEqual(item["quantity"], quantity)
                self.assertEqual(item["amountMxn"], gross)
                self.assertIn(f"desembolso bruto orientativo de {gross} MXN", item["reason"])
                self.assertIn(f"principal de {principal} MXN", item["reason"])
                self.assertIn(f"coste verificado estimado de {cost} MXN", item["reason"])
                self.assertNotIn("capital comprable hasta", item["reason"])

    def test_unknown_or_stale_reference_never_produces_quantities(self):
        value = fixture(); value["profile"]["broker"] = {"name": "x", "verified": True, "fractional": True}
        value["references"] = [{"symbol": "VT", "price": "100", "currency": "USD", "fxMxn": "18",
                                 "session": "2026-09-01", "capturedAt": "2026-09-01T00:00:00Z",
                                 "sourceUrl": "https://example.test"}]
        result = self.report(value)
        self.assertNotIn("quantity", result["initial"]["items"][0])
        self.assertTrue(any("antigua" in x for x in result["warnings"]))

    def test_current_price_and_fx_sessions_are_independent_known_at_report_cutoff(self):
        value = fixture()
        value["references"] = [{"symbol": "VT", "price": "100", "currency": "USD", "fxMxn": "19",
                                 "session": "2026-10-30", "fxSession": "2026-11-01",
                                 "capturedAt": "2026-11-01T11:00:00Z", "sourceUrl": "https://example.test/ref",
                                 "fxSourceUrl": "https://example.test/fx"}]
        unknown = self.report(value)
        self.assertNotIn("quantity", unknown["initial"]["items"][0])
        self.assertTrue(any("fechas distintas" in w and "2026-10-30" in w and "2026-11-01" in w for w in unknown["warnings"]))
        value["profile"]["broker"] = {"name": "x", "verified": True, "fractional": True,
                                         "feePercent": 1, "fxSpreadPercent": 2}
        item = self.report(value)["initial"]["items"][0]
        self.assertGreater(Decimal(item["quantity"]), 0)
        self.assertLessEqual(Decimal(item["quantity"]) * 1900 * Decimal("1.03"), Decimal(item["amountMxn"]))
        self.assertIn("FX de referencia del 2026-11-01", item["reason"])
        value["references"][0]["fxSession"] = "2026-11-02"
        with self.assertRaises(ValueError): self.report(value)
        value["references"][0].update(fxSession="2026-11-01", capturedAt="2026-10-31T11:00:00Z")
        with self.assertRaises(ValueError): self.report(value)
        value["references"][0].update(fxSession="2026-10-20", capturedAt="2026-11-01T11:00:00Z")
        old_fx = self.report(value)
        self.assertNotIn("quantity", old_fx["initial"]["items"][0])

    def test_whole_units_conserve_tiny_budget_and_keep_metadata(self):
        value = fixture(); value["profile"]["initialCapitalMxn"] = "0.03"
        value["assets"] = [{"symbol": "VT", "name": "Nombre del catálogo verificado", "role": "global-equity",
                            "currency": "USD", "sourceUrl": "https://example.test/catalog"}]
        value["profile"]["broker"] = {"name": "x", "verified": True, "fractional": False,
                                         "feePercent": 0, "fxSpreadPercent": 0}
        value["references"] = [{"symbol": "VT", "price": "100", "currency": "USD", "fxMxn": "18",
                                 "session": "2026-10-30", "capturedAt": "2026-10-31T00:00:00Z",
                                 "sourceUrl": "https://example.test/ref"}]
        result = self.report(value)
        item = result["initial"]["items"][0]
        self.assertEqual(item["quantity"], "0")
        self.assertEqual(item["name"], value["assets"][0]["name"])
        self.assertEqual(item["sourceUrl"], value["assets"][0]["sourceUrl"])
        total = sum(Decimal(x["amountMxn"]) for x in result["initial"]["items"]) + Decimal(result["initial"]["cashRemainderMxn"])
        self.assertEqual(total, Decimal("0.03"))

    def test_future_reference_news_duplicates_and_unadjusted_history(self):
        for field in ["session", "capturedAt"]:
            value = fixture()
            value["references"] = [{"symbol": "VT", "price": "100", "currency": "USD", "fxMxn": "18",
                                     "session": "2026-10-30", "capturedAt": "2026-10-31T00:00:00Z",
                                     "sourceUrl": "https://example.test/ref"}]
            value["references"][0][field] = "2027-01-01" if field == "session" else "2027-01-01T00:00:00Z"
            with self.assertRaises(ValueError): self.report(value)
        value = fixture(); value["histories"][0]["points"].append(value["histories"][0]["points"][0])
        with self.assertRaises(ValueError): self.report(value)
        value = fixture(); value["histories"][0]["adjusted"] = False
        self.assertEqual(self.report(value)["risk"]["observations"], 0)
        value = fixture(); value["news"] = [{"publishedAt": "2027-01-01T00:00:00Z"}]
        with self.assertRaises(ValueError): self.report(value)

    def test_old_history_omits_projections_and_marks_age(self):
        value = fixture()
        for h in value["histories"]:
            for p in h["points"]: p["date"] = str(date.fromisoformat(p["date"]) - timedelta(weeks=6))
        result = self.report(value)
        self.assertEqual(result["status"], "insufficient-data")
        self.assertEqual(result["projections"], [])
        self.assertTrue(any("antiguos" in x for x in result["warnings"]))

    def test_actual_holdings_control_action_and_contribution_not_proposal_positions(self):
        value = fixture(); value["profile"]["riskPreference"] = "balanced"
        value["portfolio"].update(hasMovements=True, valueMxn="10000", cashMxn="1000", positions=[
            {"symbol": "VT", "valueMxn": "9000", "quantity": "1"}])
        result = self.report(value)
        self.assertEqual(result["action"], "contribute")
        self.assertEqual(result["contribution"]["items"][0]["amountMxn"], "0.00")
        self.assertIn("real", result["contribution"]["reason"])
        value["portfolio"].update(complete=False)
        self.assertEqual(self.report(value)["action"], "wait")

    def test_unknown_holdings_and_zero_portfolio(self):
        value = fixture(); value["profile"]["riskPreference"] = "balanced"
        value["portfolio"].update(hasMovements=True, valueMxn="100", positions=[
            {"symbol": "UNKNOWN", "valueMxn": "100", "quantity": "1"}])
        self.assertEqual(self.report(value)["action"], "wait")
        value["portfolio"].update(valueMxn="0", positions=[])
        result = self.report(value)
        self.assertEqual(result["action"], "contribute")
        self.assertNotIn("actualWeights", result)

    def test_fully_withdrawn_account_does_not_resurrect_initial_capital(self):
        value = fixture(); value["profile"]["riskPreference"] = "balanced"
        value["portfolio"].update(hasMovements=True, complete=True, valueMxn="0.00", cashMxn="0.00", positions=[])
        for history in value["histories"]:
            for point in history["points"]: point.update(adjustedClose="100", fxMxn="18")
        result = self.report(value)
        self.assertEqual(result["action"], "contribute")
        self.assertTrue(all(x["endValueMxn"] == "0.00" for x in result["scenarios"]))
        self.assertEqual(result["initial"]["budgetMxn"], value["profile"]["initialCapitalMxn"])
        for projection in result["projections"]:
            expected = Decimal(value["profile"]["monthlyContributionMxn"]) * 12 * projection["years"]
            self.assertEqual(Decimal(projection["medianMxn"]), expected)
            self.assertIn("Parte de 0.00 MXN", projection["caveat"])
        value["profile"]["monthlyContributionMxn"] = "0.00"
        empty = self.report(value)
        self.assertTrue(all(p["medianMxn"] == "0.00" for p in empty["projections"]))

    def test_engine_version_is_shared_and_rejects_mismatched_lineage(self):
        version_path = SCRIPT.parents[1] / "src/features/finance/automatic-engine-version.json"
        version = json.loads(version_path.read_text())["version"]
        value = fixture(); value["engineVersion"] = version
        self.assertEqual(self.report(value)["engineVersion"], version)
        value["engineVersion"] = "automatic-quant-0.0.0"
        with self.assertRaises(ValueError): self.report(value)
        value["engineVersion"] = None
        with self.assertRaises(ValueError): self.report(value)

    def test_maintain_actual_target_and_unknown_values_do_not_create_math(self):
        value = fixture(); value["profile"]["riskPreference"] = "balanced"
        value["portfolio"].update(hasMovements=True, valueMxn="10000", cashMxn="1000", positions=[
            {"symbol": "VT", "valueMxn": "5500", "quantity": "1"},
            {"symbol": "SGOV", "valueMxn": "3500", "quantity": "1"}])
        self.assertEqual(self.report(value)["action"], "maintain")
        value["portfolio"]["positions"][0].pop("valueMxn")
        result = self.report(value)
        self.assertEqual(result["action"], "wait")
        self.assertEqual(result["projections"], [])
        self.assertEqual(result["contribution"]["items"][-1]["amountMxn"], value["profile"]["monthlyContributionMxn"])

    def test_adjusted_only_fx_dates_must_intersect_exactly(self):
        value = fixture()
        for p in value["histories"][1]["points"]:
            p["date"] = str(date.fromisoformat(p["date"]) - timedelta(days=1))
        result = self.report(value)
        self.assertEqual(result["risk"]["observations"], 0)
        self.assertNotIn("historicalReturn", result["risk"])

    def test_fx_metadata_never_uses_future_or_very_old_fixing(self):
        for days in [-1, 8]:
            value = fixture(); point = value["histories"][0]["points"][0]
            point["fxDate"] = str(date.fromisoformat(point["date"]) - timedelta(days=days))
            with self.assertRaises(ValueError): self.report(value)
        value = fixture()
        for p in value["histories"][0]["points"]:
            p["fxDate"] = str(date.fromisoformat(p["date"]) - timedelta(days=1))
        self.assertTrue(any("FX de referencia anterior" in w for w in self.report(value)["warnings"]))

    def test_zero_budget_zero_variance_and_no_fabricated_return(self):
        value = fixture(); value["profile"].update(initialCapitalMxn="0.00", monthlyContributionMxn="0.00")
        for h in value["histories"]:
            for p in h["points"]: p.update(adjustedClose="100", fxMxn="18")
        result = self.report(value)
        self.assertEqual(result["risk"]["annualizedVolatility"], 0)
        self.assertEqual(result["risk"]["riskContributions"], [])
        self.assertEqual(result["risk"]["correlations"], [])
        self.assertTrue(all(x["medianMxn"] == "0.00" for x in result["projections"]))
        self.assertEqual(sum(Decimal(x["amountMxn"]) for x in result["initial"]["items"]), 0)

    def test_projection_contributions_are_cashflows_not_reported_pnl(self):
        value = fixture()
        for h in value["histories"]:
            for p in h["points"]: p.update(adjustedClose="100", fxMxn="18")
        result = self.report(value)
        for p in result["projections"]:
            expected = Decimal(value["profile"]["initialCapitalMxn"]) + Decimal(value["profile"]["monthlyContributionMxn"]) * 12 * p["years"]
            self.assertEqual(Decimal(p["medianMxn"]), expected)
        self.assertEqual(result["risk"]["historicalReturn"], 0)

    def test_news_is_bounded_dated_conditional_and_does_not_change_weights(self):
        value = fixture()
        for i in range(12):
            value["news"].append({"id": str(i), "title": "Tasas y empresas", "url": "https://example.test/" + str(i),
                "sourceName": "Synthetic", "publishedAt": "2026-10-31T12:00:00Z", "eventKind": "macro"})
        result = self.report(value)
        self.assertEqual(len(result["news"]), 8)
        self.assertTrue(all("Si " in x["mechanism"] for x in result["news"]))
        self.assertEqual([x["weight"] for x in result["initial"]["items"]], [x["weight"] for x in self.report()["initial"]["items"]])
        self.assertTrue(any("USD" in x for x in result["warnings"]))

    def test_cli_rejects_nan_and_emits_only_json_for_valid_input(self):
        result = subprocess.run([sys.executable, str(SCRIPT)], input=json.dumps(fixture()), text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["inputHash"], "synthetic-hash")
        result = subprocess.run([sys.executable, str(SCRIPT)], input='{"version": NaN}', text=True, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")


if __name__ == "__main__": unittest.main()
