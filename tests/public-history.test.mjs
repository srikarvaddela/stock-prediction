import test from "node:test";
import assert from "node:assert/strict";
import { weeklyHistory } from "../lib/public-history.mjs";
function payload() {
  return {
    chart: {
      result: [
        {
          meta: { symbol: "MSFT", currency: "USD", instrumentType: "EQUITY" },
          timestamp: ["2025-04-16", "2025-04-17", "2025-04-22"].map(
            (d) => Date.parse(d + "T14:00:00Z") / 1000,
          ),
          indicators: {
            quote: [{ close: [110, 111, 115], volume: [2, 3, 4] }],
            adjclose: [{ adjclose: [105, 106, 109] }],
          },
        },
      ],
    },
  };
}
test("weekly history uses the final observed session, distinct adjusted closes and summed volume", () => {
  const { prices } = weeklyHistory(payload(), "MSFT");
  assert.deepEqual(prices, [
    { date: "2025-04-17", close: 111, adjusted: 106, volume: 5 },
    { date: "2025-04-22", close: 115, adjusted: 109, volume: 4 },
  ]);
});
test("reject mismatched ticker and missing adjusted prices", () => {
  assert.throws(() => weeklyHistory(payload(), "AAPL"));
  const p = payload();
  delete p.chart.result[0].indicators.adjclose;
  assert.throws(() => weeklyHistory(p, "MSFT"));
});
