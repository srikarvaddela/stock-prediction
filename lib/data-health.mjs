const DAY=86400000;
const timestamp=value=>typeof value === "string" && Number.isFinite(Date.parse(value));
const date=value=>timestamp(value) && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0,10)===value;
export function validHealthIndex(data) {
  return !!data && timestamp(data.generatedAt) && Number.isInteger(data.total) && data.total >= 0 &&
    Array.isArray(data.rows) && data.rows.length<=20000 && new Set(data.rows.map(r=>r?.symbol)).size===data.rows.length &&
    data.rows.every(r=>r && /^[A-Z][A-Z0-9.-]{0,9}$/.test(r.symbol) && typeof r.name === "string" &&
      (r.price === null || (Number.isFinite(r.price) && r.price>0)) && (r.error == null || typeof r.error === "string"));
}

export function dataHealth(index, now=new Date()) {
  const current=now.getTime();
  const age=value=>timestamp(value) && Date.parse(value)<=current ? (current-Date.parse(value))/DAY : null;
  const rows=index.rows.filter(r=>r.symbol!=="SPY").map(r=>{
    const priceAge=date(r.priceDate) ? age(r.priceDate) : null;
    const fetchedAge=age(r.fetchedAt);
    const status=r.price===null ? "missing" : priceAge===null ? "unknown" : priceAge>7 ? "stale" : "fresh";
    const error=typeof r.error === "string" && r.error ? r.error.slice(0,240) : null;
    return {symbol:r.symbol,name:r.name,price:r.price,priceDate:date(r.priceDate)?r.priceDate:null,
      fetchedAt:timestamp(r.fetchedAt)?r.fetchedAt:null,priceAgeDays:priceAge,status,error,
      retained:!!error && r.price!==null,retrievalStale:fetchedAge===null || fetchedAge>7,
      pythonAsOf:date(r.pythonAsOf)?r.pythonAsOf:null,
      refreshKnown:Object.hasOwn(r,"error")};
  });
  const feedAge=age(index.generatedAt);
  const counts={total:rows.length,withPrices:rows.filter(r=>r.price!==null).length,
    fresh:rows.filter(r=>r.status==="fresh").length,stale:rows.filter(r=>r.status==="stale").length,
    missing:rows.filter(r=>r.status==="missing").length,unknown:rows.filter(r=>r.status==="unknown").length,
    failed:rows.filter(r=>r.error).length,retained:rows.filter(r=>r.retained).length,
    unknownRefresh:rows.filter(r=>!r.refreshKnown).length,oldRetrieval:rows.filter(r=>r.retrievalStale && r.price!==null).length,
    pythonReports:rows.filter(r=>r.pythonAsOf).length};
  return {generatedAt:index.generatedAt,directoryAsOf:timestamp(index.directoryAsOf)?index.directoryAsOf:null,
    checkedAt:now.toISOString(),feedAgeHours:feedAge===null?null:feedAge*24,
    publicationDelayed:feedAge===null || feedAge>3,
    directoryTotal:index.total,directoryMismatch:index.total!==rows.length,counts,rows};
}
