"use client";
import { useState } from "react";
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
type Result =
  | { kind: "news"; items: News[] }
  | { kind: "earnings"; items: Quarter[] }
  | { kind: "calendar"; items: Event[] };
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
        Load the dataset you want to use. Company news includes source links and
        publisher summaries.
      </p>
      <div className="button-row">
        {[
          ["news", "Latest news"],
          ["earnings", "Reported earnings"],
          ["calendar", "Upcoming dates"],
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
      {result?.items.length === 0 && (
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
      {result && (
        <small className="form-hint">
          Source: Alpha Vantage. Scheduled dates can change.
        </small>
      )}
    </section>
  );
}
