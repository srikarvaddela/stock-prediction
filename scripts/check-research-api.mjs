import assert from "node:assert/strict";
const base="http://127.0.0.1:5186",headers={"oai-authenticated-user-id":"research-check-"+crypto.randomUUID(),"oai-authenticated-user-email":"local@example.invalid"};
for(const [symbol,kind] of [["RKLB","news"],["IBM","financials"],["IBM","earnings"]]){
 const r=await fetch(`${base}/api/research?symbol=${symbol}&kind=${kind}`,{headers,signal:AbortSignal.timeout(60000)}),d=await r.json();
 assert.equal(r.status,200,JSON.stringify(d));assert.equal(d.symbol,symbol);assert.equal(d.kind,kind);
 if(kind==="financials"){assert.match(d.financials.quarter,/^\d{4}-\d{2}-\d{2}$/);assert.ok(d.financials.revenue>0);}
 else assert.ok(Array.isArray(d.items));
 console.log(`${symbol} ${kind}: ${kind==="financials"?d.financials.quarter:d.items.length+" entries"}`);
}
const denied=await fetch(base+"/api/research?symbol=IBM&kind=earnings");assert.equal(denied.status,401);
console.log("Research API passed with real provider data and authentication enforcement.");
