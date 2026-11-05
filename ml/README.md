# Python training and backtesting

This research pipeline uses NumPy and scikit-learn. The hosted Model lab compares
published Python results with the JavaScript engine in `lib/forecast.mjs`.
Training does not automatically replace the main forecast or establish that
the Python candidates perform better.

## Run

Use Python 3.11–3.13. From the repository root on Windows:

```powershell
py -3.13 -m venv .venv
.venv/Scripts/python.exe -m pip install -r ml/requirements.txt
node scripts/refresh-price-snapshots.mjs
.venv/Scripts/python.exe -m ml.train --symbols AAPL MSFT NVDA --horizons 1 4
.venv/Scripts/python.exe -m unittest discover -s ml/tests -v
```

On macOS/Linux, create the environment with `python3 -m venv .venv` and replace
`.venv/Scripts/python.exe` with `.venv/bin/python`.

The refresh script needs Node.js 22.13+ and network access. It obtains the featured
companies' Yahoo Finance history and rolls daily prices into weekly
observations. Missing snapshots cause training to fail with an explicit error.
The main IBM research chart still uses Alpha Vantage; its Python training uses
the Yahoo snapshot. Compare the source dates before comparing errors.
Any ticker with a compatible input file can be trained.

To replay a run, retain the exact input snapshot, use the recorded dependency
versions, and supply `--as-of YYYY-MM-DD`. The default evaluation date is today
in UTC. Output records the input SHA-256 and fetch timestamp when available.
Earlier `--as-of` dates filter observations, but cannot undo later provider data
revisions. Saved snapshots may be stale and all forecasts carry their origin date.

Optional arguments:

```sh
python -m ml.train --symbols TSLA META --horizons 4 --input-dir .market-snapshots --output-dir ml/artifacts --as-of 2026-11-05
```

Input files are `<TICKER>.json` with this shape. Values below illustrate the schema
only; an actual run needs at least 180 completed weekly observations.

```json
{
  "symbol": "AAPL",
  "fetchedAt": "2026-11-05T00:00:00Z",
  "prices": [{"date": "2026-10-30", "close": 100, "adjusted": 99}]
}
```

## Models and evaluation

- No-change and historical-mean baselines can win selection.
- Ridge regression uses penalties 10 and 100, with a `StandardScaler` fitted
  inside each training window.
- Gradient boosting uses 24 depth-two trees, learning rate 0.05, a minimum leaf
  size of eight, and a fixed seed. These parameters are fixed in advance.

The pipeline uses the same five past-price features, completed-week filtering,
320-week maximum history, and direct one/four-week adjusted log-return targets
as the app. The Python boosting candidate differs from the app's small stump
ensemble, so Python and JavaScript forecasts are not expected to match.

An earlier 26-origin validation period selects the model family. A separate
26-origin period calibrates the empirical 80% interval. The final 52 origins
evaluate the chosen family with a fixed calibration radius. Each prediction
refits on labels already matured by that origin. Horizon-dependent gaps prevent
validation/calibration labels from crossing the next period's first origin.
Earlier test outcomes can join training once observed, as in live walk-forward
retraining; they never change the chosen family.

The exported final model trains on all matured labels, and its forecast interval
uses the latest 26 completed test errors. Test interval coverage uses the earlier
calibration radius, not those test errors. This follows the same split policy
described in [the app methodology](../docs/model.md).

MAE/RMSE measure simple-return errors. JSON stores fractions; CLI displays
percentage points. Direction accuracy and interval coverage describe historical
results, not probabilities or promised returns. Four-week outcomes overlap.
Provider history may be revised. Costs, corporate-action forecasts, trading
execution and profitability are not modeled.

## Outputs

Each symbol/horizon writes `ml/artifacts/<SYMBOL>/<HORIZON>w/`:

- `report.json` contains dates, input hash, runtime versions, model rankings,
  baseline comparison, error metrics, interval coverage, forecast and backtest.
- `backtest.csv` contains the 52 historical predictions and actual outcomes.
- `model.joblib` contains the fitted scikit-learn model, feature order, symbol,
  horizon and training origin. Ridge artifacts include their fitted scaler.

Repeating a run overwrites that symbol/horizon's outputs. Set a different output
directory to retain experiments. Data, fitted artifacts and environments are
excluded from Git. Training uses local files and needs no API key.

Load only artifacts you created and trust. Joblib uses pickle and can execute
code when loading an untrusted file. A local inference check can reproduce the
exported forecast using its saved feature vector:

```python
import json
import math
import joblib

path = "ml/artifacts/AAPL/1w/"
with open(path + "report.json", encoding="utf-8") as handle:
    report = json.load(handle)
artifact = joblib.load(path + "model.joblib")
log_return = artifact["model"].predict([report["latestFeatures"]])[0]
estimate = report["basePrice"] * math.exp(log_return)
```

## Website publication

`npm run build` refreshes histories, invokes `scripts/prepare-python-models.mjs`,
and trains all featured companies at both horizons. The script verifies report
symbols, horizons and input hashes before exporting JSON to `.python-forecasts/`.
Matching cached exports can be reused. Set `PYTHON` to a Python executable if
needed; otherwise the script prefers the local `.venv` and then `python`.

The authenticated `/api/python-forecast` endpoint serves those dated reports.
The Model lab displays them next to the current JavaScript results. Freshness is
checked at request time, including four-week results whose origin is outdated
even before their target expires. Unsupported companies get an explicit message.
Worker deployments contain JSON only, not Python environments or pickle files.
Python runs during publishing; it does not execute in the hosted Worker. The
main forecast card and forecast log still use the JavaScript engine.
