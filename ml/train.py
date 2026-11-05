"""CLI for reproducible training from the app's dated weekly price snapshots."""

import argparse
import csv
from datetime import date, datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import platform
import re
import sys

import joblib
import numpy as np
import sklearn
import scipy
import threadpoolctl

from .pipeline import VERSION, train


def write_outputs(directory, report, model):
    directory.mkdir(parents=True, exist_ok=True)
    # These are trusted local artifacts. Never load downloaded/untrusted pickle files.
    temporary = directory / "model.joblib.tmp"
    joblib.dump({"modelVersion": VERSION, "symbol": report["symbol"],
                 "horizon": report["horizon"], "asOf": report["asOf"],
                 "features": report["features"], "model": model}, temporary)
    temporary.replace(directory / "model.joblib")
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=list(report["backtest"][0]), lineterminator="\n")
    writer.writeheader()
    writer.writerows(report["backtest"])
    for name, text in (
        ("report.json", json.dumps(report, indent=2, allow_nan=False) + "\n"),
        ("backtest.csv", buffer.getvalue()),
    ):
        temporary = directory / (name + ".tmp")
        temporary.write_text(text, encoding="utf-8")
        temporary.replace(directory / name)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--symbols", nargs="+", required=True, help="Tickers, e.g. AAPL MSFT")
    parser.add_argument("--horizons", nargs="+", type=int, choices=(1, 4), default=[1, 4])
    parser.add_argument("--input-dir", type=Path, default=Path(".market-snapshots"))
    parser.add_argument("--output-dir", type=Path, default=Path("ml/artifacts"))
    parser.add_argument("--as-of", type=date.fromisoformat,
                        default=datetime.now(timezone.utc).date(), help="UTC evaluation date, YYYY-MM-DD")
    args = parser.parse_args(argv)
    inputs = []
    try:
        for symbol in dict.fromkeys(s.upper() for s in args.symbols):
            if not re.fullmatch(r"[A-Z][A-Z0-9.-]{0,9}", symbol):
                raise ValueError("Invalid ticker: " + symbol)
            path = args.input_dir / (symbol + ".json")
            if not path.is_file():
                raise ValueError(f"Missing {path}. Refresh snapshots or provide a compatible history file.")
            raw = path.read_bytes()
            data = json.loads(raw)
            if not isinstance(data, dict) or data.get("symbol") != symbol:
                raise ValueError(f"Snapshot symbol must match {symbol}.")
            if not isinstance(data.get("prices"), list):
                raise ValueError(f"Snapshot for {symbol} needs a prices list.")
            inputs.append((symbol, raw, data))
        for symbol, raw, data in inputs:
            for horizon in dict.fromkeys(args.horizons):
                report, model = train(data["prices"], args.as_of, horizon)
                report.update({
                    "symbol": symbol,
                    "dataset": {"sha256": hashlib.sha256(raw).hexdigest(),
                                "fetchedAt": data.get("fetchedAt"),
                                "source": "User-supplied weekly snapshot"},
                    "environment": {"python": platform.python_version(),
                                    "numpy": np.__version__, "scikitLearn": sklearn.__version__,
                                    "scipy": scipy.__version__, "joblib": joblib.__version__,
                                    "threadpoolctl": threadpoolctl.__version__},
                    "usage": "Offline research. Not used by the hosted forecast engine.",
                })
                directory = args.output_dir / symbol / f"{horizon}w"
                write_outputs(directory, report, model)
                print(f"{symbol} {horizon}w | {report['modelId']} | "
                      f"test MAE {100 * report['mae']:.3f} pp | "
                      f"no-change {100 * report['baselineMae']:.3f} pp | {directory}", flush=True)
    except (ValueError, KeyError, OSError, OverflowError) as exc:
        print("Training failed: " + str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
