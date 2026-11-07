import assert from "node:assert/strict";
const base="http://127.0.0.1:5186",headers={"oai-authenticated-user-id":"universe-check-"+crypto.randomUUID(),"oai-authenticated-user-email":"local@example.invalid"};
async function get(path){const r=await fetch(base+path,{headers,signal:AbortSignal.timeout(45000)}),d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d;}
const dir=await get("/api/directory?q=Rocket%20Lab");assert.ok(dir.rows.some(r=>r.symbol==="RKLB"));assert.ok(dir.universe>3000);
const page=await get("/api/directory?page=1");assert.equal(page.rows.length,50);
for(const symbol of ["RKLB","SOUN","ACHR","SOFI","AAPL","IBM"]){const d=await get("/api/stocks?symbol="+symbol);assert.equal(d.symbol,symbol);assert.ok(d.prices.length>2);assert.ok(d.prices.at(-1).close>0);console.log(`${symbol}: ${d.prices.length} observed weeks through ${d.prices.at(-1).date}`);}
for(const horizon of [1,4]){const p=await get(`/api/python-forecast?symbol=RKLB&horizon=${horizon}`);assert.equal(p.symbol,"RKLB");assert.equal(p.horizon,horizon);assert.equal(p.backtest.length,52);assert.equal(p.evaluation.periods.length,4);assert.ok(Array.isArray(p.forwardRecords));}
const q=await get("/api/paper/quote?symbol=RKLB");assert.equal(q.actionsReady,true);assert.equal(q.symbol,"RKLB");
console.log("Expanded-universe API passed: company search, paging, small/newer-company histories, Python evaluations and paper quotes.");
