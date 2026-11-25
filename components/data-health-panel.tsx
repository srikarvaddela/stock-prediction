"use client";
import {useEffect,useState} from "react";
import type {dataHealth} from "@/lib/data-health.mjs";
type HealthRow={symbol:string;name:string;price:number|null;priceDate:string|null;fetchedAt:string|null;priceAgeDays:number|null;status:string;error:string|null;retained:boolean;retrievalStale:boolean;refreshKnown:boolean};
type Health=Omit<ReturnType<typeof dataHealth>,"rows"> & {rows:HealthRow[];delivery:"remote"|"cache"|"fallback"};
const stamp=(s:string|null)=>s ? new Date(s).toLocaleString("en-US",{timeZone:"UTC"})+" UTC" : "Unknown";
export function DataHealthPanel({onChoose}:{onChoose:(symbol:string)=>void}) {
  const [data,setData]=useState<Health|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0);
  const [query,setQuery]=useState(""),[filter,setFilter]=useState("issues"),[page,setPage]=useState(0);
  useEffect(()=>{
    const c=new AbortController();setData(null);setError("");
    fetch("/api/data-health",{signal:c.signal}).then(async r=>{const body=await r.json() as Health & {error?:string};if(!r.ok)throw Error(body.error || "Could not check data health.");return body;})
      .then(body=>{if(!c.signal.aborted)setData(body);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});
    return ()=>c.abort();
  },[retry]);
  useEffect(()=>setPage(0),[query,filter,retry]);
  const rows=data?.rows.filter(r=>(`${r.symbol} ${r.name}`.toLowerCase().includes(query.trim().toLowerCase())) &&
    (filter==="all" || filter==="issues" && (r.status!=="fresh" || r.error || r.retrievalStale || !r.refreshKnown) || filter==="failed" && r.error || r.status===filter)) ?? [];
  const pages=Math.max(1,Math.ceil(rows.length/100)), current=Math.min(page,pages-1);
  return <section className="panel evidence-panel">
    <div className="panel-heading"><div><p className="eyebrow">KNOW THE AGE OF YOUR DATA</p><h2>Data health</h2></div><button className="secondary-button" onClick={()=>setRetry(r=>r+1)}>Check again</button></div>
    <p>Coverage and failures from the latest published price pipeline. A successful publication can still contain retained histories or missing stocks.</p>
    {error ? <p role="status" className="stale-warning">{error}</p> : !data ? <p role="status">Checking market data…</p> : <>
      {(data.publicationDelayed || data.delivery==="fallback" || data.directoryMismatch) && <p className="stale-warning">{data.publicationDelayed && "The published feed is over 72 hours old or has an invalid future timestamp. "}{data.delivery==="fallback" && "The public feed could not be retrieved; this is a retained cache copy. "}{data.directoryMismatch && "The published row count does not match the directory total. "}Review the pipeline before treating the data as current.</p>}
      <p><strong>Last published feed:</strong> {stamp(data.generatedAt)}<br/><strong>Directory retrieved:</strong> {stamp(data.directoryAsOf)}<br/><strong>Health checked:</strong> {stamp(data.checkedAt)}</p>
      <p className="muted">{data.delivery==="remote" ? "Feed retrieved from the public data branch for this check." : data.delivery==="cache" ? "Validated application cache (up to one hour between feed fetches)." : "Cached feed retained after an unsuccessful fetch."} Checking again does not run the market pipeline.</p>
      <div className="evidence-metrics">
        <div><span>Companies with prices</span><strong>{data.counts.withPrices.toLocaleString()} / {data.counts.total.toLocaleString()}</strong></div>
        <div><span>Stale prices</span><strong>{data.counts.stale.toLocaleString()}</strong></div>
        <div><span>Missing histories</span><strong>{data.counts.missing.toLocaleString()}</strong></div>
        <div><span>Failed price refreshes</span><strong>{data.counts.failed.toLocaleString()}</strong></div>
      </div>
      <p>{data.counts.fresh.toLocaleString()} companies have a price dated within seven calendar days. {data.counts.retained.toLocaleString()} failed refreshes retained a previous history. {data.counts.unknown} priced rows have an unknown observation age; {data.counts.unknownRefresh} rows have no recorded refresh status. {data.counts.oldRetrieval} histories have old or unknown retrieval dates.</p>
      <p>{data.counts.pythonReports.toLocaleString()} companies have a recorded one-week Python report date. This is report availability, not forecast accuracy or a freshness guarantee. SPY is excluded from these company counts.</p>
      <div className="evidence-controls"><label>Search companies<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ticker or company name" /></label><label>Show<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="issues">Needs attention</option><option value="all">All companies</option><option value="failed">Failed refreshes</option><option value="stale">Stale prices</option><option value="missing">Missing histories</option><option value="unknown">Unknown price age</option><option value="fresh">Recent prices</option></select></label></div>
      <p role="status">{rows.length.toLocaleString()} matching companies · Page {current+1} of {pages}</p>
      {!rows.length ? <p>No companies match this filter.</p> : <div className="table-scroll"><table><thead><tr><th>Company</th><th>Price observed</th><th>History retrieved</th><th>Price age</th><th>Last price refresh</th></tr></thead><tbody>{rows.slice(current*100,(current+1)*100).map(r=><tr key={r.symbol}><td><button className="text-button" onClick={()=>onChoose(r.symbol)}>{r.symbol}</button><div>{r.name}</div></td><td>{r.priceDate || "Unknown"}</td><td>{r.fetchedAt?.slice(0,10) || "Unknown"}</td><td>{r.status}{r.priceAgeDays!==null && r.price!==null ? ` · ${Math.floor(r.priceAgeDays)}d` : ""}</td><td>{r.error ? `${r.retained ? "Retained history" : "No history"}: ${r.error}` : r.refreshKnown ? "Succeeded" : "Unknown"}</td></tr>)}</tbody></table></div>}
      <div className="evidence-controls"><button className="secondary-button" disabled={current===0} onClick={()=>setPage(current-1)}>Previous page</button><button className="secondary-button" disabled={current+1>=pages} onClick={()=>setPage(current+1)}>Next page</button></div>
      <p><a className="text-button" href="/api/data-health" download="stock-data-health.json">Download health report</a> · <a className="text-button" href="https://github.com/srikarvaddela/stock-prediction/actions/workflows/market-data.yml" target="_blank" rel="noreferrer">View pipeline runs</a></p>
      <p className="muted">Prices: Yahoo Finance. Company directory: Nasdaq Trader. Scheduled refreshes run at 23:37 UTC on weekdays and 09:37 UTC on Saturday; GitHub may delay them. Prices older than seven calendar days are marked stale, including weekends and holidays. Failed counts refer to the last published attempt, not a provider uptime percentage. News and account-specific fundamentals are outside this report.</p>
    </>}
  </section>;
}
