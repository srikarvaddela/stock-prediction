import test from "node:test";
import assert from "node:assert/strict";
import {validHealthIndex,dataHealth} from "../lib/data-health.mjs";
const now=new Date("2026-11-25T12:00:00Z");
const row={symbol:"IBM",name:"IBM",price:10,priceDate:"2026-11-24",fetchedAt:"2026-11-25T00:00:00Z",error:null};
const index={generatedAt:"2026-11-25T00:00:00Z",directoryAsOf:"2026-11-25T00:00:00Z",total:4,rows:[row,{...row,symbol:"AAPL",priceDate:"2026-11-06",error:"Price HTTP 429"},{...row,symbol:"TSM",price:null,priceDate:null,error:"Price HTTP 404"},{...row,symbol:"SOUN",priceDate:null}]};
test("fresh publication cannot disguise stale, missing, or retained company histories",()=>{
  assert.equal(validHealthIndex(index),true);
  const h=dataHealth(index,now);assert.equal(h.publicationDelayed,false);
  assert.deepEqual([h.counts.fresh,h.counts.stale,h.counts.missing,h.counts.unknown,h.counts.failed,h.counts.retained],[1,1,1,1,2,1]);
  assert.equal(h.counts.total,h.counts.fresh+h.counts.stale+h.counts.missing+h.counts.unknown);
});
test("old feeds, future dates, absent refresh status, and mismatched coverage stay explicit",()=>{
  const future={...row,priceDate:"2026-11-26",fetchedAt:"2026-12-01T00:00:00Z"};delete future.error;
  const h=dataHealth({...index,generatedAt:"2026-11-20T00:00:00Z",rows:[future]},now);
  assert.equal(h.publicationDelayed,true);assert.equal(h.directoryMismatch,true);
  assert.equal(h.counts.unknown,1);assert.equal(h.counts.unknownRefresh,1);assert.equal(h.counts.oldRetrieval,1);
  assert.equal(dataHealth({...index,generatedAt:"2026-12-01T00:00:00Z"},now).publicationDelayed,true);
});
test("company coverage excludes SPY and rejects duplicate or malformed entries",()=>{
  const h=dataHealth({...index,total:1,rows:[row,{...row,symbol:"SPY"}]},now);
  assert.equal(h.counts.total,1);assert.equal(h.directoryMismatch,false);
  assert.equal(validHealthIndex({...index,rows:[row,row]}),false);
  assert.equal(validHealthIndex({...index,rows:[{...row,price:NaN}]}),false);
  assert.equal(validHealthIndex({...index,generatedAt:"bad"}),false);
});
