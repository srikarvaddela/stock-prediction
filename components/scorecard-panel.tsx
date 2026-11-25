"use client";
import { useEffect, useState } from "react";
import type { forwardScorecard } from "@/lib/forward-scorecard.mjs";
type Scorecard = ReturnType<typeof forwardScorecard> & {symbol:string};
const pp = (n:number|null) => n === null ? "—" : `${(n*100).toFixed(2)} pp`;
const pct = (n:number|null) => n === null ? "—" : `${(n*100).toFixed(2)}%`;

export function ScorecardPanel({symbol}:{symbol:string}) {
  const [ticker,setTicker]=useState(symbol), [draft,setDraft]=useState(symbol), [horizon,setHorizon]=useState(1);
  const [data,setData]=useState<Scorecard|null>(null), [error,setError]=useState(""), [retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController(); setData(null); setError("");
    fetch(`/api/scorecard?symbol=${encodeURIComponent(ticker)}&horizon=${horizon}`,{signal:controller.signal})
      .then(async r=>{const body=await r.json() as Scorecard & {error?:string};if(!r.ok)throw Error(body.error || "Could not load the scorecard.");return body;})
      .then(body=>{if(!controller.signal.aborted)setData(body);})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return ()=>controller.abort();
  },[ticker,horizon,retry]);
  const score=data?.evaluation;
  return <section className="panel evidence-panel">
    <p className="eyebrow">RECORDED BEFORE THE OUTCOME</p>
    <h2>Live model scorecard</h2>
    <p>See how scheduled Python forecasts performed after they were saved. Outcomes update after the target week finishes; prices are not streamed live.</p>
    <form className="evidence-controls" onSubmit={e=>{e.preventDefault();setTicker(draft.trim().toUpperCase());setRetry(r=>r+1);}}>
      <label>Ticker<input value={draft} maxLength={10} required pattern="[A-Za-z][A-Za-z0-9.\-]{0,9}" onChange={e=>setDraft(e.target.value)} /></label>
      <label>Forecast horizon<select value={horizon} onChange={e=>setHorizon(Number(e.target.value))}><option value={1}>1 week</option><option value={4}>4 weeks</option></select></label>
      <button className="primary-button" type="submit">Load scorecard</button>
    </form>
    {error ? <div role="status"><p>{error}</p><button className="secondary-button" onClick={()=>setRetry(r=>r+1)}>Try again</button></div> : !data || !score ? <p role="status">Loading forward results…</p> : <>
      <h3>{data.symbol} · {horizon}-week forecasts</h3>
      <div className="evidence-metrics">
        <div><span>Settled forecasts</span><strong>{score.count}</strong></div>
        <div><span>Pending</span><strong>{data.pending}</strong></div>
        <div><span>Awaiting overdue outcomes</span><strong>{data.overdue}</strong></div>
        <div><span>Excluded records</span><strong>{data.excluded}</strong></div>
      </div>
      <div className="table-scroll"><table><thead><tr><th>Forward result</th><th>Value</th></tr></thead><tbody>
        <tr><th>Model mean absolute return error</th><td>{pp(score.mae)}</td></tr>
        <tr><th>No-change mean absolute return error</th><td>{pp(score.baselineMae)}</td></tr>
        <tr><th>Error improvement (positive is better)</th><td>{pp(score.improvement)}</td></tr>
        <tr><th>Forecasts with lower error / tied</th><td>{data.wins} / {data.ties} of {score.count}</td></tr>
      </tbody></table></div>
      <p className="model-verdict">{score.count === 0 ? "No settled forward performance yet." : score.improvement! > 0 ? "The model has lower average error in this forward sample." : score.improvement! < 0 ? "No change has lower average error in this forward sample." : "The model and no change have equal average error in this forward sample."}</p>
      <p>{score.verdict}. {score.interval ? `95% moving-block bootstrap interval for improvement: ${pp(score.interval.low)} to ${pp(score.interval.high)}.` : "At least 26 settled forecasts are needed for the uncertainty interval."}</p>
      {data.overdue > 0 && <p className="stale-warning">{data.overdue} forecasts have ended target weeks but no verified outcome yet. They are excluded from the error metrics until settlement.</p>}
      <p className="muted">First saved: {data.firstSavedAt?.slice(0,10) || "None"} · Latest saved: {data.lastSavedAt?.slice(0,10) || "None"}. Up to 104 retained forecasts per ticker and horizon. Pending and excluded records never count as successful predictions.</p>
      <details><summary>Results by period</summary><div className="table-scroll"><table><thead><tr><th>Origins</th><th>Forecasts</th><th>Model error</th><th>No-change error</th></tr></thead><tbody>{score.periods.map((p,i)=><tr key={i}><td>{p.from} – {p.to}</td><td>{p.count}</td><td>{pp(p.mae)}</td><td>{pp(p.baselineMae)}</td></tr>)}</tbody></table></div></details>
      <h3>Saved forecasts</h3>
      {!data.records.length ? <p>No eligible forecasts have been recorded yet.</p> : <div className="table-scroll"><table><thead><tr><th>Saved (UTC)</th><th>Target week</th><th>Model</th><th>Forecast return</th><th>Observed return</th><th>Status</th></tr></thead><tbody>{[...data.records].reverse().map(r=><tr key={r.asOf}><td>{r.createdAt.slice(0,10)}</td><td>{r.target}</td><td>{r.modelId}</td><td>{pct(r.predictedReturn)}</td><td>{pct(r.actualReturn)}</td><td>{r.status}</td></tr>)}</tbody></table></div>}
      <p><a className="text-button" download={`${data.symbol}-${horizon}w-forward.json`} href={`/api/scorecard?symbol=${encodeURIComponent(data.symbol)}&horizon=${horizon}`}>Download scorecard JSON</a></p>
      <p className="muted">No change predicts zero adjusted return. Errors are percentage points, not investment returns. The selected model can change between origins. Overlapping horizons and revised adjusted prices limit interpretation; a small forward sample cannot establish future profitability. This scorecard covers scheduled Python models, separate from your personal Forecast log.</p>
    </>}
  </section>;
}
