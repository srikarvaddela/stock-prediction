import { database, HttpError } from "@/lib/server";
import { rssHeadlines } from "@/lib/research.mjs";
import { feedFile } from "@/lib/data-feed";
export async function publicNews(symbol:string) {
  const id="public-news:"+symbol,db=database();
  const cached=await db.prepare("SELECT body,expires_at FROM market_cache WHERE id=?").bind(id).first<{body:string;expires_at:number}>();
  if(cached&&cached.expires_at>Date.now())return JSON.parse(cached.body);
  const scheduled=await feedFile<{symbol:string;kind:string;source:string;fetchedAt:string;items:unknown[]}>(`news/${symbol}.json`,d=>!!d && (d as {symbol:string}).symbol===symbol && Array.isArray((d as {items:unknown[]}).items));
  if(scheduled)return {...scheduled,warning:Date.now()-Date.parse(scheduled.fetchedAt)>2*86400000?"News update is older than two days.":undefined};
  try {
    const r=await fetch(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`,{signal:AbortSignal.timeout(12000)});
    if(!r.ok)throw Error("Unavailable");
    const data={symbol,kind:"news",source:"Yahoo Finance RSS · publisher links",fetchedAt:new Date().toISOString(),items:rssHeadlines(await r.text())};
    await db.prepare("INSERT INTO market_cache(id,owner_id,body,expires_at) VALUES(?,'public-market-data',?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,expires_at=excluded.expires_at").bind(id,JSON.stringify(data),Date.now()+3600000).run();
    return data;
  }catch{
    if(cached)return {...JSON.parse(cached.body),warning:"News refresh failed; showing previously retrieved headlines."};
    throw new HttpError(502,"The public news feed is unavailable for this company. Try again later or connect Alpha Vantage in Settings.");
  }
}
