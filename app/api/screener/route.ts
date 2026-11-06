import {
  identity,
  privateJson,
  failure,
  HttpError,
  database,
  jsonBody,
} from "@/lib/server";
import catalog from "@/lib/stock-picker.json";
import sectors from "@/lib/stock-sectors.json";
import { savedHistory } from "@/lib/price-snapshots";
import { pythonForecast } from "@/lib/python-forecasts";
import { credentials, providerQuery } from "@/lib/provider";
import { parseOverview } from "@/lib/market.mjs";
import { stockSymbol } from "@/lib/company-search.mjs";
import { screenMetrics } from "@/lib/screener.mjs";
import { feedFile } from "@/lib/data-feed";
import { validSymbol } from "@/lib/market.mjs";
type FeedIndex={generatedAt:string;total:number;available:number;rows:{symbol:string;name:string;exchange:string;price:number|null;priceDate:string|null;return4w:number|null;volatility:number|null;indicatorDate:string|null;pythonMae?:number;pythonBaselineMae?:number;pythonAsOf?:string;pythonTarget?:string}[]};
export async function GET() {
  try {
    const owner = await identity();
    const tickers = Object.keys(catalog);
    let canLoadFundamentals = false,
      connectionMessage = "";
    const overviews = new Map<
      string,
      NonNullable<ReturnType<typeof parseOverview>>
    >();
    try {
      const creds = await credentials(owner);
      canLoadFundamentals = !creds.demo;
      const cached=await database().prepare("SELECT body FROM market_cache WHERE owner_id=? AND substr(id,1,?)=? AND expires_at>?").bind(owner,`${owner}:${creds.fingerprint}:OVERVIEW:`.length,`${owner}:${creds.fingerprint}:OVERVIEW:`,Date.now()).all<{body:string}>();
      for(const row of cached.results){const raw=JSON.parse(row.body);if(validSymbol(raw.Symbol)){const overview=parseOverview(raw,raw.Symbol);if(overview)overviews.set(raw.Symbol,overview);}}
    } catch {
      connectionMessage =
        "Cached fundamentals could not load. Price-based filters are still available.";
    }
    const rows = Object.entries(catalog).map(([symbol, name]) => {
      const snapshot = savedHistory(symbol),
        last = snapshot?.prices.at(-1),
        overview = overviews.get(symbol),
        python = pythonForecast(symbol, 1);
      return {
        symbol,
        name,
        sector: (sectors as Record<string, string>)[symbol],
        price: last?.close ?? null,
        priceDate: last?.date ?? null,
        priceStale:
          !last ||
          Date.now() - Date.parse(last.date + "T00:00:00Z") > 7 * 86400000,
        source: "Yahoo Finance · saved history",
        ...screenMetrics(snapshot?.prices ?? []),
        pe: overview?.pe ?? null,
        revenueGrowth: overview?.revenueGrowth ?? null,
        fiscalQuarter: overview?.latestQuarter ?? null,
        pythonMae: python?.mae ?? null,
        pythonAsOf: python?.asOf ?? null,
        pythonBeatsBaseline:
          !!python &&
          !python.outdated &&
          !python.stale &&
          python.mae < python.baselineMae,
      };
    });
    const feed=await feedFile<FeedIndex>("index.json",d=>!!d && Array.isArray((d as FeedIndex).rows) && (d as FeedIndex).rows.every(r=>validSymbol(r.symbol) && typeof r.name==="string"));
    const expanded=feed?.rows.map(r=>{
      const overview=overviews.get(r.symbol);
      return {...r,sector:overview?.sector || (sectors as Record<string,string>)[r.symbol] || "Unclassified",source:"Yahoo Finance · scheduled history",priceStale:!r.priceDate || Date.now()-Date.parse(r.priceDate+"T00:00:00Z")>7*86400000,pe:overview?.pe??null,marketCap:overview?.marketCap??null,revenueGrowth:overview?.revenueGrowth??null,fiscalQuarter:overview?.latestQuarter??null,pythonMae:r.pythonMae??null,pythonAsOf:r.pythonAsOf??null,pythonBeatsBaseline:r.pythonMae!==undefined && r.pythonBaselineMae!==undefined && r.pythonMae<r.pythonBaselineMae && !!r.pythonAsOf && Date.now()-Date.parse(r.pythonAsOf+"T00:00:00Z")<14*86400000 && !!r.pythonTarget && r.pythonTarget>=new Date().toISOString().slice(0,10)};
    });
    return privateJson({ rows:expanded?.length ? expanded : rows, canLoadFundamentals, connectionMessage, generatedAt:feed?.generatedAt??null, available:feed?.available??rows.length });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const owner = await identity(request),
      body = await jsonBody(request),
      symbol = stockSymbol(typeof body.symbol === "string" ? body.symbol : "");
    if (!validSymbol(symbol))
      throw new HttpError(400, "Choose a valid company ticker.");
    const creds = await credentials(owner);
    if (creds.demo && symbol !== "IBM")
      throw new HttpError(
        409,
        "Connect Alpha Vantage in Settings to load company fundamentals.",
      );
    const overview = parseOverview(
      await providerQuery(owner, creds, "OVERVIEW", { symbol }, 86400000),
      symbol,
    );
    if (!overview)
      throw new HttpError(
        502,
        "The provider did not return matching company fundamentals.",
      );
    return privateJson({ symbol, message: "Reported fundamentals loaded." });
  } catch (e) {
    return failure(e);
  }
}
