import test from "node:test";
import assert from "node:assert/strict";
import { forecast, featuresAt, completeWeeks } from "../lib/forecast.mjs";

function history(length = 220, flat = false) {
  return Array.from({ length }, (_, i) => {
    const d = new Date("2020-01-03T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + i * 7);
    const price = flat
      ? 100
      : 100 *
        Math.exp(
          i * 0.001 + Math.sin(i * 1.7) * 0.025 + Math.cos(i * 0.31) * 0.04,
        );
    return {
      date: d.toISOString().slice(0, 10),
      close: price,
      adjusted: price,
      volume: 1000,
    };
  });
}
const now = new Date("2030-01-01T12:00:00Z");
test("features do not read future prices", () => {
  const points = history();
  const before = featuresAt(points, 100);
  points[101].adjusted *= 3;
  assert.deepEqual(featuresAt(points, 100), before);
});
test("backtests do not train or scale with future observations", () => {
  const points = history();
  const before = forecast(points, now);
  points.at(-1).adjusted *= 1.5;
  const after = forecast(points, now);
  assert.deepEqual(before.backtest.slice(0, -1), after.backtest.slice(0, -1));
  assert.equal(
    before.backtest.at(-1).predictedReturn,
    after.backtest.at(-1).predictedReturn,
  );
  assert.notEqual(
    before.backtest.at(-1).actualReturn,
    after.backtest.at(-1).actualReturn,
  );
  for (const row of before.backtest) assert.ok(row.trainingThrough < row.date);
});
test("constant prices fit safely and reproduce the no-change baseline", () => {
  const f = forecast(history(220, true), now);
  assert.equal(f.estimate, 100);
  assert.equal(f.mae, 0);
  assert.equal(f.baselineMae, 0);
  assert.equal(f.low, 100);
  assert.equal(f.high, 100);
});
test("excludes the in-progress week, including Friday", () => {
  const points = [
    { date: "2026-10-23" },
    { date: "2026-10-29" },
    { date: "2026-10-30" },
  ];
  assert.deepEqual(completeWeeks(points, new Date("2026-10-30T18:00:00Z")), [
    points[0],
  ]);
});
test("requires enough contiguous history and valid prices", () => {
  assert.equal(forecast(history(50), now), null);
  const broken = history();
  broken.splice(100, 3);
  assert.equal(forecast(broken, now), null);
  const bad = history();
  bad[5].adjusted = NaN;
  assert.throws(() => forecast(bad, now), /positive/);
});
test("returns finite ordered estimates and independently correct error metrics", () => {
  const f = forecast(history(), now);
  assert.ok(f.low <= f.estimate && f.estimate <= f.high);
  assert.equal(f.backtestWeeks, 52);
  const expected =
    f.backtest.reduce(
      (sum, r) => sum + Math.abs(r.predictedReturn - r.actualReturn),
      0,
    ) / f.backtest.length;
  assert.ok(Math.abs(f.mae - expected) < 1e-12);
  assert.equal(f.stale, true);
});
