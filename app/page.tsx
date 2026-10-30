"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  LayoutDashboard,
  LineChart,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import type { StockData, PricePoint } from "@/lib/stock-types";
import { ForecastResult, ModelReport } from "@/components/forecast-panel";

type View = "research" | "watchlist" | "model";
const names: Record<string, string> = {
  IBM: "International Business Machines",
  AAPL: "Apple",
  MSFT: "Microsoft",
  NVDA: "NVIDIA",
  GOOGL: "Alphabet",
  AMZN: "Amazon",
};
const money = (v: number | null | undefined, c = "USD") =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: c,
        maximumFractionDigits: 2,
      }).format(v);
const compact = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 2,
      }).format(v);
const pct = (v: number | null | undefined) =>
  v == null ? "—" : `${(v * 100).toFixed(2)}%`;
const date = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

function Chart({ points }: { points: PricePoint[] }) {
  const min = Math.min(...points.map((p) => p.close)),
    max = Math.max(...points.map((p) => p.close));
  const pad = Math.max((max - min) * 0.18, max * 0.01),
    low = min - pad,
    high = max + pad;
  const x = (i: number) => 12 + (i / (points.length - 1)) * 710,
    y = (v: number) => 220 - ((v - low) / (high - low)) * 205;
  const line = points
    .map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.close)}`)
    .join(" ");
  return (
    <svg
      className="price-chart"
      viewBox="0 0 800 260"
      role="img"
      aria-label={`Weekly closing prices from ${date(points[0].date)} to ${date(points.at(-1)!.date)}, minimum ${money(min)}, maximum ${money(max)}`}
    >
      <defs>
        <linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#318c6f" stopOpacity=".18" />
          <stop offset="100%" stopColor="#318c6f" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => {
        const v = low + ((high - low) * i) / 3;
        return (
          <g key={i}>
            <line
              x1="12"
              x2="727"
              y1={y(v)}
              y2={y(v)}
              stroke="#e8ede8"
              strokeDasharray="4 5"
            />
            <text x="743" y={y(v) + 4} className="chart-label">
              {v.toFixed(0)}
            </text>
          </g>
        );
      })}
      <path d={`${line} L722,225 L12,225 Z`} fill="url(#price-fill)" />
      <path
        d={line}
        fill="none"
        stroke="#19846a"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <circle
        cx="722"
        cy={y(points.at(-1)!.close)}
        r="4"
        fill="#19846a"
        stroke="white"
        strokeWidth="2"
      />
      {[0, 0.33, 0.66, 1].map((r) => {
        const i = Math.round((points.length - 1) * r);
        return (
          <text
            key={r}
            x={x(i)}
            y="252"
            textAnchor={r === 0 ? "start" : r === 1 ? "end" : "middle"}
            className="chart-label"
          >
            {date(points[i].date)}
          </text>
        );
      })}
    </svg>
  );
}

export default function Home() {
  const [horizon, setHorizon] = useState(1);
  const [view, setView] = useState<View>("research"),
    [symbol, setSymbol] = useState("IBM"),
    [query, setQuery] = useState("");
  const [data, setData] = useState<StockData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [range, setRange] = useState(52),
    [watchlist, setWatchlist] = useState<string[]>(["IBM"]),
    [ready, setReady] = useState(false);
  const [notice, setNotice] = useState(""),
    [retry, setRetry] = useState(0),
    [help, setHelp] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("stock-prediction-watchlist") || "null",
      );
      if (Array.isArray(saved))
        setWatchlist(
          [
            ...new Set(
              saved.filter(
                (s) =>
                  typeof s === "string" && /^[A-Z][A-Z0-9.-]{0,9}$/.test(s),
              ),
            ),
          ].slice(0, 30),
        );
    } catch {
      setNotice("Watchlist storage is unavailable in this browser.");
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(
          "stock-prediction-watchlist",
          JSON.stringify(watchlist),
        );
      } catch {
        setNotice("Your watchlist could not be saved in this browser.");
      }
  }, [watchlist, ready]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    fetch(
      `/api/stocks?symbol=${encodeURIComponent(symbol)}&horizon=${horizon}`,
      {
        signal: controller.signal,
      },
    )
      .then(async (r) => {
        const result = (await r.json()) as StockData & { error?: string };
        if (!r.ok)
          throw new Error(result.error || "Unable to load this stock.");
        return result as StockData;
      })
      .then((d) => {
        if (!controller.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [symbol, retry, horizon]);
  const choose = (s: string) => {
    setSymbol(s);
    setView("research");
    setQuery("");
  };
  const save = (s: string) => {
    if (!watchlist.includes(s) && watchlist.length >= 30) {
      setNotice(
        "Your watchlist holds up to 30 stocks. Remove one to add another.",
      );
      return;
    }
    setWatchlist((w) => (w.includes(s) ? w.filter((t) => t !== s) : [...w, s]));
  };
  const last = data?.prices.at(-1),
    previous = data?.prices.at(-2),
    change = last && previous ? last.close / previous.close - 1 : 0,
    currency = data?.overview?.currency || "USD";
  const nav = [
    { id: "research" as View, name: "Research", icon: LayoutDashboard },
    { id: "watchlist" as View, name: "Watchlist", icon: Bookmark },
    { id: "model" as View, name: "Model lab", icon: FlaskConical },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Activity size={23} />
          </span>
          <span>
            Stock<span className="brand-second">Prediction</span>
          </span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "selected" : ""}`}
              onClick={() => setView(id)}
            >
              <Icon size={18} />
              {name}
              {id === "watchlist" && (
                <span className="count">{watchlist.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="dot" />
          Built on evidence.
          <br />
          <span className="muted">Not a crystal ball.</span>
          <p>
            Explore the data. Understand the uncertainty. Make your own call.
          </p>
        </div>
        <button
          className="help-button"
          onClick={() => setHelp((h) => !h)}
          aria-expanded={help}
        >
          <CircleHelp size={17} />
          Data & methodology
          <ArrowUpRight size={14} />
        </button>
        <div className="sidebar-footer">
          <span className="avatar">SP</span>
          <div>
            Personal workspace<small>Research edition · v0.1</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace
            <ChevronRight size={13} />
            <strong>{nav.find((n) => n.id === view)?.name}</strong>
          </div>
          <form
            className="search"
            onSubmit={(e) => {
              e.preventDefault();
              const s = query.trim().toUpperCase();
              if (/^[A-Z][A-Z0-9.-]{0,9}$/.test(s)) choose(s);
              else setNotice("Enter a ticker such as IBM, AAPL, or MSFT.");
            }}
          >
            <Search size={17} />
            <input
              aria-label="Search stock ticker"
              placeholder="Search a stock ticker…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={10}
            />
            <button type="submit" aria-label="Search">
              <ArrowRight size={16} />
            </button>
          </form>
          <span className="edition">
            <span className="dot" />
            Research workspace
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">A CLEARER VIEW OF THE MARKET</p>
              <h1>
                {view === "watchlist"
                  ? "Keep your ideas in view."
                  : view === "model"
                    ? "Give every forecast a test."
                    : "Your research, in focus."}
              </h1>
              <p className="subtitle">
                Real companies. Real data. A thoughtful way to explore what
                comes next.
              </p>
            </div>
            <span className="outline-badge">
              <ShieldCheck size={14} />
              Transparent by design
            </span>
          </div>
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
                <X size={16} />
              </button>
            </div>
          )}
          <div className="data-banner">
            <Activity size={17} />
            <div>
              <strong>
                {data && !data.demo
                  ? "Market data connected."
                  : "Start with a real company."}
              </strong>
              <span>
                {data && !data.demo
                  ? " Historical prices from Alpha Vantage, not live quotes."
                  : " IBM is available through the provider’s demo API. Connect a key to explore other tickers."}
              </span>
            </div>
            <button onClick={() => setHelp((h) => !h)} aria-expanded={help}>
              About the data <ArrowUpRight size={15} />
            </button>
          </div>
          {help && (
            <section className="panel help-panel">
              <div className="panel-heading">
                <h2>Know what you’re looking at.</h2>
                <button
                  aria-label="Close data information"
                  onClick={() => setHelp(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <p>
                Weekly prices and company fundamentals come from Alpha Vantage.
                Prices are historical and cached for up to six hours. The latest
                chart point may represent an in-progress week.
              </p>
              <p>
                To research other tickers, configure{" "}
                <code>ALPHA_VANTAGE_API_KEY</code> in the server environment.
                Locally, use an ignored <code>.dev.vars</code> file. Provider
                availability and plan limits apply. Your watchlist stays in this
                browser.
              </p>
              <a
                className="text-button"
                href="https://www.alphavantage.co/support/#api-key"
                target="_blank"
                rel="noreferrer"
              >
                Get a market-data key <ArrowUpRight size={14} />
              </a>
            </section>
          )}
          {view === "watchlist" ? (
            <section className="panel watchlist-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">YOUR SHORTLIST</p>
                  <h2>Watchlist · {watchlist.length}</h2>
                </div>
                <Bookmark size={20} />
              </div>
              <p className="muted">
                Saved on this browser. Open a company to load its research.
              </p>
              {watchlist.length === 0 ? (
                <div className="empty-state">
                  <Bookmark size={28} />
                  <h3>A little room for your next idea.</h3>
                  <p>Search a ticker, then select Save stock.</p>
                  <button
                    className="primary-button"
                    onClick={() => choose("IBM")}
                  >
                    Explore IBM <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                watchlist.map((s) => (
                  <div className="watch-row" key={s}>
                    <span className="ticker-logo">{s.slice(0, 2)}</span>
                    <button className="watch-name" onClick={() => choose(s)}>
                      <strong>{s}</strong>
                      <span>{names[s] || "Company research"}</span>
                    </button>
                    <button className="text-button" onClick={() => choose(s)}>
                      Open research <ArrowUpRight size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${s} from watchlist`}
                      onClick={() => save(s)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))
              )}
            </section>
          ) : (
            <div className="stock-layout">
              <div className="stock-main">
                {view === "model" && <ModelReport data={data} />}
                <section className="panel stock-panel">
                  <div className="panel-heading">
                    <div className="company-heading">
                      <span className="ticker-logo large">
                        {symbol.slice(0, 2)}
                      </span>
                      <div>
                        <div className="stock-title">
                          <h2>{symbol}</h2>
                          <span className="tag">
                            {data?.overview?.exchange || "US equity"}
                          </span>
                        </div>
                        <p>{data?.overview?.name || names[symbol] || symbol}</p>
                      </div>
                    </div>
                    <button
                      className={`save-button ${watchlist.includes(symbol) ? "saved" : ""}`}
                      aria-pressed={watchlist.includes(symbol)}
                      onClick={() => save(symbol)}
                    >
                      {watchlist.includes(symbol) ? (
                        <Check size={15} />
                      ) : (
                        <Star size={15} />
                      )}
                      <span>
                        {watchlist.includes(symbol) ? "Saved" : "Save stock"}
                      </span>
                    </button>
                  </div>
                  {loading ? (
                    <div className="loading-state" aria-live="polite">
                      <Activity size={30} />
                      <h3>Loading real market data</h3>
                      <p>Price history and fundamentals from Alpha Vantage.</p>
                    </div>
                  ) : error ? (
                    <div className="empty-state" role="alert">
                      <Activity size={28} />
                      <h3>We couldn’t load {symbol}.</h3>
                      <p>{error}</p>
                      <div className="button-row">
                        <button
                          className="primary-button"
                          onClick={() => setRetry((r) => r + 1)}
                        >
                          Try again
                        </button>
                        {symbol !== "IBM" && (
                          <button
                            className="secondary-button"
                            onClick={() => choose("IBM")}
                          >
                            Explore IBM
                          </button>
                        )}
                      </div>
                    </div>
                  ) : data && last ? (
                    <>
                      <div className="price-heading">
                        <div>
                          <p className="eyebrow">
                            LATEST WEEKLY OBSERVATION · {currency}
                          </p>
                          <div className="price-line">
                            <strong>{money(last.close, currency)}</strong>
                            <span
                              className={change >= 0 ? "positive" : "negative"}
                            >
                              {change >= 0 ? "+" : ""}
                              {pct(change)}
                            </span>
                          </div>
                          <p className="small muted">
                            {date(last.date)} · versus previous week · not a
                            live quote
                          </p>
                        </div>
                        <div className="range-control" aria-label="Chart range">
                          {[
                            [13, "3M"],
                            [26, "6M"],
                            [52, "1Y"],
                            [260, "5Y"],
                          ].map(([n, label]) => (
                            <button
                              key={n}
                              aria-pressed={range === n}
                              className={range === n ? "active" : ""}
                              onClick={() => setRange(Number(n))}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Chart points={data.prices.slice(-range)} />
                      <div className="chart-footer">
                        <span>
                          <i />
                          Weekly closing price
                        </span>
                        <span>
                          Source: {data.source} ·{" "}
                          {data.demo ? "Provider demo" : "Connected API"}
                        </span>
                      </div>
                    </>
                  ) : null}
                </section>
                {data && (
                  <>
                    <div className="metric-grid">
                      {[
                        {
                          label: "Market cap",
                          value: compact(data.overview?.marketCap),
                          note: currency,
                        },
                        {
                          label: "P/E ratio",
                          value: data.overview?.pe?.toFixed(2) || "—",
                          note: "Trailing earnings",
                        },
                        {
                          label: "Revenue",
                          value: compact(data.overview?.revenue),
                          note: "Trailing 12 months",
                        },
                        {
                          label: "Dividend yield",
                          value: pct(data.overview?.dividendYield),
                          note: "Provider reported",
                        },
                      ].map((m) => (
                        <div className="metric-card" key={m.label}>
                          <p>{m.label}</p>
                          <strong>{m.value}</strong>
                          <small>{m.note}</small>
                        </div>
                      ))}
                    </div>
                    {data.warning && (
                      <p role="status" className="notice">
                        {data.warning}
                      </p>
                    )}
                    <section className="panel company-panel">
                      <div className="panel-heading">
                        <div>
                          <p className="eyebrow">BEHIND THE TICKER</p>
                          <h2>The business at a glance</h2>
                        </div>
                        <span className="tag">
                          {data.overview?.sector || "Company"}
                        </span>
                      </div>
                      <p className="company-description">
                        {data.overview?.description ||
                          "Company details are unavailable from the provider."}
                      </p>
                      <div className="company-details">
                        <div>
                          <span>Earnings per share</span>
                          <strong>{money(data.overview?.eps, currency)}</strong>
                        </div>
                        <div>
                          <span>Profit margin</span>
                          <strong>{pct(data.overview?.profitMargin)}</strong>
                        </div>
                        <div>
                          <span>Beta</span>
                          <strong>
                            {data.overview?.beta?.toFixed(2) || "—"}
                          </strong>
                        </div>
                        <div>
                          <span>Latest fiscal quarter</span>
                          <strong>{data.overview?.latestQuarter || "—"}</strong>
                        </div>
                      </div>
                      <a
                        className="source-link"
                        href="https://www.alphavantage.co/documentation/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Provider methodology & data definitions{" "}
                        <ArrowUpRight size={13} />
                      </a>
                    </section>
                  </>
                )}
              </div>
              <aside className="insight-column">
                <section className="forecast-card">
                  <div className="forecast-top">
                    <span>
                      <Sparkles size={16} />
                      FORECAST LAB
                    </span>
                    <span className="experiment">Experimental</span>
                  </div>
                  <h2>What could come next?</h2>
                  <p className="forecast-copy">
                    A prediction is only useful when you can see how it was
                    tested.
                  </p>
                  <label className="horizon-picker">
                    Forecast horizon
                    <select
                      value={horizon}
                      onChange={(e) => setHorizon(Number(e.target.value))}
                    >
                      <option value={1}>1 week</option>
                      <option value={4}>4 weeks</option>
                    </select>
                  </label>
                  <ForecastResult data={data} loading={loading} />
                  <button
                    className="model-link"
                    onClick={() => setView("model")}
                  >
                    Inspect the backtest <ArrowRight size={14} />
                  </button>
                  <div className="model-footnote">
                    <ShieldCheck size={15} />
                    Experimental model · past performance only.
                  </div>
                </section>
                <section className="panel approach-panel">
                  <span className="section-icon">
                    <LineChart size={20} />
                  </span>
                  <h3>Look beyond a single number.</h3>
                  <p>
                    Price history tells one part of the story. Company
                    fundamentals and forecast uncertainty give it context.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setHelp((h) => !h)}
                  >
                    How this workspace works <ArrowRight size={15} />
                  </button>
                </section>
                <div className="small-print">
                  A research tool for exploring evidence.
                  <br />
                  Forecasts are estimates, never guarantees.
                </div>
              </aside>
            </div>
          )}
          <footer className="main-footer">
            <span>Stock Prediction · Research with perspective.</span>
            <a
              href="https://github.com/srikarvaddela/stock-prediction"
              target="_blank"
              rel="noreferrer"
            >
              View source <ArrowUpRight size={13} />
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
