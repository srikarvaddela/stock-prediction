"use client";
import { useEffect, useState } from "react";
type RecordRow = {
  id: string;
  symbol: string;
  horizon: number;
  asOf: string;
  target: string;
  issued: string;
  model: string;
  version: string;
  predicted: number;
  actual: number | null;
  status: string;
};
const fmt = (n: number) => (n * 100).toFixed(2) + "%";
export function TrackingPanel({
  symbol,
  horizon,
}: {
  symbol: string;
  horizon: number;
}) {
  const [records, setRecords] = useState<RecordRow[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    const r = await fetch("/api/forecasts");
    const d = (await r.json()) as { records: RecordRow[]; error?: string };
    if (!r.ok) throw new Error(d.error);
    setRecords(d.records);
  }
  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, []);
  async function act(action: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/forecasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, symbol, horizon }),
      });
      const result = (await r.json()) as { message: string; error?: string };
      if (!r.ok) throw new Error(result.error);
      setMessage(result.message);
      await refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const scored = records.filter((r) => r.actual !== null);
  return (
    <section className="panel settings-panel">
      <p className="eyebrow">FORWARD TEST</p>
      <h2>Recorded forecasts</h2>
      <p className="section-copy">
        Capture the current research forecast before its target day. Check
        outcomes after the target week ends. Each saved estimate keeps its
        original issue time and model version.
      </p>
      <div className="button-row">
        <button
          className="primary-button"
          onClick={() => act("record")}
          disabled={busy}
        >
          Record {symbol} · {horizon} week{horizon === 1 ? "" : "s"}
        </button>
        <button
          className="secondary-button"
          onClick={() => act("refresh")}
          disabled={busy}
        >
          Check outcomes
        </button>
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <div className="backtest-summary">
        <span>
          <strong>{records.length}</strong> recent records
        </span>
        <span>
          <strong>{scored.length}</strong> scored
        </span>
        {scored.length > 0 && (
          <span>
            Mean error{" "}
            <strong>
              {(
                (100 *
                  scored.reduce(
                    (sum, r) => sum + Math.abs(r.predicted - r.actual!),
                    0,
                  )) /
                scored.length
              ).toFixed(2)}{" "}
              pp
            </strong>
          </span>
        )}
      </div>
      {records.length === 0 ? (
        <p className="section-copy">
          Your first recorded forecast will appear here.
        </p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Stock",
                  "Issued (UTC)",
                  "Target week",
                  "Model",
                  "Forecast",
                  "Actual",
                  "Status",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <th>
                    {r.symbol} · {r.horizon}W
                  </th>
                  <td>{r.issued.slice(0, 16).replace("T", " ")}</td>
                  <td>{r.target}</td>
                  <td>
                    {r.model} v{r.version}
                  </td>
                  <td>{fmt(r.predicted)}</td>
                  <td>{r.actual === null ? "—" : fmt(r.actual)}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="form-hint">
        Latest 200 records. Outcomes use adjusted returns. A holiday-shortened
        week is excluded if the observation date is on or before the issue date.
      </p>
    </section>
  );
}
