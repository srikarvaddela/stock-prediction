import {
  ArrowUpRight,
  FlaskConical,
  Minus,
  ArrowDownRight,
} from "lucide-react";
import type { StockData } from "@/lib/stock-types";

const money = (v: number, c: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: c,
    maximumFractionDigits: 2,
  }).format(v);
const pp = (v: number) => `${(v * 100).toFixed(2)} pp`;
const pct = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;

export function ForecastResult({
  data,
  loading,
}: {
  data: StockData | null;
  loading: boolean;
}) {
  const f = data?.forecast,
    currency = data?.overview?.currency || "USD";
  if (!f)
    return (
      <div className="model-placeholder">
        <FlaskConical size={30} />
        <h3>{loading ? "Preparing the model…" : "No forecast available"}</h3>
        <p>
          {loading
            ? "Loading price history before fitting and testing the model."
            : "Load a stock with at least 180 completed weekly observations. Incomplete or interrupted history is not modeled."}
        </p>
      </div>
    );
  const improved = f.mae < f.baselineMae;
  return (
    <div className="forecast-result">
      <div className="forecast-horizon">
        {f.stale ? "HISTORICAL ESTIMATE" : "WEEK ENDING"} · {f.targetWeekEnding}
      </div>
      <div className="forecast-value">
        {money(f.estimate, currency)}
        <span className={f.expectedReturn >= 0 ? "positive" : "negative"}>
          {f.expectedReturn >= 0 ? (
            <ArrowUpRight size={15} />
          ) : (
            <ArrowDownRight size={15} />
          )}{" "}
          {pct(f.expectedReturn)}
        </span>
      </div>
      <p className="forecast-basis">
        {f.model} · {f.horizon}-week horizon
        <br />
        Price-equivalent estimate from {f.asOf}
        <br />
        Reference close {money(f.basePrice, currency)}
      </p>
      <div className="forecast-band">
        <span>Historical-error band</span>
        <strong>
          {money(f.low, currency)} <Minus size={11} /> {money(f.high, currency)}
        </strong>
        <div className="band-track">
          <i />
        </div>
        <small>
          Calibrated from the latest 26 completed forecast errors. Nominal 80%
          coverage is not a probability guarantee.
        </small>
      </div>
      <div className={`model-verdict ${improved ? "" : "caution"}`}>
        {improved
          ? "Lower error than the baseline in this backtest."
          : "This model has not beaten the no-change baseline."}
      </div>
      <div className="forecast-scores">
        <div>
          <span>Model error</span>
          <strong>{pp(f.mae)}</strong>
        </div>
        <div>
          <span>No-change error</span>
          <strong>{pp(f.baselineMae)}</strong>
        </div>
      </div>
      <p className="forecast-basis">
        Average absolute {f.horizon}-week return error · {f.backtestWeeks}{" "}
        unseen historical forecasts
      </p>
      {f.stale && (
        <p className="stale-warning">
          The target week has already passed. This is a historical estimate, not
          a current forecast.
        </p>
      )}
    </div>
  );
}

