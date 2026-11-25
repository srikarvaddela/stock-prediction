import test from "node:test";
import assert from "node:assert/strict";
import {forwardScorecard,validRegistry} from "../lib/forward-scorecard.mjs";
const now=new Date("2026-11-25T12:00:00Z");
const row={asOf:"2026-11-06",target:"2026-11-13",createdAt:"2026-11-07T12:00:00Z",predictedReturn:0.02,actualReturn:0.03,observedDate:"2026-11-13",settledAt:"2026-11-16",modelId:"ridge10"};
test("forward metrics compare only settled records against zero-return baseline",()=>{
  const report=forwardScorecard([row,{...row,asOf:"2026-11-13",target:"2026-11-20",createdAt:"2026-11-14T12:00:00Z",actualReturn:null},{...row,asOf:"2026-11-20",target:"2026-11-27",createdAt:"2026-11-21T12:00:00Z",actualReturn:null}],1,now);
  assert.equal(report.evaluation.count,1);assert.equal(report.pending,1);assert.equal(report.overdue,1);
  assert.ok(Math.abs(report.evaluation.mae-0.01)<1e-10);assert.equal(report.evaluation.baselineMae,0.03);assert.equal(report.wins,1);assert.equal(report.evaluation.interval,null);
});
test("late issuance, duplicate origins, future or premature outcomes cannot inflate forward performance",()=>{
  const report=forwardScorecard([row,row,{...row,createdAt:"2026-11-13T00:00:00Z"},{...row,observedDate:"2026-11-06"},{...row,settledAt:"2026-12-01"},{...row,actualReturn:NaN},{...row,createdAt:null},{...row,asOf:"2026-11-20",target:"2026-11-27",createdAt:"2026-11-21T00:00:00Z",observedDate:"2026-11-25",settledAt:"2026-11-25"}],1,now);
  assert.equal(report.evaluation.count,1);assert.equal(report.excluded,7);
});
test("holiday observations are accepted; horizons and registry identity must match",()=>{
  const holiday={...row,asOf:"2026-10-09",target:"2026-11-06",createdAt:"2026-10-10T00:00:00Z",observedDate:"2026-11-05",settledAt:"2026-11-09"};
  assert.equal(forwardScorecard([holiday],4,now).evaluation.count,1);
  assert.equal(forwardScorecard([holiday],1,now).excluded,1);
  assert.equal(validRegistry({symbol:"IBM",horizon:4,records:[]},"IBM",4),true);
  assert.equal(validRegistry({symbol:"IBM",horizon:4,records:[]},"AAPL",4),false);
  assert.equal(forwardScorecard([],1,now).evaluation.mae,null);
});
