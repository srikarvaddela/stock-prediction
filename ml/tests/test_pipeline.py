"""Synthetic fixtures test correctness, never reported as market performance."""

from contextlib import redirect_stderr, redirect_stdout
from datetime import date, timedelta
import io
import json
import math
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import joblib
import numpy as np

from ml.pipeline import complete_history, features_at, new_model, train
from ml.train import main


def history(length=240, flat=False):
    points = []
    for i in range(length):
        price = 100 if flat else 100 * math.exp(
            i * 0.001 + math.sin(i * 1.7) * 0.025 + math.cos(i * 0.31) * 0.04)
        points.append({"date": (date(2020, 1, 3) + timedelta(weeks=i)).isoformat(),
                       "close": price, "adjusted": price})
    return points


AS_OF = date(2030, 1, 1)


class PipelineTests(unittest.TestCase):
    def test_features_use_only_prior_prices(self):
        prices = history()
        before = features_at(prices, 100)
        prices[101]["adjusted"] *= 10
        np.testing.assert_array_equal(before, features_at(prices, 100))
        linear = [{"adjusted": math.exp(0.01 * i)} for i in range(13)]
        expected = [0.01, 0.04, 0.12,
                    math.log(linear[-1]["adjusted"] / np.mean([p["adjusted"] for p in linear[1:]])), 0]
        np.testing.assert_allclose(features_at(linear, 12), expected, atol=1e-14)

    def test_current_week_and_future_rows_are_excluded(self):
        prices = history()
        friday = date.fromisoformat(prices[-1]["date"])
        self.assertEqual(complete_history(prices, friday), prices[:-1])
        self.assertEqual(complete_history(prices, friday - timedelta(days=2)), prices[:-1])
        self.assertEqual(complete_history(prices, friday + timedelta(days=3)), prices)

    def test_invalid_data_is_rejected(self):
        for bad in (0, float("nan"), float("inf"), "100", True):
            prices = history()
            prices[30]["adjusted"] = bad
            with self.assertRaises(ValueError):
                complete_history(prices, AS_OF)
        for kind in ("duplicate", "gap", "date", "short", "sameweek"):
            prices = history()
            if kind == "duplicate":
                prices[20]["date"] = prices[19]["date"]
            elif kind == "gap":
                del prices[30:33]
            elif kind == "date":
                prices[20]["date"] = "2020-02-30"
            elif kind == "sameweek":
                prices[20]["date"] = (date.fromisoformat(prices[19]["date"]) + timedelta(days=1)).isoformat()
            else:
                prices = prices[:100]
            with self.assertRaises(ValueError, msg=kind):
                complete_history(prices, AS_OF)
        with self.assertRaises(ValueError):
            train(history(), AS_OF, 2)

    def test_flat_history_can_select_no_change(self):
        report, _ = train(history(flat=True), AS_OF)
        self.assertEqual(report["modelId"], "flat")
        self.assertEqual(report["mae"], 0)
        self.assertEqual(report["baselineMae"], 0)
        self.assertEqual((report["low"], report["estimate"], report["high"]), (100, 100, 100))

    def test_future_labels_cannot_change_ridge_predictions_or_scaling(self):
        # Force ridge so a constant baseline cannot hide scaling/fit leakage.
        with patch("ml.pipeline.CANDIDATES", ("ridge10",)):
            for horizon in (1, 4):
                prices = history()
                before, _ = train(prices, AS_OF, horizon)
                prices[-1]["adjusted"] *= 1.5
                after, _ = train(prices, AS_OF, horizon)
                self.assertEqual(before["backtest"][:-1], after["backtest"][:-1])
                self.assertEqual(before["backtest"][-1]["predictedReturn"], after["backtest"][-1]["predictedReturn"])
                self.assertNotEqual(before["backtest"][-1]["actualReturn"], after["backtest"][-1]["actualReturn"])
                self.assertLessEqual(before["validationThrough"], before["calibrationFrom"])
                self.assertLessEqual(before["calibrationThrough"], before["holdoutFrom"])
                for row in before["backtest"]:
                    self.assertLessEqual(row["trainingThrough"], row["origin"])
                    self.assertLess(row["origin"], row["date"])

    def test_model_selection_ignores_holdout_outcomes_and_metrics_are_correct(self):
        prices = history()
        before, _ = train(prices, AS_OF, 4)
        for i, point in enumerate(prices):
            if point["date"] > before["holdoutFrom"]:
                point["adjusted"] *= math.exp(i * 0.002)
        after, _ = train(prices, AS_OF, 4)
        self.assertEqual(before["candidates"], after["candidates"])
        self.assertEqual(before["modelId"], after["modelId"])
        rows = before["backtest"]
        self.assertEqual(len(rows), 52)
        self.assertAlmostEqual(before["mae"], sum(abs(r["predictedReturn"] - r["actualReturn"]) for r in rows) / 52)
        self.assertAlmostEqual(before["baselineMae"], sum(abs(r["actualReturn"]) for r in rows) / 52)
        self.assertLessEqual(before["low"], before["estimate"])
        self.assertLessEqual(before["estimate"], before["high"])
        self.assertTrue(before["stale"])

    def test_all_model_artifacts_round_trip(self):
        x = np.arange(200).reshape(40, 5) / 20
        y = np.sin(x[:, 0]) / 100
        with tempfile.TemporaryDirectory() as directory:
            for name in ("flat", "mean", "ridge10", "ridge100", "boost"):
                model = new_model(name).fit(x, y)
                path = Path(directory) / "trusted-local-model.joblib"
                joblib.dump(model, path)
                np.testing.assert_array_equal(model.predict(x), joblib.load(path).predict(x))

    def test_cli_exports_reproducible_reports_and_fails_missing_symbols(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "TEST.json").write_text(json.dumps({"symbol": "TEST", "prices": history()}), encoding="utf-8")
            args = ["--symbols", "TEST", "--horizons", "1", "--as-of", AS_OF.isoformat(),
                    "--input-dir", directory, "--output-dir", str(root / "output")]
            with redirect_stdout(io.StringIO()):
                self.assertEqual(main(args), 0)
            output = root / "output/TEST/1w"
            report = json.loads((output / "report.json").read_text(encoding="utf-8"))
            artifact = joblib.load(output / "model.joblib")
            predicted = artifact["model"].predict([report["latestFeatures"]])[0]
            self.assertAlmostEqual(math.expm1(predicted), report["expectedReturn"])
            self.assertEqual(len(report["dataset"]["sha256"]), 64)
            self.assertEqual(len((output / "backtest.csv").read_text().splitlines()), 53)
            with redirect_stdout(io.StringIO()):
                self.assertEqual(main(args), 0)
            self.assertEqual(report, json.loads((output / "report.json").read_text(encoding="utf-8")))
            with redirect_stderr(io.StringIO()):
                self.assertEqual(main(["--symbols", "MISSING", "--input-dir", directory]), 1)
                self.assertEqual(main(["--symbols", "../TEST", "--input-dir", directory]), 1)
            (root / "TEST.json").write_text(json.dumps({"symbol": "WRONG", "prices": history()}), encoding="utf-8")
            with redirect_stderr(io.StringIO()):
                self.assertEqual(main(args), 1)


if __name__ == "__main__":
    unittest.main()
