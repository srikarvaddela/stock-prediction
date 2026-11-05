"""Train and evaluate weekly return models without using future labels."""

from datetime import date, timedelta
import math

import numpy as np
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

VERSION = "python-research-1.0.0"
FEATURES = [
    "1-week momentum", "4-week momentum", "12-week momentum",
    "Distance from moving average", "Return volatility",
]
CANDIDATES = ("flat", "mean", "ridge10", "ridge100", "boost")


def features_at(prices, index):
    """Only values at or before index are used; order matches the website."""
    if index < 12 or index >= len(prices):
        raise ValueError("Features need 12 preceding weeks.")
    past = np.asarray([p["adjusted"] for p in prices[index - 12:index + 1]], dtype=float)
    returns = np.log(past[1:] / past[:-1])
    return np.array([
        returns[-1], math.log(past[-1] / past[-5]),
        math.log(past[-1] / past[0]), math.log(past[-1] / past[1:].mean()),
        returns.std(),
    ])


def complete_history(prices, as_of):
    """Keep at most 320 completed weeks; reject malformed or discontinuous data."""
    if not isinstance(prices, list):
        raise ValueError("History must be a list of weekly observations.")
    parsed = []
    previous = None
    for point in prices:
        try:
            day = date.fromisoformat(point["date"])
            if day.isoformat() != point["date"]:
                raise ValueError("Dates must use YYYY-MM-DD.")
            for field in ("close", "adjusted"):
                value = point[field]
                if isinstance(value, bool) or not isinstance(value, (int, float)):
                    raise ValueError("Prices must be numeric.")
                if not math.isfinite(value) or value <= 0:
                    raise ValueError("Prices must be finite and positive.")
        except (KeyError, TypeError) as exc:
            raise ValueError("Each observation needs a date, close, and adjusted price.") from exc
        if previous and (
            day <= previous
            or day - timedelta(days=day.weekday()) == previous - timedelta(days=previous.weekday())
        ):
            raise ValueError("History must be chronological with one observation per week.")
        parsed.append(day)
        previous = day
    monday = as_of - timedelta(days=as_of.weekday())
    history = [p for p, day in zip(prices, parsed) if day < monday][-320:]
    if len(history) < 180:
        raise ValueError("At least 180 completed weekly observations are required.")
    if any(
        (date.fromisoformat(b["date"]) - date.fromisoformat(a["date"])).days > 10
        for a, b in zip(history, history[1:])
    ):
        raise ValueError("History contains a gap longer than ten days.")
    return history


def new_model(name):
    if name == "flat":
        return DummyRegressor(strategy="constant", constant=0.0)
    if name == "mean":
        return DummyRegressor(strategy="mean")
    if name in ("ridge10", "ridge100"):
        return make_pipeline(StandardScaler(), Ridge(alpha=10 if name == "ridge10" else 100))
    if name == "boost":
        return GradientBoostingRegressor(
            n_estimators=24, learning_rate=0.05, max_depth=2,
            min_samples_leaf=8, random_state=42, loss="squared_error",
        )
    raise ValueError("Unknown model: " + name)


def error_radius(errors):
    ordered = sorted(errors)
    return float(ordered[min(len(ordered) - 1, math.ceil((len(ordered) + 1) * 0.8) - 1)])


def train(prices, as_of, horizon=1):
    """Select on validation, calibrate separately, then walk forward on 52 origins.

    At each origin, re-fit on targets already observed at that origin. The model
    family and evaluation interval radius stay fixed throughout the test period.
    """
    if isinstance(horizon, bool) or horizon not in (1, 4):
        raise ValueError("Supported horizons are one and four weeks.")
    history = complete_history(prices, as_of)
    origins = np.arange(12, len(history) - horizon)
    targets = origins + horizon
    x = np.stack([features_at(history, int(i)) for i in origins])
    y = np.array([math.log(history[t]["adjusted"] / history[o]["adjusted"])
                  for o, t in zip(origins, targets)])

    test_start = len(origins) - 52
    calibration_end = test_start - horizon + 1
    calibration_start = calibration_end - 26
    validation_end = calibration_start - horizon + 1
    validation_start = validation_end - 26
    if validation_start < 52:
        raise ValueError("Not enough history for the purged chronological splits.")

    def predict_at(name, row):
        available = targets <= origins[row]
        model = new_model(name).fit(x[available], y[available])
        prediction = float(model.predict(x[row:row + 1])[0])
        training_through = history[int(targets[available][-1])]["date"]
        return prediction, training_through

    ranking = []
    for name in CANDIDATES:
        errors = [abs(math.expm1(predict_at(name, i)[0]) - math.expm1(y[i]))
                  for i in range(validation_start, validation_end)]
        ranking.append({"id": name, "validationMae": float(np.mean(errors))})
    ranking.sort(key=lambda item: item["validationMae"])
    selected = ranking[0]["id"]
    radius = error_radius([
        abs(y[i] - predict_at(selected, i)[0])
        for i in range(calibration_start, calibration_end)
    ])
    backtest = []
    for i in range(test_start, len(origins)):
        prediction, training_through = predict_at(selected, i)
        residual = float(abs(y[i] - prediction))
        backtest.append({
            "origin": history[int(origins[i])]["date"],
            "date": history[int(targets[i])]["date"],
            "trainingThrough": training_through,
            "predictedReturn": math.expm1(prediction),
            "actualReturn": math.expm1(y[i]),
            "residual": residual,
            "covered": residual <= radius,
        })

    fitted = new_model(selected).fit(x, y)
    latest_features = features_at(history, len(history) - 1)
    prediction = float(fitted.predict(latest_features.reshape(1, -1))[0])
    live_radius = error_radius([row["residual"] for row in backtest[-26:]])
    actual = np.array([r["actualReturn"] for r in backtest])
    predicted = np.array([r["predictedReturn"] for r in backtest])
    latest = history[-1]
    origin_day = date.fromisoformat(latest["date"])
    target = origin_day + timedelta(days=4 - origin_day.weekday() + 7 * horizon)
    report = {
        "modelVersion": VERSION, "engine": "Python / scikit-learn",
        "modelId": selected, "horizon": horizon,
        "evaluatedAsOf": as_of.isoformat(), "asOf": latest["date"],
        "targetWeekEnding": target.isoformat(), "stale": target < as_of,
        "trainingWeeks": len(origins), "backtestWeeks": len(backtest),
        "basePrice": latest["close"], "baseAdjusted": latest["adjusted"],
        "expectedReturn": math.expm1(prediction),
        "estimate": latest["close"] * math.exp(prediction),
        "low": latest["close"] * math.exp(prediction - live_radius),
        "high": latest["close"] * math.exp(prediction + live_radius),
        "mae": float(np.abs(predicted - actual).mean()),
        "baselineMae": float(np.abs(actual).mean()),
        "rmse": float(np.sqrt(np.mean((predicted - actual) ** 2))),
        "directionAccuracy": float(np.mean(np.sign(predicted) == np.sign(actual))),
        "intervalCoverage": float(np.mean([r["covered"] for r in backtest])),
        "evaluationRadius": radius, "forecastRadius": live_radius,
        "validationThrough": history[int(targets[validation_end - 1])]["date"],
        "calibrationFrom": history[int(origins[calibration_start])]["date"],
        "calibrationThrough": history[int(targets[calibration_end - 1])]["date"],
        "holdoutFrom": backtest[0]["origin"],
        "features": FEATURES, "latestFeatures": latest_features.tolist(),
        "candidates": ranking, "backtest": backtest,
    }
    return report, fitted
