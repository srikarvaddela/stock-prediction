import {mkdir,readFile,writeFile,copyFile,access} from "node:fs/promises";
import {weeklyHistory} from "../lib/public-history.mjs";
import {validSnapshot} from "../lib/feed-validation.mjs";
import {screenMetrics} from "../lib/screener.mjs";
import {rssHeadlines} from "../lib/research.mjs";
const shard=Number(process.env.FEED_SHARD||0), shards=Number(process.env.FEED_SHARDS||1);
const directory=JSON.parse(await readFile("feed-directory.json","utf8"));
const rows=[...directory.rows,{symbol:"SPY",name:"SPDR S&P 500 ETF",exchange:"NYSE Arca"}].filter((_,i)=>i%shards===shard);
const limit=Number(process.env.FEED_LIMIT||rows.length);
await mkdir("feed/prices",{recursive:true});await mkdir("feed/models",{recursive:true});await mkdir("feed/records",{recursive:true});
await mkdir("feed/news",{recursive:true});
const status=[];
let cursor=0, consecutiveLimits=0;
async function worker(){while(cursor<Math.min(rows.length,limit)){
 const row=rows[cursor++],symbol=row.symbol;let data=null,error=null;
 try {data=JSON.parse(await readFile(`.feed-base/prices/${symbol}.json`,"utf8"));if(!validSnapshot(data,symbol))data=null;}catch{}
 try {
   // Back off instead of repeatedly hammering a limited provider.
   if(consecutiveLimits>=8)throw Error("Provider rate limit: retained previous history");
   const r=await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=10y&interval=1d&includeAdjustedClose=true&events=div%2Csplits`,{signal:AbortSignal.timeout(15000)});
   if(r.status===429){consecutiveLimits++;await new Promise(r=>setTimeout(r,2000));throw Error("Provider rate limit");}
   if(!r.ok)throw Error(`Price HTTP ${r.status}`);
   const raw=await r.json(),series=raw.chart?.result?.[0];
   const normalized=weeklyHistory(raw,symbol);
   const day=t=>new Date(t*1000).toLocaleDateString("en-CA",{timeZone:"America/New_York"});
   const actions=[...Object.values(series.events?.dividends||{}).map(e=>({type:"dividend",date:day(e.date),amount:e.amount})),...Object.values(series.events?.splits||{}).map(e=>({type:"split",date:day(e.date),ratio:e.numerator/e.denominator}))].sort((a,b)=>a.date.localeCompare(b.date)||a.type.localeCompare(b.type));
   data={symbol,...normalized,fetchedAt:new Date().toISOString(),actions,actionsFrom:day(series.timestamp[0]),actionsThrough:normalized.prices.at(-1).date};
   if(!validSnapshot(data,symbol))throw Error("Malformed history");
   consecutiveLimits=0;
 }catch(e){error=e.message;}
 if(data)await writeFile(`feed/prices/${symbol}.json`,JSON.stringify(data));
 try {
   const r=await fetch(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`,{signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error("News unavailable");
   await writeFile(`feed/news/${symbol}.json`,JSON.stringify({symbol,kind:"news",source:"Yahoo Finance RSS · publisher links",fetchedAt:new Date().toISOString(),items:rssHeadlines(await r.text())}));
 }catch{try{await copyFile(`.feed-base/news/${symbol}.json`,`feed/news/${symbol}.json`);}catch{}}
 for(const h of [1,4]){for(const folder of ["models","records"]){try{await copyFile(`.feed-base/${folder}/${symbol}-${h}.json`,`feed/${folder}/${symbol}-${h}.json`);}catch{}}}
 const last=data?.prices.at(-1);
 status.push({...row,price:last?.close??null,priceDate:last?.date??null,fetchedAt:data?.fetchedAt??null,...screenMetrics(data?.prices??[]),error});
 if(status.length%50===0)console.log(`Shard ${shard}: ${status.length}/${Math.min(limit,rows.length)}`);
 await new Promise(r=>setTimeout(r,100));
}}
await Promise.all([worker(),worker()]);
await writeFile(`feed/status-${shard}.json`,JSON.stringify(status));
console.log(JSON.stringify({shard,attempted:status.length,available:status.filter(s=>s.price!==null).length,failed:status.filter(s=>s.error).length}));
