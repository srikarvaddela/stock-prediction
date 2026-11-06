import test from "node:test";
import assert from "node:assert/strict";
import {
  quantityUnits,
  orderAmount,
  positionsFromTrades,
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
