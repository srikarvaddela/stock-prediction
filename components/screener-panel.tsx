"use client";
import { useEffect, useState } from "react";
import { filterStocks, sortStocks } from "@/lib/screener.mjs";
type Row = {
  symbol: string;
  name: string;
  sector: string;
  price: number | null;
  priceDate: string | null;
  priceStale: boolean;
  return4w: number | null;
  volatility: number | null;
  indicatorDate: string | null;
  pe: number | null;
  revenueGrowth: number | null;
  fiscalQuarter: string | null;
  pythonMae: number | null;
  pythonAsOf: string | null;
  pythonBeatsBaseline: boolean;
};
type Result = {
  rows: Row[];
  canLoadFundamentals: boolean;
  connectionMessage: string;
};
const initial = {
  query: "",
  sector: "",
  minPrice: "",
  maxPrice: "",
  minReturn: "",
  maxVolatility: "",
  maxPe: "",
  minGrowth: "",
  beatsBaseline: false,
};
const pct = (n: number | null) =>
  n === null ? "—" : (100 * n).toFixed(2) + "%";
export function ScreenerPanel({
  onChoose,
}: {
  onChoose: (symbol: string) => void;
}) {
  const [data, setData] = useState<Result | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [filters, setFilters] = useState(initial),
    [sort, setSort] = useState("symbol"),
    [direction, setDirection] = useState("asc");
  async function refresh() {
    const r = await fetch("/api/screener");
    const d = (await r.json()) as Result & { error?: string };
    if (!r.ok) throw new Error(d.error);
    setData(d);
  }
  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, []);
  async function fundamentals(symbol: string) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error);
      await refresh();
      setMessage("Fundamentals loaded for " + symbol + ".");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const rows = sortStocks(
    filterStocks(data?.rows ?? [], filters),
    sort,
    direction,
  ) as Row[];
  function exportRows() {
    const keys = [
      "symbol",
      "name",
      "sector",
      "price",
      "priceDate",
      "return4w",
      "volatility",
      "indicatorDate",
      "pe",
      "revenueGrowth",
      "fiscalQuarter",
      "pythonMae",
      "pythonAsOf",
    ];
    const csv = [
      keys.join(","),
      ...rows.map((r) =>
        keys
          .map(
            (k) =>
              '"' +
              String(
                (r as unknown as Record<string, unknown>)[k] ?? "",
              ).replaceAll('"', '""') +
              '"',
          )
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "stock-screener.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="panel screener-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">FIND COMPANIES TO RESEARCH</p>
          <h2>Stock screener</h2>
        </div>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            refresh()
              .catch((e) => setMessage(e.message))
              .finally(() => setBusy(false));
          }}
        >
          Refresh data
        </button>
      </div>
      <p>
        Explore the 30 featured companies. Price and volatility filters work
        without a key. Load reported fundamentals one company at a time for P/E
        and revenue-growth filters.
      </p>
      {(message || data?.connectionMessage) && (
        <p className="notice" role="status">
          {message || data?.connectionMessage}
        </p>
      )}
      <div className="screen-filters">
        <label>
          Company or ticker
          <input
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
          />
        </label>
        <label>
          Sector group
          <select
            value={filters.sector}
            onChange={(e) => setFilters({ ...filters, sector: e.target.value })}
          >
            <option value="">All groups</option>
            {[...new Set(data?.rows.map((r) => r.sector))].sort().map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {(
          [
            ["minPrice", "Minimum price ($)"],
            ["maxPrice", "Maximum price ($)"],
            ["minReturn", "Min. 4-week return (%)"],
            ["maxVolatility", "Max. annualized volatility (%)"],
            ["maxPe", "Maximum positive P/E"],
            ["minGrowth", "Min. revenue growth (%)"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              step="any"
              value={filters[key]}
              onChange={(e) =>
                setFilters({ ...filters, [key]: e.target.value })
              }
            />
          </label>
        ))}
      </div>
      <div className="screen-controls">
        <label>
          <input
            type="checkbox"
            checked={filters.beatsBaseline}
            onChange={(e) =>
              setFilters({ ...filters, beatsBaseline: e.target.checked })
            }
          />{" "}
          Python 1-week model beat the baseline in its test
        </label>
        <button className="text-button" onClick={() => setFilters(initial)}>
          Clear filters
        </button>
      </div>
      <div className="screen-controls">
        <p role="status">
          {data
            ? `${rows.length} of ${data.rows.length} companies`
            : "Loading companies…"}
        </p>
        <label>
          Sort by{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="symbol">Ticker</option>
            <option value="price">Price</option>
            <option value="return4w">4-week return</option>
            <option value="volatility">Volatility</option>
            <option value="pe">P/E</option>
            <option value="revenueGrowth">Revenue growth</option>
            <option value="pythonMae">Python test error</option>
          </select>
        </label>
        <label>
          Order{" "}
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
        <button
          className="secondary-button"
          disabled={!rows.length}
          onClick={exportRows}
        >
          Export results
        </button>
      </div>
      {data && rows.length === 0 ? (
        <p className="empty-state">
          No companies match. Clear a filter or load fundamentals. Missing P/E
          or growth values are excluded when those filters are active.
        </p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Group</th>
                <th>Recorded close</th>
                <th>4-week return</th>
                <th>Annualized volatility</th>
                <th>P/E</th>
                <th>Revenue growth</th>
                <th>Python test error</th>
                <th>Fundamentals</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.symbol}>
                  <th>
                    <button
                      className="text-button"
                      onClick={() => onChoose(r.symbol)}
                    >
                      {r.symbol}
                    </button>
                    <small className="cell-note">{r.name}</small>
                  </th>
                  <td>{r.sector}</td>
                  <td>
                    {r.price === null
                      ? "—"
                      : r.price.toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                        })}
                    <small className="cell-note">
                      {r.priceDate}
                      {r.priceStale ? " · old data" : ""}
                    </small>
                  </td>
                  <td>
                    {pct(r.return4w)}
                    <small className="cell-note">
                      Through {r.indicatorDate || "—"}
                    </small>
                  </td>
                  <td>{pct(r.volatility)}</td>
                  <td>{r.pe === null ? "—" : r.pe.toFixed(2)}</td>
                  <td>
                    {pct(r.revenueGrowth)}
                    <small className="cell-note">
                      {r.fiscalQuarter ? "Quarter " + r.fiscalQuarter : ""}
                    </small>
                  </td>
                  <td>
                    {r.pythonMae === null
                      ? "—"
                      : (r.pythonMae * 100).toFixed(2) + " pp"}
                    <small className="cell-note">{r.pythonAsOf}</small>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      disabled={
                        busy ||
                        (!data?.canLoadFundamentals && r.symbol !== "IBM")
                      }
                      onClick={() => void fundamentals(r.symbol)}
                    >
                      {!data?.canLoadFundamentals && r.symbol !== "IBM"
                        ? "Needs API key"
                        : "Load fundamentals"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted">
        Sector groups are curated broad categories. Returns use completed weeks
        and adjusted prices; volatility is the sample standard deviation of 52
        weekly log returns, annualized by √52. Closing prices may include the
        current partial week. Fundamentals are reported by Alpha Vantage, with
        quarterly revenue growth year over year. Each uncached fundamentals load
        uses one provider request. Missing data is never zero-filled.
      </p>
      <p className="small muted">
        Python test error summarizes 52 historical forecasts, not expected
        investment returns. The baseline filter excludes outdated Python
        forecasts. CSV returns and volatility use fractions, while this table
        displays percentages.
      </p>
    </section>
  );
}
