import test from "node:test";
import assert from "node:assert/strict";
import {evaluatePredictions} from "../lib/evaluation.mjs";
test("evaluation distinguishes zero advantage, consistent wins and unobserved outcomes",()=>{
 const rows=Array.from({length:52},(_,i)=>({origin:String(i),date:String(i+1),predictedReturn:0,actualReturn:0.1}));
 const flat=evaluatePredictions(rows,4);assert.ok(Math.abs(flat.mae-0.1)<1e-12);assert.equal(flat.improvement,0);assert.equal(flat.interval.low,0);assert.equal(flat.periods.length,4);
 const win=evaluatePredictions(rows.map(r=>({...r,predictedReturn:0.08})));assert.ok(win.interval.low>0);
 assert.equal(evaluatePredictions([{predictedReturn:0.1,actualReturn:null}]).count,0);
 assert.equal(evaluatePredictions(rows.slice(0,10)).interval,null);
});
