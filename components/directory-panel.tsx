"use client";
import { useEffect, useState } from "react";
type Result = { rows:{symbol:string;name:string;exchange:string}[];total:number;universe:number;fetchedAt:string };
export function DirectoryPanel({onChoose}:{onChoose:(symbol:string)=>void}) {
  const [query,setQuery]=useState(""), [exchange,setExchange]=useState(""), [page,setPage]=useState(0), [data,setData]=useState<Result|null>(null), [error,setError]=useState("");
  useEffect(()=>{
    const c=new AbortController();setData(null);setError("");
    const timer=setTimeout(()=>{fetch(`/api/directory?q=${encodeURIComponent(query)}&exchange=${encodeURIComponent(exchange)}&page=${page}`,{signal:c.signal}).then(async r=>{const d=await r.json() as Result & {error?:string};if(!r.ok)throw Error(d.error);return d;}).then(d=>{if(!c.signal.aborted)setData(d);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});},200);
    return ()=>{clearTimeout(timer);c.abort();};
  },[query,exchange,page]);
  return <section className="panel"><p className="eyebrow">BEYOND THE BIG NAMES</p><h2>Company directory</h2><p>Search U.S. exchange-listed company shares and ADRs, including smaller companies. Listings do not guarantee available prices or enough history for a forecast. OTC stocks, funds, warrants, units, and preferred shares are excluded.</p>
    <div className="screen-filters"><label>Company or ticker<input value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="e.g. Rocket Lab, SOFI, HIMS" /></label><label>Exchange<select value={exchange} onChange={e=>{setExchange(e.target.value);setPage(0);}}><option value="">All exchanges</option>{["NASDAQ","NYSE","NYSE American","NYSE Arca","Cboe","IEX"].map(e=><option key={e}>{e}</option>)}</select></label></div>
    <p role="status">{error || (data ? `${data.total.toLocaleString()} matches · ${data.universe.toLocaleString()} listings · directory retrieved ${data.fetchedAt.slice(0,10)}` : "Loading directory…")}</p>
    <div className="table-scroll"><table><thead><tr><th>Ticker</th><th>Company</th><th>Exchange</th><th>Research</th></tr></thead><tbody>{data?.rows.map(r=><tr key={r.symbol}><th>{r.symbol}</th><td>{r.name}</td><td>{r.exchange}</td><td><button className="text-button" onClick={()=>onChoose(r.symbol)}>Open stock →</button></td></tr>)}</tbody></table></div>
    <div className="screen-controls"><button className="secondary-button" disabled={!page} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1}</span><button className="secondary-button" disabled={!data || (page+1)*50>=data.total} onClick={()=>setPage(p=>p+1)}>Next</button></div><p className="small muted">Source: <a href="https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs" target="_blank" rel="noreferrer">Nasdaq Trader</a>. Company size is not inferred from share price.</p></section>;
}
