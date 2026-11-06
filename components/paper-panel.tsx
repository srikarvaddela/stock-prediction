"use client";
import { useEffect, useState } from "react";
import type { paperState, paperQuote } from "@/lib/paper-server";
import { quantityUnits, orderAmount } from "@/lib/paper.mjs";
import stockPicker from "@/lib/stock-picker.json";
type State = Awaited<ReturnType<typeof paperState>>;
type Quote = ReturnType<typeof paperQuote>;
type Order = {
  symbol: string;
  side: string;
  quantity: string;
  requestId: string;
  version: number;
  priceDate: string;
  priceCents: number;
};
const money = (c: number | null) =>
  c === null
    ? "—"
    : (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const pct = (n: number | null) =>
  n === null ? "—" : (n * 100).toFixed(2) + "%";
export function PaperPanel() {
  const [state, setState] = useState<State | null>(null),
    [symbol, setSymbol] = useState("AAPL"),
    [side, setSide] = useState("buy"),
    [quantity, setQuantity] = useState("1");
  const [preview, setPreview] = useState<{
      quote: Quote;
      order: Order;
      amount: number;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function refresh() {
    const r = await fetch("/api/paper");
    const d = (await r.json()) as State & { error?: string };
    if (!r.ok) throw new Error(d.error);
    setState(d);
  }
  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, []);
  async function review() {
    if (!state) return;
    setBusy(true);
    setPreview(null);
    setMessage("");
    try {
      const units = quantityUnits(quantity);
      const r = await fetch(
        "/api/paper/quote?symbol=" + encodeURIComponent(symbol),
      );
      const q = (await r.json()) as Quote & { error?: string };
      if (!r.ok) throw new Error(q.error);
      if (q.stale)
        throw new Error(
          "This quote is too old to place an order. Wait for a price-data update.",
        );
      const amount = orderAmount(units, q.priceCents);
      setPreview({
        quote: q,
        amount,
        order: {
          symbol: q.symbol,
          side,
          quantity,
          requestId: crypto.randomUUID(),
          version: state.version,
          priceDate: q.date,
          priceCents: q.priceCents,
        },
      });
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!preview) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview.order),
      });
      const d = (await r.json()) as {
        state: State;
        message: string;
        error?: string;
      };
      if (!r.ok) {
        if (r.status === 409) {
          setPreview(null);
          await refresh();
        }
        throw new Error(d.error);
      }
      setState(d.state);
      setPreview(null);
      setMessage(d.message);
    } catch (e) {
      setMessage(
        (e as Error).message +
          " If confirmation was interrupted, retry the same order to check its status.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel paper-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">PRACTICE WITH VIRTUAL MONEY</p>
          <h2>Paper trading</h2>
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
          Refresh account
        </button>
      </div>
      <p>
        Start with $100,000 in virtual cash. Orders fill at the displayed saved
        close, not a live market price. No real orders are placed.
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {!state ? (
        <p role="status">Loading your paper account…</p>
      ) : (
        <>
          <div className="practice-metrics">
            <div>
              <span>Cash available</span>
              <strong>{money(state.cashCents)}</strong>
            </div>
            <div>
              <span>Account value</span>
              <strong>{money(state.equityCents)}</strong>
            </div>
            <div>
              <span>Account return</span>
              <strong>{pct(state.totalReturn)}</strong>
            </div>
            <div>
              <span>SPY benchmark</span>
              <strong>{pct(state.benchmark?.return ?? null)}</strong>
            </div>
          </div>
          {state.benchmark ? (
            <p className="small muted">
              SPY adjusted-price return from {state.benchmark.from} through{" "}
              {state.benchmark.through}. Account return includes uninvested
              cash. {state.benchmark.stale ? "Benchmark data is old." : ""}
            </p>
          ) : (
            <p className="small muted">
              Benchmark comparison starts when your paper account is opened with
              its first order attempt.
            </p>
          )}
          {state.positions.some((p) => !p.quote || p.quote.stale) && (
            <p className="stale-warning">
              Some valuations are missing or older than seven days. Account
              value is unavailable if a position cannot be priced.
            </p>
          )}
          <form
            className="practice-order"
            onSubmit={(e) => {
              e.preventDefault();
              void review();
            }}
          >
            <label>
              Company
              <select
                value={symbol}
                disabled={busy}
                onChange={(e) => {
                  setSymbol(e.target.value);
                  setPreview(null);
                }}
              >
                {Object.entries(stockPicker).map(([s, n]) => (
                  <option key={s} value={s}>
                    {s} · {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Order
              <select
                value={side}
                disabled={busy}
                onChange={(e) => {
                  setSide(e.target.value);
                  setPreview(null);
                }}
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </label>
            <label>
              Shares
              <input
                required
                inputMode="decimal"
                value={quantity}
                disabled={busy}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setPreview(null);
                }}
              />
            </label>
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? "Working…" : "Review order"}
            </button>
          </form>
          {preview && (
            <div className="paper-review">
              <h3>Review simulated {preview.order.side}</h3>
              <p>
                {preview.order.quantity} shares of {preview.order.symbol} at{" "}
                {money(preview.quote.priceCents)} · {money(preview.amount)}{" "}
                total
              </p>
              <p>
                Recorded close on {preview.quote.date} · {preview.quote.source}.
                Fees, dividends, split adjustments and slippage are excluded.
              </p>
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => void confirm()}
              >
                Confirm virtual {preview.order.side}
              </button>{" "}
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => setPreview(null)}
              >
                Cancel
              </button>
            </div>
          )}
          <h3>Your positions</h3>
          {state.positions.length === 0 ? (
            <p>Your paper account has no shares yet.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Stock</th>
                    <th>Shares</th>
                    <th>Cost</th>
                    <th>Value</th>
                    <th>Unrealized gain</th>
                    <th>Price date</th>
                  </tr>
                </thead>
                <tbody>
                  {state.positions.map((p) => (
                    <tr key={p.symbol}>
                      <th>{p.symbol}</th>
                      <td>{p.quantity}</td>
                      <td>{money(p.costCents)}</td>
                      <td>{money(p.valueCents)}</td>
                      <td>{money(p.unrealizedCents)}</td>
                      <td>{p.quote?.date || "Unavailable"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p>Realized gain/loss: {money(state.realizedCents)}</p>
          <h3>Order history</h3>
          <p className="small muted">
            Latest {state.trades.length} of {state.tradeCount} fills. Positions
            and balances include every order.
          </p>
          {state.trades.length === 0 ? (
            <p>No simulated orders yet.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Placed</th>
                    <th>Order</th>
                    <th>Stock</th>
                    <th>Shares</th>
                    <th>Fill price</th>
                    <th>Total</th>
                    <th>Quote date</th>
                  </tr>
                </thead>
                <tbody>
                  {state.trades.map((t) => (
                    <tr key={t.id}>
                      <td>{t.created_at.slice(0, 19).replace("T", " ")} UTC</td>
                      <td>{t.side}</td>
                      <th>{t.symbol}</th>
                      <td>{t.quantity_units / 1e6}</td>
                      <td>{money(t.price_cents)}</td>
                      <td>{money(t.amount_cents)}</td>
                      <td>{t.price_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <p className="small muted">
        Educational simulation using delayed closing prices. No short selling,
        leverage, automatic corporate-action adjustments, fees or dividends.
        Benchmark returns use adjusted prices, so the comparison differs from a
        fully reinvested trading account.
      </p>
    </section>
  );
}
