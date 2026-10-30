import test from "node:test";
import assert from "node:assert/strict";
import { parseWeekly, parseOverview, validSymbol } from "../lib/market.mjs";

test("rejects symbols that could alter a provider query", () => {
  for (const input of ["IBM&apikey=x", "<script>", "", "A".repeat(11)])
    assert.equal(validSymbol(input), false);
  for (const input of ["IBM", "BRK.B", "BRK-B"])
    assert.equal(validSymbol(input), true);
});
test("sorts provider history and rejects malformed prices", () => {
  const row = (price) => ({
    "4. close": price,
    "5. adjusted close": price,
    "6. volume": "100",
  });
  const result = parseWeekly({
    "Weekly Adjusted Time Series": {
      "2026-01-09": row("20"),
      "2026-01-02": row("10"),
      "2026-01-16": row("NaN"),
    },
  });
  assert.deepEqual(
    result.map((p) => p.close),
    [10, 20],
  );
  assert.throws(() => parseWeekly({ Information: "limit" }), /unavailable/);
});
test("missing fundamentals remain unknown instead of zero", () => {
  const result = parseOverview({ Symbol: "IBM", PERatio: "None" }, "IBM");
  assert.equal(result.pe, null);
  assert.equal(result.marketCap, null);
  assert.equal(parseOverview({ Symbol: "AAPL" }, "IBM"), null);
});
