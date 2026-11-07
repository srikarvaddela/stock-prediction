const number = (value) =>
  value == null ||
  String(value).trim() === "" ||
  !Number.isFinite(Number(value))
    ? null
    : Number(value);
const validDate = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
export function articles(payload, symbol) {
  if (!Array.isArray(payload.feed)) throw new Error("Missing news feed");
  return payload.feed
    .flatMap((item) => {
      if (
        !item?.title ||
        !/^https?:\/\//i.test(item.url) ||
        !Array.isArray(item.ticker_sentiment) ||
        !item.ticker_sentiment.some((t) => t.ticker === symbol)
      )
        return [];
      const stamp = String(item.time_published).match(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/,
      );
      return [
        {
          title: String(item.title),
          url: item.url,
          source: item.source || "Publisher",
          published: stamp
            ? stamp[1] +
              "-" +
              stamp[2] +
              "-" +
              stamp[3] +
              " " +
              stamp[4] +
              ":" +
              stamp[5] +
              " UTC"
            : "Date unavailable",
          summary: String(item.summary || "").slice(0, 500),
        },
      ];
    })
    .slice(0, 10);
}
export function earnings(payload, symbol) {
  if (payload.symbol !== symbol || !Array.isArray(payload.quarterlyEarnings))
    throw new Error("Missing earnings data");
  return payload.quarterlyEarnings
    .filter((r) => validDate(r.reportedDate))
    .slice(0, 8)
    .map((r) => ({
      quarter: r.fiscalDateEnding,
      reported: r.reportedDate,
      eps: number(r.reportedEPS),
      estimate: number(r.estimatedEPS),
      surprise: number(r.surprisePercentage),
    }));
}
export function calendar(csv, symbol, today=new Date().toISOString().slice(0,10)) {
  const rows = [];
  let record = [],
    field = "",
    quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      if (quoted && csv[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      record.push(field);
      field = "";
    } else if (c === "\n" && !quoted) {
      record.push(field.trim());
      rows.push(record);
      record = [];
      field = "";
    } else field += c;
  }
  if (field || record.length) {
    record.push(field.trim());
    rows.push(record);
  }
  const headers = rows.shift() || [],
    si = headers.indexOf("symbol"),
    di = headers.indexOf("reportDate");
  if (si < 0 || di < 0 || rows.some((r) => r.length > 1 && !validDate(r[di])))
    throw new Error("Calendar unavailable");
  return rows
    .filter((r) => r[si] === symbol && validDate(r[di]) && r[di]>=today)
    .map((r) => ({
      date: r[di],
      quarter: r[headers.indexOf("fiscalDateEnding")],
      estimate: number(r[headers.indexOf("estimate")]),
      currency: r[headers.indexOf("currency")],
    }));
}

function xmlText(text) {
  return text.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1").replace(/&#(x[\da-f]+|\d+);/gi,(_,code)=>{const n=code[0].toLowerCase()==="x"?parseInt(code.slice(1),16):Number(code);return n>0&&n<=0x10ffff?String.fromCodePoint(n):"";}).replace(/&(amp|lt|gt|quot|apos);/g,(_,key)=>({amp:"&",lt:"<",gt:">",quot:'"',apos:"'"}[key])).trim();
}
export function rssHeadlines(xml) {
  if(typeof xml!=="string" || xml.length>1_000_000 || !xml.includes("<rss"))throw Error("Invalid news feed");
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)].flatMap(match=>{
    const field=tag=>xmlText(match[1].match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`))?.[1]||"");
    const title=field("title"),url=field("link"),published=field("pubDate");
    if(!title || !/^https:\/\//i.test(url))return [];
    let source;try{source=new URL(url).hostname.replace(/^www\./,"");}catch{return [];}
    return [{title:title.slice(0,300),url,source,published:Number.isFinite(Date.parse(published))?new Date(published).toISOString():"Date unavailable",summary:""}];
  }).slice(0,10);
}

export function financialSummary(income,balance,cash,symbol) {
  if(income?.symbol!==symbol || !Array.isArray(income.quarterlyReports))throw Error("Matching income statement unavailable");
  const reports=income.quarterlyReports.filter(r=>validDate(r.fiscalDateEnding)).sort((a,b)=>b.fiscalDateEnding.localeCompare(a.fiscalDateEnding));
  const latest=reports[0];if(!latest)throw Error("No quarterly statements");
  const quarter=latest.fiscalDateEnding,currency=latest.reportedCurrency;
  const matching=payload=>payload?.symbol===symbol && Array.isArray(payload.quarterlyReports)?payload.quarterlyReports.find(r=>r.fiscalDateEnding===quarter&&r.reportedCurrency===currency):null;
  const b=matching(balance),c=matching(cash);
  const previous=reports.find(r=>r.reportedCurrency===currency && Math.abs((Date.parse(quarter)-Date.parse(r.fiscalDateEnding))/86400000-365)<=14);
  const revenue=number(latest.totalRevenue),prior=number(previous?.totalRevenue),netIncome=number(latest.netIncome),operatingIncome=number(latest.operatingIncome),operatingCash=number(c?.operatingCashflow),capex=number(c?.capitalExpenditures),assets=number(b?.totalAssets),liabilities=number(b?.totalLiabilities),currentAssets=number(b?.totalCurrentAssets),currentLiabilities=number(b?.totalCurrentLiabilities);
  return {quarter,currency,revenue,netIncome,operatingIncome,operatingCash,capitalExpenditures:capex,freeCashFlow:operatingCash!==null&&capex!==null?operatingCash-Math.abs(capex):null,assets,liabilities,cash:number(b?.cashAndCashEquivalentsAtCarryingValue),revenueGrowth:revenue!==null&&prior!==null&&prior>0?revenue/prior-1:null,netMargin:netIncome!==null&&revenue!==null&&revenue>0?netIncome/revenue:null,currentRatio:currentAssets!==null&&currentLiabilities!==null&&currentLiabilities>0?currentAssets/currentLiabilities:null,missing:[...(!b?["Balance sheet for this quarter"]:[]),...(!c?["Cash-flow statement for this quarter"]:[])],history:reports.slice(0,8).map(r=>({quarter:r.fiscalDateEnding,currency:r.reportedCurrency,revenue:number(r.totalRevenue),netIncome:number(r.netIncome)}))};
}
