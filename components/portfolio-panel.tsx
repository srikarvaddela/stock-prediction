"use client";
import { useEffect, useState } from "react";
import type { StockData } from "@/lib/stock-types";
import { fetchStock, percent } from "@/components/compare-panel";
import { portfolioReport } from "@/lib/portfolio.mjs";
type Holding = {
  id: string;
  symbol: string;
  quantity: number;
  cost_basis: number;
};
const money = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD" });
export function PortfolioPanel() {
  const [holdings, setHoldings] = useState<Holding[]>([]),
    [stocks, setStocks] = useState<Record<string, StockData>>({}),
    [symbol, setSymbol] = useState(""),
    [shares, setShares] = useState(""),
    [cost, setCost] = useState(""),
    [editId, setEditId] = useState(""),
    [requestId, setRequestId] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    const r = await fetch("/api/portfolio");
    const d = (await r.json()) as { holdings: Holding[]; error?: string };
    if (!r.ok) throw new Error(d.error);
    setHoldings(d.holdings);
  }
  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
    setRequestId(crypto.randomUUID());
  }, []);
  function reset() {
    setEditId("");
    setRequestId(crypto.randomUUID());
    setSymbol("");
    setShares("");
    setCost("");
  }
  async function save(action: string, id: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id,
          symbol,
          quantity: Number(shares),
          costBasis: Number(cost),
        }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error);
      await refresh();
      reset();
      setMessage("Portfolio updated.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function price() {
    setBusy(true);
    setMessage("Loading current positions…");
    const data: Record<string, StockData> = {},
      errors: string[] = [];
    for (const ticker of new Set(holdings.map((h) => h.symbol))) {
      try {
        data[ticker] = await fetchStock(ticker);
      } catch (e) {
        errors.push(ticker + " · " + (e as Error).message);
      }
    }
    setStocks(data);
    setMessage(
      errors.join(" ") ||
        "Positions valued with the latest available weekly closes.",
    );
    setBusy(false);
  }
  const report = portfolioReport(holdings, stocks);
  return (
    <section className="panel settings-panel">
      <p className="eyebrow">HOLDINGS & EXPOSURE</p>
      <h2>Your portfolio</h2>
      <p className="section-copy">
        Enter USD stock lots with their average purchase price. Refresh
        valuations when you want to use market data.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(editId ? "edit" : "add", editId || requestId);
        }}
      >
        <div className="holding-form">
          <label className="field-label">
            Company name or ticker
            <input
              required
              maxLength={100}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
          </label>
          <label className="field-label">
            Shares
            <input
              required
              type="number"
              step="any"
              min="0.000000001"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
            />
          </label>
          <label className="field-label">
            Cost per share (USD)
            <input
              required
              type="number"
              step="any"
              min="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </label>
        </div>
        <div className="button-row">
          <button className="primary-button" disabled={busy}>
            {editId ? "Update lot" : "Add lot"}
          </button>
          {editId && (
            <button type="button" onClick={reset}>
              Cancel
            </button>
          )}
          <button
            type="button"
            className="secondary-button"
            disabled={busy || !holdings.length}
            onClick={price}
          >
            Refresh valuations
          </button>
        </div>
      </form>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {holdings.length > 0 && (
        <>
          <div className="backtest-summary">
            <span>
              <strong>
                {report.pricedCount}/{holdings.length}
              </strong>{" "}
              lots priced
            </span>
            {report.pricedCount > 0 && (
              <>
                <span>
                  Priced value <strong>{money(report.value)}</strong>
                </span>
                <span>
                  Unrealized gain/loss <strong>{money(report.pnl)}</strong>
                </span>
                <span>
                  Largest stock weight{" "}
                  <strong>{percent(report.largestWeight)}</strong>
                </span>
              </>
            )}
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    "Stock",
                    "Shares",
                    "Cost/share",
                    "Value",
                    "Observation",
                    "Manage",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.map((h, i) => (
                  <tr key={h.id}>
                    <th>{h.symbol}</th>
                    <td>{h.quantity}</td>
                    <td>{money(h.cost_basis)}</td>
                    <td title={report.rows[i].reason || ""}>
                      {report.rows[i].value === null
                        ? "Unpriced"
                        : money(report.rows[i].value)}
                    </td>
                    <td>{report.rows[i].asOf || "—"}</td>
                    <td>
                      <button
                        disabled={busy}
                        onClick={() => {
                          setEditId(h.id);
                          setSymbol(h.symbol);
                          setShares(String(h.quantity));
                          setCost(String(h.cost_basis));
                        }}
                      >
                        Edit
                      </button>{" "}
                      ·{" "}
                      <button
                        disabled={busy}
                        onClick={() => save("remove", h.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {report.pricedCount > 0 && (
            <>
              <h3>Sector exposure</h3>
              {Object.entries(report.sectors).map(([sector, w]) => (
                <p className="form-hint" key={sector}>
                  {sector} · {percent(Number(w))}
                </p>
              ))}
            </>
          )}
          {report.risk && (
            <>
              <h3>Historical performance of today’s weights</h3>
              <p className="section-copy">
                {report.risk.from} through {report.risk.to} · hypothetical
                weekly rebalancing of the priced positions using adjusted
                returns.
              </p>
              <div className="backtest-summary">
                <span>
                  Period return{" "}
                  <strong>{percent(report.risk.totalReturn)}</strong>
                </span>
                <span>
                  Annualized volatility{" "}
                  <strong>{percent(report.risk.volatility)}</strong>
                </span>
                <span>
                  Maximum drawdown{" "}
                  <strong>{percent(report.risk.drawdown)}</strong>
                </span>
              </div>
            </>
          )}
        </>
      )}
      {!holdings.length && (
        <p className="section-copy">
          Add your first holding to start tracking your exposure.
        </p>
      )}
    </section>
  );
}
