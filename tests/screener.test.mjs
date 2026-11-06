import test from "node:test";
import assert from "node:assert/strict";
import { screenMetrics, filterStocks, sortStocks } from "../lib/screener.mjs";
import catalog from "../lib/stock-picker.json" with { type: "json" };
import sectors from "../lib/stock-sectors.json" with { type: "json" };
test("every featured stock has a curated group", () => {
  assert.deepEqual(Object.keys(sectors).sort(), Object.keys(catalog).sort());
});
test("screener returns exclude the partial week and annualize sample volatility correctly", () => {
  const p = Array.from({ length: 60 }, (_, i) => ({
    date: new Date(Date.UTC(2025, 0, 3 + i * 7)).toISOString().slice(0, 10),
    adjusted: 100 * Math.exp(i * 0.01),
  }));
  const now = new Date(p.at(-1).date + "T12:00:00Z");
  const before = screenMetrics(p, now);
  p.at(-1).adjusted *= 10;
  assert.deepEqual(screenMetrics(p, now), before);
  assert.ok(Math.abs(before.return4w - Math.expm1(0.04)) < 1e-12);
  assert.ok(before.volatility < 1e-12);
  const q = p.slice(0, -1);
  for (let i = 0; i < q.length; i++)
    q[i].adjusted = 100 * Math.exp(Math.sin(i) * 0.02);
  const r = q
    .slice(-53)
    .slice(1)
    .map((v, i) => Math.log(v.adjusted / q.slice(-53)[i].adjusted));
  const mean = r.reduce((a, b) => a + b, 0) / 52;
  const expected =
    Math.sqrt(r.reduce((s, v) => s + (v - mean) ** 2, 0) / 51) * Math.sqrt(52);
  assert.ok(Math.abs(screenMetrics(q, now).volatility - expected) < 1e-12);
});
test("active fundamentals filters exclude unknowns and keep actual zero growth", () => {
  const rows = [
    {
      symbol: "A",
      name: "Alpha",
      sector: "Technology",
      price: 10,
      pe: null,
      revenueGrowth: null,
    },
    {
      symbol: "B",
      name: "Beta",
      sector: "Energy",
      price: 20,
      pe: 15,
      revenueGrowth: 0,
    },
    {
      symbol: "C",
      name: "Gamma",
      sector: "Energy",
      price: 30,
      pe: 0,
      revenueGrowth: 0.1,
    },
  ];
  assert.deepEqual(
    filterStocks(rows, { maxPe: "20" }).map((r) => r.symbol),
    ["B"],
  );
  assert.deepEqual(
    filterStocks(rows, { minGrowth: "0" }).map((r) => r.symbol),
    ["B", "C"],
  );
  assert.equal(filterStocks(rows, { maxPrice: "0" }).length, 0);
  assert.equal(filterStocks(rows, { query: "alpha" })[0].symbol, "A");
  assert.deepEqual(
    sortStocks(rows, "pe", "desc").map((r) => r.symbol),
    ["B", "C", "A"],
  );
  assert.deepEqual(
    sortStocks(rows, "pe", "asc").map((r) => r.symbol),
    ["C", "B", "A"],
  );
});
