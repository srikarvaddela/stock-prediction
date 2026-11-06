import test from "node:test";
import assert from "node:assert/strict";
import {validSnapshot} from "../lib/feed-validation.mjs";
test("shared histories reject mismatched symbols, unordered data and fake numeric values",()=>{
 const d={symbol:"ABC",fetchedAt:"2026-11-06T00:00:00Z",prices:[{date:"2026-10-23",close:10,adjusted:9,volume:10},{date:"2026-10-30",close:11,adjusted:10,volume:12}]};
 assert.equal(validSnapshot(d,"ABC"),true);assert.equal(validSnapshot(d,"XYZ"),false);
 assert.equal(validSnapshot({...d,prices:[...d.prices].reverse()},"ABC"),false);
 assert.equal(validSnapshot({...d,prices:[d.prices[0],{...d.prices[1],close:NaN}]},"ABC"),false);
});
