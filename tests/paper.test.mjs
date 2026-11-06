import test from "node:test";
import assert from "node:assert/strict";
import {
  quantityUnits,
  orderAmount,
  positionsFromTrades,
  executionTerms,
  pendingActions,
} from "../lib/paper.mjs";
test("paper order quantities and cents remain exact and reject invalid inputs", () => {
  assert.equal(quantityUnits("1.000001"), 1000001);
  assert.equal(orderAmount(quantityUnits("0.5"), 10001), 5001);
  for (const q of ["0", "-1", "1e4", "0.0000001", "Infinity", "99999999"])
    assert.throws(() => quantityUnits(q));
  assert.throws(() => orderAmount(1, 1));
  assert.throws(() =>
    orderAmount(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
  );
});
test("fees and slippage use side-specific fills and reject uneconomic small sales",()=>{
 const buy=executionTerms(1e6,10000,"buy"),sell=executionTerms(1e6,10000,"sell");
 assert.equal(buy.fillCents,10005);assert.equal(buy.cashCents,10105);
 assert.equal(sell.fillCents,9995);assert.equal(sell.cashCents,9895);
 assert.throws(()=>executionTerms(1,10,"sell"));
});
test("corporate actions preserve basis, credit only eligible shares and never repeat",()=>{
 const buy={symbol:"ABC",side:"buy",quantity_units:2e6,amount_cents:20000,fee_cents:100,account_version:0,price_date:"2026-01-01",request_id:"buy"};
 const snapshot={symbol:"ABC",actionsThrough:"2026-01-05",actions:[{type:"split",date:"2026-01-02",ratio:2},{type:"dividend",date:"2026-01-03",amount:0.25},{type:"dividend",date:"2025-12-01",amount:1},{type:"dividend",date:"2027-01-01",amount:1}]};
 const actions=pendingActions([buy],[snapshot]).map((t,i)=>({...t,account_version:i+1}));
 assert.equal(actions.length,2);assert.equal(actions[0].quantity_units,2e6);assert.equal(actions[1].amount_cents,100);
 const ledger=positionsFromTrades([buy,...actions]);assert.equal(ledger.positions[0].units,4e6);assert.equal(ledger.positions[0].costCents,20100);assert.equal(ledger.dividendCents,100);
 assert.deepEqual(pendingActions([buy,...actions],[snapshot]),[]);
 const exDateBuyer={...buy,price_date:"2026-01-03"};assert.equal(pendingActions([exDateBuyer],[snapshot]).length,0);
});
test("partial paper sales allocate cost and realize profit without losing remaining shares", () => {
  const rows = [
    {
      symbol: "AAPL",
      side: "buy",
      quantity_units: 2000000,
      amount_cents: 20000,
      account_version: 0,
    },
    {
      symbol: "AAPL",
      side: "buy",
      quantity_units: 1000000,
      amount_cents: 13000,
      account_version: 1,
    },
    {
      symbol: "AAPL",
      side: "sell",
      quantity_units: 1000000,
      amount_cents: 15000,
      account_version: 2,
    },
  ];
  const r = positionsFromTrades(rows.reverse());
  assert.equal(r.realizedCents, 4000);
  assert.equal(r.positions[0].units, 2000000);
  assert.equal(r.positions[0].costCents, 22000);
  assert.throws(() =>
    positionsFromTrades([{ ...rows[0], quantity_units: 4000000 }]),
  );
});
