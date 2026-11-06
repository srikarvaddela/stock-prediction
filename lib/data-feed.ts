import { database } from "@/lib/server";
import { validSnapshot } from "@/lib/feed-validation.mjs";
import { savedHistory } from "@/lib/price-snapshots";
export const FEED_ROOT = "https://raw.githubusercontent.com/srikarvaddela/stock-prediction/market-data/";
// Only public market data is shared; user portfolios, keys and watchlists never enter this cache.
export async function feedFile<T>(path: string, validate:(data:unknown)=>boolean, ttl=3600000):Promise<T|null> {
  const id="shared-feed-v1:"+path, db=database();
  const cached=await db.prepare("SELECT body,expires_at FROM market_cache WHERE id=?").bind(id).first<{body:string;expires_at:number}>();
  let previous:T|null=null;
  try { if(cached) {const d=JSON.parse(cached.body);if(validate(d)) previous=d;} } catch {}
  if(previous && cached!.expires_at>Date.now())return previous;
  try {
    const r=await fetch(FEED_ROOT+path,{signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw Error("Feed unavailable");
    const text=await r.text();if(text.length>6_000_000)throw Error("Feed too large");
    const d=JSON.parse(text);if(!validate(d))throw Error("Invalid feed");
    await db.prepare("INSERT INTO market_cache(id,owner_id,body,expires_at) VALUES(?,'public-market-data',?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,expires_at=excluded.expires_at").bind(id,text,Date.now()+ttl).run();
    return d as T;
  } catch { return previous; }
}
export type MarketSnapshot = NonNullable<ReturnType<typeof savedHistory>> & { actions?:{date:string;type:string;amount?:number;ratio?:number}[];actionsThrough?:string;actionsFrom?:string };
export async function marketHistory(symbol:string):Promise<MarketSnapshot|null> {
  if(!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol))return null;
  const remote=await feedFile<MarketSnapshot>(`prices/${symbol}.json`,d=>validSnapshot(d,symbol));
  const local=savedHistory(symbol);
  return remote && (!local || remote.prices.at(-1)!.date>=local.prices.at(-1)!.date) ? remote : local;
}
