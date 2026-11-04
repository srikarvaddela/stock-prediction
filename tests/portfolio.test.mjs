import test from "node:test";
import assert from "node:assert/strict";
import { portfolioReport } from "../lib/portfolio.mjs";
test("excludes unpriced lots from both value and cost, and consolidates stock weights", () => {
  const h = [
    { symbol: "A", quantity: 2, cost_basis: 4 },
    { symbol: "A", quantity: 1, cost_basis: 5 },
    { symbol: "B", quantity: 5, cost_basis: 6 },
  ];
  const r = portfolioReport(h, {
    A: {
      prices: [{ date: "2025-01-01", close: 10, adjusted: 10 }],
      overview: { currency: "USD", sector: "Technology" },
    },
  });
  assert.equal(r.value, 30);
  assert.equal(r.cost, 13);
  assert.equal(r.pnl, 17);
  assert.equal(r.pricedCount, 2);
  assert.equal(r.largestWeight, 1);
  assert.equal(r.rows[2].value, null);
  assert.equal(r.risk, null);
});
