"use client";
import { useState } from "react";
import type { StockData } from "@/lib/stock-types";
import { comparisonSymbols } from "@/lib/company-search.mjs";
export const percent = (value: number | null | undefined) =>
  value == null ? "—" : (100 * value).toFixed(2) + "%";
const number = (value: number | null | undefined) =>
  value == null
    ? "—"
    : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
export async function fetchStock(symbol: string): Promise<StockData> {
  const response = await fetch(
    "/api/stocks?symbol=" + encodeURIComponent(symbol),
  );
  const body = (await response.json()) as StockData & { error?: string };
  if (!response.ok) throw new Error(body.error || "Could not load " + symbol);
  return body;
}
const metrics: [string, (s: StockData) => string][] = [
  ["Name", (s) => s.overview?.name || s.symbol],
  ["Sector", (s) => s.overview?.sector || "—"],
  ["Latest observation", (s) => s.prices.at(-1)!.date],
  ["Price source", (s) => s.source],
  [
    "Closing price",
    (s) => number(s.prices.at(-1)!.close) + " " + (s.overview?.currency || ""),
  ],
  ["Quarterly revenue growth (YoY)", (s) => percent(s.overview?.revenueGrowth)],
  ["Trailing P/E", (s) => number(s.overview?.pe)],
  ["Profit margin", (s) => percent(s.overview?.profitMargin)],
  ["Dividend yield", (s) => percent(s.overview?.dividendYield)],
  ["Latest fiscal quarter", (s) => s.overview?.latestQuarter || "—"],
  ["1-week model", (s) => s.forecast?.model || "—"],
  ["Forecast origin", (s) => s.forecast?.asOf || "—"],
  ["Estimated adjusted return", (s) => percent(s.forecast?.expectedReturn)],
  [
    "Historical return error",
    (s) => (s.forecast ? (s.forecast.mae * 100).toFixed(2) + " pp" : "—"),
  ],
];
export function ComparePanel({ watchlist }: { watchlist: string[] }) {
  const [input, setInput] = useState(
      watchlist.length > 1 ? watchlist.slice(0, 4).join(", ") : "IBM, MSFT",
    ),
    [stocks, setStocks] = useState<StockData[]>([]),
    [errors, setErrors] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  async function run() {
    const symbols = comparisonSymbols(input);
    if (
      symbols.length < 2 ||
      symbols.length > 4 ||
      symbols.some((s) => !/^[A-Z][A-Z0-9.-]{0,9}$/.test(s))
    ) {
      setErrors(["Enter two to four different stock tickers."]);
      return;
    }
    setBusy(true);
    setStocks([]);
    setErrors([]);
    const result = await Promise.allSettled(symbols.map(fetchStock));
    setStocks(
      result.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
    );
    setErrors(
      result.flatMap((r, i) =>
        r.status === "rejected" ? [symbols[i] + ": " + r.reason.message] : [],
      ),
    );
    setBusy(false);
  }
  return (
    <section className="panel settings-panel">
      <p className="eyebrow">COMPANY COMPARISON</p>
      <h2>Compare stocks side by side</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <label className="field-label">
          Company names or tickers, separated by commas
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={400}
          />
        </label>
        <button className="primary-button" disabled={busy}>
          {busy ? "Loading companies…" : "Compare stocks"}
        </button>
      </form>
      {errors.map((error) => (
        <p className="notice" role="status" key={error}>
          {error}
        </p>
      ))}
      {stocks.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Measure</th>
                {stocks.map((s) => (
                  <th key={s.symbol}>{s.symbol}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map(([name, read]) => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  {stocks.map((s) => (
                    <td key={s.symbol}>{read(s)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="form-hint">
            Forecast error is measured on the later 52 historical test origins.
          </p>
        </div>
      )}
    </section>
  );
}
