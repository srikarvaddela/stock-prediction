"use client";
import { useEffect, useState } from "react";
import type { StockData } from "@/lib/stock-types";
import type { evaluatePredictions } from "@/lib/evaluation.mjs";
type Report = {
  symbol: string;
  horizon: number;
  asOf: string;
  targetWeekEnding: string;
  modelId: string;
  modelVersion: string;
  estimate: number;
  low: number;
  high: number;
  mae: number;
  baselineMae: number;
  directionAccuracy: number;
  intervalCoverage: number;
  outdated: boolean;
  stale: boolean;
  holdoutFrom: string;
  evaluatedAsOf: string;
  candidates: { id: string; validationMae: number }[];
  dataset: { fetchedAt: string; sha256: string };
  evaluation:ReturnType<typeof evaluatePredictions>;
  forwardEvaluation:ReturnType<typeof evaluatePredictions>;
  forwardRecords:{asOf:string;target:string;predictedReturn:number;actualReturn:number|null;createdAt:string}[];
};
const labels: Record<string, string> = {
  flat: "No change",
  mean: "Historical mean",
  ridge10: "Ridge regression",
  ridge100: "Conservative ridge",
  boost: "Gradient boosting",
};
const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const pp = (n: number) => (n * 100).toFixed(2) + " pp";
export function PythonPanel({
  symbol,
  horizon,
  data,
}: {
  symbol: string;
  horizon: number;
  data: StockData | null;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setReport(null);
    setError("");
    fetch(
      `/api/python-forecast?symbol=${encodeURIComponent(symbol)}&horizon=${horizon}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const body = (await r.json()) as Report & { error?: string };
        if (!r.ok) throw new Error(body.error);
        return body;
      })
      .then((r) => {
        if (!controller.signal.aborted) setReport(r);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [symbol, horizon, retry]);
  const current =
    data?.symbol === symbol && data.forecast?.horizon === horizon
      ? data.forecast
      : null;
  return (
    <section className="panel python-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">PYTHON MODEL COMPARISON</p>
          <h2>
            {symbol} · {horizon}-week forecasts
          </h2>
        </div>
        <span className="tag">Experimental</span>
      </div>
      <p>
        Compare the published Python model with the website’s current forecast.
        Each model selects its own candidate using earlier validation data.
      </p>
      {error ? (
        <div role="status">
          <p>{error}</p>
          <button
            className="secondary-button"
            onClick={() => setRetry((r) => r + 1)}
          >
            Try again
          </button>
        </div>
      ) : !report ? (
        <p role="status">Loading Python training results…</p>
      ) : (
        <>
          {(report.outdated || report.stale) && (
            <p className="stale-warning">
              Historical Python result from {report.asOf}. Newer completed weeks
              are not included. Do not treat this as a fresh forecast.
            </p>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Measure</th>
                  <th>Python · scikit-learn</th>
                  <th>Website · JavaScript</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Selected model</th>
                  <td>{labels[report.modelId]}</td>
                  <td>{current?.model || "Unavailable"}</td>
                </tr>
                <tr>
                  <th>Price-equivalent estimate</th>
                  <td>{money(report.estimate)}</td>
                  <td>{current ? money(current.estimate) : "—"}</td>
                </tr>
                <tr>
                  <th>Historical-error band</th>
                  <td>
                    {money(report.low)} – {money(report.high)}
                  </td>
                  <td>
                    {current
                      ? `${money(current.low)} – ${money(current.high)}`
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <th>Data through</th>
                  <td>{report.asOf}</td>
                  <td>{current?.asOf || "—"}</td>
                </tr>
                <tr>
                  <th>Target week ending</th>
                  <td>{report.targetWeekEnding}</td>
                  <td>{current?.targetWeekEnding || "—"}</td>
                </tr>
                <tr>
                  <th>Test return error</th>
                  <td>{pp(report.mae)}</td>
                  <td>{current ? pp(current.mae) : "—"}</td>
                </tr>
                <tr>
                  <th>No-change error</th>
                  <td>{pp(report.baselineMae)}</td>
                  <td>{current ? pp(current.baselineMae) : "—"}</td>
                </tr>
                <tr>
                  <th>Test starts</th>
                  <td>{report.holdoutFrom}</td>
                  <td>{current?.holdoutFrom || "—"}</td>
                </tr>
                <tr>
                  <th>Test interval coverage</th>
                  <td>{(report.intervalCoverage * 100).toFixed(1)}%</td>
                  <td>
                    {current
                      ? (current.intervalCoverage * 100).toFixed(1) + "%"
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="model-verdict">
            {report.mae < report.baselineMae
              ? "Python had lower error than no change in this test."
              : "Python did not beat the no-change baseline in this test."}
          </p>
          <p className="small muted">
            Both tests contain 52 historical forecasts. Different input
            histories or dates can make their errors unsuitable for direct
            ranking. Bands are empirical, not probability guarantees.
          </p>
          <details>
            <summary>Does the advantage persist over time?</summary>
            <p>{report.evaluation.verdict}. Baseline error minus model error: {report.evaluation.improvement===null?"—":pp(report.evaluation.improvement)}.</p>
            {report.evaluation.interval && <p>95% moving-block bootstrap interval for error improvement: {pp(report.evaluation.interval.low)} to {pp(report.evaluation.interval.high)}. Blocks contain {report.evaluation.interval.blockLength} consecutive observations. This describes historical sampling uncertainty, not a probability of future profit.</p>}
            <div className="table-scroll"><table><thead><tr><th>Test period</th><th>Forecasts</th><th>Model error</th><th>No-change error</th></tr></thead><tbody>{report.evaluation.periods.map((p,i)=><tr key={i}><th>{p.from} – {p.to}</th><td>{p.count}</td><td>{pp(p.mae)}</td><td>{pp(p.baselineMae)}</td></tr>)}</tbody></table></div>
            <p>The tests use today's available listings and revised adjusted prices. Delisted companies and historical data revisions can cause survivorship and revision bias. Consistency across these periods does not remove those limitations.</p>
          </details>
          <details>
            <summary>Forward record · {report.forwardEvaluation.count} settled predictions</summary>
            <p>These estimates were saved by the scheduled job before their target day. They are separate from historical backtests and begin when automatic tracking is enabled.</p>
            <p>{report.forwardEvaluation.verdict}{report.forwardEvaluation.mae!==null ? ` · model error ${pp(report.forwardEvaluation.mae)}, baseline ${pp(report.forwardEvaluation.baselineMae!)}` : ". No live performance has been established yet."}</p>
            <div className="table-scroll"><table><thead><tr><th>Saved</th><th>Target</th><th>Forecast return</th><th>Observed return</th></tr></thead><tbody>{report.forwardRecords.slice(-12).reverse().map(r=><tr key={r.asOf}><td>{r.createdAt.slice(0,10)}</td><td>{r.target}</td><td>{(r.predictedReturn*100).toFixed(2)}%</td><td>{r.actualReturn===null?"Pending":(r.actualReturn*100).toFixed(2)+"%"}</td></tr>)}</tbody></table></div>
          </details>
          <details>
            <summary>Python selection and provenance</summary>
            <ul>
              {report.candidates.map((c) => (
                <li key={c.id}>
                  {labels[c.id]} · validation error {pp(c.validationMae)}
                </li>
              ))}
            </ul>
            <p>
              Trained {report.evaluatedAsOf} · {report.modelVersion}. The scheduled
              data pipeline retrains after new completed weeks. Each report keeps
              its own source date; failed updates retain the previous result.
            </p>
            <p>
              Source snapshot retrieved{" "}
              {report.dataset.fetchedAt || "date unavailable"}.
            </p>
          </details>
          <a
            className="text-button"
            download={`${symbol}-${horizon}w-python.json`}
            href={`/api/python-forecast?symbol=${encodeURIComponent(symbol)}&horizon=${horizon}`}
          >
            Download Python report and backtest
          </a>
        </>
      )}
    </section>
  );
}
