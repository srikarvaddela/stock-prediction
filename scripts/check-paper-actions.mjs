// Synthetic fixtures are isolated to a unique local-only owner and never published.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
const base="http://127.0.0.1:5186",owner="actions-test-"+crypto.randomUUID(),symbol="TST"+crypto.randomUUID().replace(/[^a-z]/g,"").slice(0,5).toUpperCase();
const sql=s=>"'"+s.replaceAll("'","''")+"'";
function execute(command){const r=spawnSync(process.execPath,["--import","./scripts/sites-env.mjs","./node_modules/wrangler/bin/wrangler.js","d1","execute","DB","--local","--config","dist/server/wrangler.json","--persist-to",".wrangler/state","--command",command],{encoding:"utf8"});if(r.status!==0)throw Error(r.stderr||r.stdout);}
const today=new Date().toISOString().slice(0,10),day=n=>new Date(Date.now()-n*86400000).toISOString().slice(0,10);
const fixture={symbol,name:"Synthetic local test",exchange:"TEST",fetchedAt:new Date().toISOString(),prices:[{date:day(8),close:100,adjusted:100,volume:1},{date:today,close:50,adjusted:50,volume:1}],actionsFrom:day(8),actionsThrough:today,actions:[{type:"split",date:day(2),ratio:2},{type:"dividend",date:day(1),amount:0.25}]};
const cache="shared-feed-v1:prices/"+symbol+".json";
execute(`INSERT INTO market_cache(id,owner_id,body,expires_at) VALUES(${sql(cache)},'public-market-data',${sql(JSON.stringify(fixture))},${Date.now()+3600000}); INSERT INTO paper_accounts VALUES(${sql(owner)},9980000,1,100,${sql(day(3))},${sql(new Date().toISOString())}); INSERT INTO paper_trades(id,owner_id,request_id,account_version,symbol,side,quantity_units,price_cents,amount_cents,price_date,created_at,fee_cents) VALUES(${sql(crypto.randomUUID())},${sql(owner)},'fixture-buy',0,${sql(symbol)},'buy',2000000,10000,20000,${sql(day(3))},${sql(new Date().toISOString())},0);`);
async function state(){const r=await fetch(base+"/api/paper",{headers:{"oai-authenticated-user-id":owner,"oai-authenticated-user-email":"local@example.invalid"},signal:AbortSignal.timeout(30000)});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d;}
try{
 await Promise.all([state(),state()]);const d=await state();
 assert.equal(d.version,3);assert.equal(d.cashCents,9980100);assert.equal(d.positions[0].quantity,4);assert.equal(d.positions[0].costCents,20000);assert.equal(d.dividendCents,100);assert.equal(d.tradeCount,3);
 const again=await state();assert.equal(again.cashCents,d.cashCents);assert.equal(again.version,d.version);
 console.log("Corporate-action API passed: split, basis preservation, dividend entitlement, concurrent accrual and duplicate protection.");
}finally{execute(`DELETE FROM paper_trades WHERE owner_id=${sql(owner)}; DELETE FROM paper_accounts WHERE owner_id=${sql(owner)}; DELETE FROM market_cache WHERE id=${sql(cache)};`);}
