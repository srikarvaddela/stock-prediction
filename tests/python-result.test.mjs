import test from "node:test";
import assert from "node:assert/strict";
import { publishedForecast } from "../lib/python-result.mjs";
const report = {
  symbol: "AAPL",
  horizon: 4,
  modelVersion: "python-research-1.0.0",
  asOf: "2026-10-30",
  targetWeekEnding: "2026-11-27",
  dataset: { sha256: "a".repeat(64) },
  backtest: Array(52).fill({}),
  estimate: 100,
  low: 90,
  high: 110,
  mae: 0.02,
  baselineMae: 0.03,
  expectedReturn: 0,
};
test("published forecasts reject wrong symbols, horizons, nonfinite values and provenance", () => {
  const now = new Date("2026-11-05");
  assert.equal(publishedForecast(report, "TSLA", 4, now), null);
  assert.equal(publishedForecast(report, "AAPL", 1, now), null);
  assert.equal(
    publishedForecast({ ...report, estimate: NaN }, "AAPL", 4, now),
    null,
  );
  assert.equal(
    publishedForecast({ ...report, dataset: {} }, "AAPL", 4, now),
    null,
  );
  assert.equal(
    publishedForecast({ ...report, asOf: "2026-12-01" }, "AAPL", 4, now),
    null,
  );
});
test("freshness is recalculated at request time, including long-horizon old origins", () => {
  assert.equal(
    publishedForecast(report, "AAPL", 4, new Date("2026-11-05")).outdated,
    false,
  );
  const old = publishedForecast(report, "AAPL", 4, new Date("2026-11-12"));
  assert.equal(old.outdated, true);
  assert.equal(old.stale, false);
  assert.equal(
    publishedForecast(report, "AAPL", 4, new Date("2026-12-01")).stale,
    true,
  );
});
