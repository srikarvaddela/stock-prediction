import test from "node:test";
import assert from "node:assert/strict";
import { scoreForecast } from "../lib/outcomes.mjs";
const record = {
  as_of: "2025-04-11",
  target: "2025-04-18",
  created_at: "2025-04-14T16:00:00Z",
};
const prices = [
  { date: "2025-04-11", adjusted: 50 },
  { date: "2025-04-17", adjusted: 55 },
];
test("scores the correct shortened week only after it finishes", () => {
  assert.equal(scoreForecast(record, prices, "2025-04-17").status, "pending");
  assert.ok(
    Math.abs(scoreForecast(record, prices, "2025-04-21").actual - 0.1) < 1e-12,
  );
});
test("excludes forecasts recorded after the target market observation", () =>
  assert.equal(
    scoreForecast(
      { ...record, created_at: "2025-04-17T16:00:00Z" },
      prices,
      "2025-04-21",
    ).status,
    "excluded",
  ));