export function ModelReport({ data }: { data: StockData | null }) {
  const f = data?.forecast;
  return (
    <section className="panel model-report">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SHOW THE WORK</p>
          <h2>How the forecast earns its place</h2>
        </div>
        <FlaskConical size={20} />
      </div>
      <p>
        Six candidates compete on an earlier validation period: two baselines,
        two ridge models, gradient boosting, and an ensemble. The selected model
        is then tested on a separate later period. Fundamentals and news are
        research context, not forecasting inputs.
      </p>
      <div className="model-methods">
        <div>
          <span>01</span>
          <h3>Train on the past</h3>
          <p>
            Each historical forecast fits and scales its features using only
            observations available at its origin.
          </p>
        </div>
        <div>
          <span>02</span>
          <h3>Test the next week</h3>
          <p>
            Leave the current week out. For longer horizons, train only on
            targets whose outcomes were already known at that forecast origin.
          </p>
        </div>
        <div>
          <span>03</span>
          <h3>Keep a simple rival</h3>
          <p>
            Choose the candidate with the lowest earlier validation error, even
            when that is the no-change model. Keep the final test separate.
          </p>
        </div>
      </div>
      {f && (
        <>
          <p className="model-selection">
            <strong>Selected: {f.model}</strong>
            <br />
            Selection outcomes through {f.validationThrough} · uncertainty
            calibration through {f.calibrationThrough} · unseen test starts{" "}
            {f.holdoutFrom}
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Candidate</th>
                  <th scope="col">Earlier validation error</th>
                </tr>
              </thead>
              <tbody>
                {f.candidates.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">
                      {c.name}
                      {c.id === f.modelId ? " · selected" : ""}
                    </th>
                    <td>{pp(c.validationMae)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="backtest-summary">
            <span>
              <strong>{f.trainingWeeks}</strong> training examples
            </span>
            <span>
              <strong>{f.backtestWeeks}</strong> historical tests
            </span>
            <span>
              <strong>{(f.directionAccuracy * 100).toFixed(1)}%</strong>{" "}
              direction accuracy
            </span>
            <span>
              <strong>{(f.intervalCoverage * 100).toFixed(1)}%</strong> test
              interval coverage
            </span>
          </div>
          <p className="table-caption">
            Latest 10 test outcomes · {f.horizon}-week adjusted returns ·
            positive means an increase
          </p>
          <button
            className="text-button"
            onClick={() => {
              const csv = [
                "origin,target,predicted_return,actual_return,absolute_error",
                ...f.backtest.map((r) =>
                  [
                    r.origin,
                    r.date,
                    r.predictedReturn,
                    r.actualReturn,
                    Math.abs(r.predictedReturn - r.actualReturn),
                  ].join(","),
                ),
              ].join("\n");
              const url = URL.createObjectURL(
                new Blob([csv], { type: "text/csv" }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = `${data?.symbol}-${f.horizon}w-backtest.csv`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Export all test results <ArrowUpRight size={14} />
          </button>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Week ending</th>
                  <th scope="col">Predicted return</th>
                  <th scope="col">Actual return</th>
                  <th scope="col">Absolute error</th>
                </tr>
              </thead>
              <tbody>
                {f.backtest
                  .slice(-10)
                  .reverse()
                  .map((row) => (
                    <tr key={row.date}>
                      <th scope="row">{row.date}</th>
                      <td>{pct(row.predictedReturn)}</td>
                      <td>{pct(row.actualReturn)}</td>
                      <td>
                        {pp(Math.abs(row.predictedReturn - row.actualReturn))}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="driver-list">
            <h3>What moves this estimate?</h3>
            <p>
              Change in the predicted return when one input is reset to its
              training average. These sensitivities are not causal explanations.
            </p>
            {f.drivers.map((d) => (
              <div key={d.name}>
                <span>{d.name}</span>
                <strong>{pp(d.impact)}</strong>
              </div>
            ))}
          </div>
        </>
      )}
      <details className="model-details">
        <summary>Assumptions and limitations</summary>
        <p>
          Models use up to 320 completed weeks and five price-derived features.
          Validation, calibration, and final testing use distinct chronological
          periods with gaps to avoid leaking overlapping targets. The final 52
          predictions are evaluated chronologically. Direction accuracy is
          historical performance, not a probability that the next forecast will
          be correct.
        </p>
        <p>
          Adjusted returns include the effect of splits and dividends. The
          displayed price equivalent applies that predicted return to the last
          completed week’s unadjusted close. It is not a forecast of corporate
          actions. Historical provider data can be revised and is not a
          point-in-time archive.
        </p>
        <p>
          Interval coverage is measured on the final test using a band
          calibrated before that test. The current forecast band is recalibrated
          using the latest 26 matured test errors. Four-week outcomes overlap;
          they are not independent. Market conditions can change. This is an
          experimental research model, not a trading strategy or an instruction
          to buy or sell.
        </p>
      </details>
    </section>
  );
}
