"use client";
import { useState } from "react";
import type { financialSummary } from "@/lib/research.mjs";
type News = {
  title: string;
  url: string;
  source: string;
  published: string;
  summary: string;
};
type Quarter = {
  quarter: string;
  reported: string;
  eps: number | null;
  estimate: number | null;
  surprise: number | null;
};
type Event = {
  date: string;
  quarter: string;
  estimate: number | null;
  currency: string;
};
type Result = ({source:string;fetchedAt?:string;warning?:string} & (
  | { kind: "news"; items: News[] }
  | { kind: "earnings"; items: Quarter[] }
  | { kind: "calendar"; items: Event[] }
  | {kind:"financials";financials:ReturnType<typeof financialSummary>}));
const money=(n:number|null,currency:string)=>n===null?"Unavailable":`${n.toLocaleString("en-US",{maximumFractionDigits:0})} ${currency}`;
export function ResearchFeed({ symbol }: { symbol: string }) {
  const [result, setResult] = useState<Result | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load(kind: string) {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch(
        "/api/research?symbol=" + encodeURIComponent(symbol) + "&kind=" + kind,
      );
      const d = (await r.json()) as Result & { error?: string };
      if (!r.ok) throw new Error(d.error);
      setResult(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel company-panel">
      <p className="eyebrow">EVENTS & REPORTING</p>
      <h2>News and earnings for {symbol}</h2>
      <p className="form-hint">
        Public news headlines work without a key. Reported earnings, expected dates,
        and financial statements use your Alpha Vantage connection (IBM has demo reports).
        A financial summary uses up to three uncached provider requests.
      </p>
      <div className="button-row">
        {[
          ["news", "Latest news"],
          ["earnings", "Reported earnings"],
          ["calendar", "Upcoming dates"],
          ["financials", "Financial summary"],
        ].map(([key, label]) => (
          <button
            className="secondary-button"
            disabled={busy}
            key={key}
            onClick={() => load(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {busy && <p role="status">Loading…</p>}
      {error && (
        <p className="notice" role="status">
          {error}
        </p>
      )}
      {result && "items" in result && result.items.length === 0 && (
        <p className="form-hint">The provider returned no matching entries.</p>
      )}
      {result?.kind === "news" &&
        result.items.map((n) => (
          <article className="feed-item" key={n.url}>
            <small>
              {n.source} · {n.published}
            </small>
            <h3>
              <a href={n.url} target="_blank" rel="noreferrer">
                {n.title} ↗
              </a>
            </h3>
            <p>{n.summary}</p>
          </article>
        ))}
      {result?.kind === "earnings" && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Quarter end</th>
                <th>Reported</th>
                <th>EPS</th>
                <th>Estimate</th>
                <th>Surprise</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((r) => (
                <tr key={r.quarter}>
                  <th>{r.quarter}</th>
                  <td>{r.reported}</td>
                  <td>{r.eps ?? "—"}</td>
                  <td>{r.estimate ?? "—"}</td>
                  <td>
                    {r.surprise == null ? "—" : r.surprise.toFixed(1) + "%"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result?.kind === "calendar" &&
        result.items.map((e) => (
          <p key={e.date} className="section-copy">
            Expected report on {e.date} for quarter ending {e.quarter}. EPS
            estimate {e.estimate ?? "—"} {e.currency}.
          </p>
        ))}
      {result?.kind==="financials" && <div>
        <h3>Quarter ending {result.financials.quarter}</h3>
        <p>A factual summary of reported figures. Each statement must match the same quarter and currency; missing figures stay unavailable. Loading this summary uses up to three uncached provider requests.</p>
        {result.financials.missing.length>0 && <p className="notice">Unavailable: {result.financials.missing.join("; ")}.</p>}
        <div className="table-scroll"><table><tbody>{([
          ["Revenue",money(result.financials.revenue,result.financials.currency)],
          ["Revenue growth versus same quarter last year",result.financials.revenueGrowth===null?"Unavailable":(result.financials.revenueGrowth*100).toFixed(2)+"%"],
          ["Net income",money(result.financials.netIncome,result.financials.currency)],
          ["Net margin",result.financials.netMargin===null?"Unavailable":(result.financials.netMargin*100).toFixed(2)+"%"],
          ["Operating cash flow",money(result.financials.operatingCash,result.financials.currency)],
          ["Free cash flow (operating cash minus capital expenditures)",money(result.financials.freeCashFlow,result.financials.currency)],
          ["Cash and equivalents",money(result.financials.cash,result.financials.currency)],
          ["Total assets",money(result.financials.assets,result.financials.currency)],
          ["Total liabilities",money(result.financials.liabilities,result.financials.currency)],
          ["Current assets / current liabilities",result.financials.currentRatio===null?"Unavailable":result.financials.currentRatio.toFixed(2)+"×"]
        ]).map(([label,value])=><tr key={label}><th>{label}</th><td>{value}</td></tr>)}</tbody></table></div>
        <h3>Recent quarterly trend</h3><div className="table-scroll"><table><thead><tr><th>Quarter</th><th>Revenue</th><th>Net income</th></tr></thead><tbody>{result.financials.history.map((r:{quarter:string;currency:string;revenue:number|null;netIncome:number|null})=><tr key={r.quarter}><th>{r.quarter}</th><td>{money(r.revenue,r.currency)}</td><td>{money(r.netIncome,r.currency)}</td></tr>)}</tbody></table></div>
      </div>}
      {result && (
        <small className="form-hint">
          Source: {result.source}. Loaded {result.fetchedAt?.slice(0,16).replace("T"," ") || "date unavailable"} UTC; statement dates are shown separately. Expected earnings dates can change. {result.warning}
        </small>
      )}
    </section>
  );
}
