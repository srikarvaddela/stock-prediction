import { validSymbol, parseWeekly, parseOverview } from "@/lib/market.mjs";
import { forecast } from "@/lib/forecast.mjs";
import { HttpError } from "@/lib/server";
import { credentials, providerQuery } from "@/lib/provider";
import type { StockData, PricePoint, Overview } from "@/lib/stock-types";
import { publicPrices } from "@/lib/public-prices";
import { stockSymbol } from "@/lib/company-search.mjs";
export async function loadStock(owner:string,input:string,horizon=1):Promise<StockData> {
  const symbol=stockSymbol(input);
  if(!validSymbol(symbol))throw new HttpError(400,"Enter a valid stock ticker.");
  if(![1,4].includes(horizon))throw new HttpError(400,"Choose a one- or four-week horizon.");
  const creds=await credentials(owner);
  let prices:PricePoint[],overview:Overview|null=null,source="Alpha Vantage",fetchedAt=new Date().toISOString(),warning="";
  async function publicHistory(){
    const data=await publicPrices(owner,symbol);
    prices=data.prices;overview=data.overview;fetchedAt=data.fetchedAt;
    source=data.snapshot?"Yahoo Finance · saved history":"Yahoo Finance";
    warning+=(data.snapshot?`Showing saved history through ${data.prices.at(-1)!.date}. `:"");
  }
  if(creds.demo){await publicHistory();warning+="Connect Alpha Vantage in Settings for additional fundamentals and earnings.";}
  else {
    try{prices=parseWeekly(await providerQuery(owner,creds,"TIME_SERIES_WEEKLY_ADJUSTED",{symbol}));}
    catch{warning="Your connected price dataset is unavailable; using the public history feed. ";await publicHistory();}
  }
  if(!creds.demo || symbol==="IBM"){
    try{overview=parseOverview(await providerQuery(owner,creds,"OVERVIEW",{symbol},86400000),symbol) || overview;}
    catch(e){warning+=" "+(e instanceof HttpError?e.message:"Company fundamentals are unavailable.");}
  }
  let model=null;
  try{model=forecast(prices!,new Date(),horizon);}catch{warning+=" A forecast cannot be safely computed from this history.";}
  return {symbol,prices:prices!,overview,forecast:model,source,demo:creds.demo,fetchedAt,warning:warning||null};
}
