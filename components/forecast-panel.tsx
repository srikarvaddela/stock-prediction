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
            : "Load a stock with at least 120 completed weekly observations. Incomplete or interrupted history is not modeled."}
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
          Based on the 80th percentile of past absolute errors. Not an 80%
          probability guarantee.
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
        Average absolute weekly return error · {f.backtestWeeks} historical
        forecasts
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
        Ridge regression learns a relationship between past weekly price
        behavior and the next week’s adjusted return. It uses momentum, distance
        from a moving average, and volatility. Company fundamentals are
        displayed for research; they are not inputs to this first model.
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
            Walk forward one week at a time. Leave the current, unfinished week
            out of model training.
          </p>
        </div>
        <div>
          <span>03</span>
          <h3>Keep a simple rival</h3>
          <p>
            Compare forecast error with predicting no change. A complex model
            does not automatically win.
          </p>
        </div>
      </div>
      {f && (
        <>
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
          </div>
          <p className="table-caption">
            Latest 10 test weeks · adjusted returns · positive means an increase
          </p>
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
        </>
      )}
      <details className="model-details">
        <summary>Assumptions and limitations</summary>
        <p>
          The model uses up to 260 completed weeks, five standardized features,
          and a fixed ridge penalty of 10. The final 52 available predictions
          are evaluated chronologically. Direction accuracy is historical
          performance, not a probability that the next forecast will be correct.
        </p>
        <p>
          Adjusted returns include the effect of splits and dividends. The
          displayed price equivalent applies that predicted return to the last
          completed week’s unadjusted close. It is not a forecast of corporate
          actions. Historical provider data can be revised and is not a
          point-in-time archive.
        </p>
        <p>
          The error band uses historical out-of-sample residuals. Market
          conditions can change, and coverage has not been independently
          validated. This is an experimental research model, not a trading
          strategy or an instruction to buy or sell.
        </p>
      </details>
    </section>
  );
}
